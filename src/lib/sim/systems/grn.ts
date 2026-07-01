/**
 * Gene Regulatory Network (GRN) simulator.
 * -----------------------------------------------------------------------------
 * Deterministic ODE model of transcription-factor networks using Hill
 * activation / repression kinetics, integrated with the shared adaptive
 * Dormand–Prince solver (`rk45`) from the core.
 *
 * MODEL
 * -----
 * Each gene `i` is represented by the concentration of its protein product
 * `p_i` (in arbitrary concentration units). Every gene has:
 *   - a basal (leak) production rate  α0_i   (transcription with no regulator),
 *   - a maximal regulated production  β_i    (fully-activated output),
 *   - a first-order degradation rate  γ_i.
 *
 * A directed, *signed* edge (r → t, sign s) means regulator protein `r`
 * modulates target gene `t`. Each edge contributes a Hill term of its
 * regulator's concentration:
 *
 *     activation  (s = +1):   H(x) =  x^n / (K^n + x^n)      (0 → 1 as x grows)
 *     repression  (s = −1):   H(x) =  K^n / (K^n + x^n)      (1 → 0 as x grows)
 *
 * where K is the half-max threshold and n the Hill coefficient (cooperativity).
 *
 * Multiple regulators on one target are combined into a single dimensionless
 * "activity" in [0, 1] via one of two logics:
 *   - 'multiplicative'  →  Π H_e     (AND gate; all inputs must be satisfied)
 *   - 'additive'        →  mean(H_e) (OR / competitive averaging)
 * A gene with no regulators is constitutively ON (activity = 1).
 *
 * The governing ODE for each gene is therefore
 *
 *     dp_i/dt = α0_i + β_i · activity_i(p) − γ_i · p_i.
 *
 * Because production terms are non-negative and the degradation term vanishes
 * as p_i → 0, trajectories starting from non-negative initial conditions stay
 * non-negative for all time (at any minimum, dp/dt = 0 ⇒ p = production/γ ≥ α0/γ).
 *
 * PRESETS (classic synthetic-biology circuits)
 * --------------------------------------------
 *   repressilator   – 3-gene ring of repressors (Elowitz & Leibler, Nature 2000).
 *                     With sufficient cooperativity the symmetric fixed point is
 *                     unstable and the system settles onto a limit cycle: each
 *                     protein oscillates. Linearizing the symmetric ring gives a
 *                     circulant Jacobian with eigenvalues λ_k = −γ − m·e^{i·2πk/N}
 *                     (k = 0..N−1), where m = |f'(p*)|. This sec(π/N) instability
 *                     condition is specific to rings with an ODD number of
 *                     repressive edges N (a net negative-feedback loop): no k
 *                     lands exactly on angle π, so the least-stable mode is the
 *                     complex pair closest to it, giving a Hopf (oscillation)
 *                     threshold of m/γ > sec(π/N); for N = 3 this is m/γ > 2,
 *                     which our defaults satisfy (Thron 1991; Mallet-Paret &
 *                     Smith 1990). This formula does NOT apply to rings with an
 *                     EVEN number of repressive edges — see `toggleSwitch` below,
 *                     which is structurally the same kind of ring with N = 2.
 *   toggleSwitch    – 2 genes with mutual repression (Gardner, Cantor & Collins,
 *                     Nature 2000); structurally a 2-repressor ring (even N = 2).
 *                     There k = N/2 lands exactly on angle π, giving a REAL
 *                     eigenvalue λ = −γ + m rather than a complex pair, so the
 *                     instability threshold is simply m/γ > 1 (sec(π/2) is
 *                     undefined since cos 90° = 0) — a saddle/pitchfork
 *                     bifurcation, not a Hopf bifurcation. For Hill coefficient
 *                     ≥ 2 and strong enough production the symmetric state is a
 *                     saddle and the system is bistable: it relaxes to (high A,
 *                     low B) or (low A, high B) depending on which protein
 *                     starts higher.
 *   feedForwardLoop – coherent type-1 FFL (Alon, Nature Reviews Genetics 2007).
 *                     X activates Y, and X AND Y activate Z. This topology is
 *                     the textbook sign-sensitive delay / persistence detector
 *                     (Mangan & Alon, PNAS 2003) when X receives a transient
 *                     pulsed input. This preset, however, gives X no regulators
 *                     (constitutively ON per the rule above) and no time-varying
 *                     input, so it can only rise monotonically to steady ON; it
 *                     demonstrates the turn-on delay of Z relative to X/Y, not
 *                     the pulse-filtering behaviour itself.
 *
 * The module also exposes oscillation detection (mean-crossing counting and
 * period estimation) and steady-state detection so downstream code can classify
 * a run's dynamical behaviour.
 *
 * DETERMINISM
 * -----------
 * The core dynamics are a deterministic ODE. An optional `initialNoise` applies
 * seeded log-normal jitter to the initial protein concentrations using
 * `createRng(seed)` from the core PRNG — never `Math.random` — so that a given
 * (seed, params) pair reproduces byte-for-byte.
 *
 * References:
 *  - Elowitz MB, Leibler S. "A synthetic oscillatory network of transcriptional
 *    regulators." Nature 403:335–338 (2000).
 *  - Gardner TS, Cantor CR, Collins JJ. "Construction of a genetic toggle switch
 *    in Escherichia coli." Nature 403:339–342 (2000).
 *  - Alon U. "Network motifs: theory and experimental approaches." Nat Rev Genet
 *    8:450–461 (2007).
 *  - Thron CD. "The secant condition for instability in biochemical feedback
 *    control models." Bull Math Biol 53(3):383–401 (1991).
 *  - Mallet-Paret J, Smith HL. "The Poincaré-Bendixson theorem for monotone
 *    cyclic feedback systems." J Dyn Diff Eq 2:367–421 (1990).
 *  - Mangan S, Alon U. "Structure and function of the feed-forward loop network
 *    motif." Proc Natl Acad Sci USA 100:11980–11985 (2003).
 */

import { z } from 'zod';
import { type Derivative, rk45 } from '../core/ode';
import { createRng } from '../core/prng';
import type { EngineSpec, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

// ---------------------------------------------------------------------------
// Parameter schema
// ---------------------------------------------------------------------------

/** A single gene / node in the network. */
const geneSchema = z.object({
  name: z.string().min(1),
  /** Basal (leak) production rate α0 ≥ 0. */
  basal: z.number().min(0).default(0),
  /** Maximal regulated production rate β ≥ 0. */
  beta: z.number().min(0).default(20),
  /** First-order degradation rate γ > 0. */
  degradation: z.number().positive().default(1),
  /** Initial protein concentration ≥ 0. */
  y0: z.number().min(0).default(0),
});

/** A signed regulatory edge (regulator → target). */
const edgeSchema = z.object({
  /** Name of the regulator gene. */
  from: z.string().min(1),
  /** Name of the target gene. */
  to: z.string().min(1),
  /** +1 = activation, −1 = repression. */
  sign: z.union([z.literal(1), z.literal(-1)]),
  /** Half-max threshold K > 0. */
  K: z.number().positive().default(1),
  /** Hill coefficient (cooperativity) n > 0. */
  n: z.number().positive().default(3),
});

const networkSchema = z.object({
  genes: z.array(geneSchema).min(1),
  edges: z.array(edgeSchema).default([]),
  /** How multiple regulators on one target are combined. */
  logic: z.enum(['additive', 'multiplicative']).default('multiplicative'),
});

export const paramsSchema = z
  .object({
    /** Named circuit to simulate. Ignored if `network` is given. */
    preset: z.enum(['repressilator', 'toggleSwitch', 'feedForwardLoop']).optional(),
    /** Explicit custom network (overrides `preset`). */
    network: networkSchema.optional(),
    /** Override initial concentrations (length must match gene count). */
    initial: z.array(z.number().min(0)).optional(),
    /** Integration horizon (arbitrary time units). */
    tMax: z.number().positive().default(100),
    /** Number of output samples for the returned series. */
    outputPoints: z.number().int().positive().default(2000),
    /** rk45 error tolerance. */
    tol: z.number().positive().default(1e-7),
    /** Seed for any stochastic jitter (kept for reproducibility/provenance). */
    seed: z.union([z.number(), z.string()]).default('grn'),
    /** Std of seeded log-normal jitter on initial conditions (0 = deterministic). */
    initialNoise: z.number().min(0).default(0),
  })
  .refine((d) => d.preset !== undefined || d.network !== undefined, {
    message: 'Provide either a preset or an explicit network.',
  });

/** Loose input shape accepted by `run` (defaults filled in on parse). */
export type GrnParams = z.input<typeof paramsSchema>;
type GrnConfig = z.output<typeof paramsSchema>;
type GeneCfg = z.output<typeof geneSchema>;
type EdgeCfg = z.output<typeof edgeSchema>;

// ---------------------------------------------------------------------------
// Network construction
// ---------------------------------------------------------------------------

export interface ResolvedEdge {
  fromIndex: number;
  sign: 1 | -1;
  K: number;
  n: number;
}

export interface ResolvedNetwork {
  genes: GeneCfg[];
  /** For each target gene index, the list of incoming regulatory edges. */
  inputs: ResolvedEdge[][];
  logic: 'additive' | 'multiplicative';
}

/** Hill regulatory response of a single edge given its regulator concentration. */
export function hillResponse(x: number, edge: { sign: 1 | -1; K: number; n: number }): number {
  const xc = Math.max(0, x);
  const xn = xc ** edge.n;
  const kn = edge.K ** edge.n;
  const denom = kn + xn;
  if (denom === 0) return edge.sign > 0 ? 0 : 1; // x = K = 0 edge case
  // Activation rises with x; repression falls with x.
  return edge.sign > 0 ? xn / denom : kn / denom;
}

/** Resolve a validated network spec into index-based structures for integration. */
export function resolveNetwork(net: {
  genes: GeneCfg[];
  edges: EdgeCfg[];
  logic: 'additive' | 'multiplicative';
}): ResolvedNetwork {
  const index = new Map<string, number>();
  net.genes.forEach((g, i) => {
    if (index.has(g.name)) throw new Error(`Duplicate gene name: ${g.name}`);
    index.set(g.name, i);
  });
  const inputs: ResolvedEdge[][] = net.genes.map(() => []);
  for (const e of net.edges) {
    const fromIndex = index.get(e.from);
    const toIndex = index.get(e.to);
    if (fromIndex === undefined) throw new Error(`Edge references unknown regulator: ${e.from}`);
    if (toIndex === undefined) throw new Error(`Edge references unknown target: ${e.to}`);
    inputs[toIndex]?.push({ fromIndex, sign: e.sign, K: e.K, n: e.n });
  }
  return { genes: net.genes, inputs, logic: net.logic };
}

/**
 * Build the derivative function dp/dt = α0 + β·activity(p) − γ·p for the network.
 * Pure and free of external state — safe to hand to any core integrator.
 */
export function buildDerivative(net: ResolvedNetwork): Derivative {
  return (_t: number, y: number[]): number[] => {
    return net.genes.map((g, i) => {
      const regs = net.inputs[i]!;
      let activity: number;
      if (regs.length === 0) {
        activity = 1; // constitutively expressed
      } else if (net.logic === 'multiplicative') {
        activity = 1;
        for (const e of regs) activity *= hillResponse(y[e.fromIndex] ?? 0, e);
      } else {
        let s = 0;
        for (const e of regs) s += hillResponse(y[e.fromIndex] ?? 0, e);
        activity = s / regs.length;
      }
      const conc = Math.max(0, y[i] ?? 0);
      return g.basal + g.beta * activity - g.degradation * conc;
    });
  };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

interface PresetSpec {
  genes: GeneCfg[];
  edges: EdgeCfg[];
  logic: 'additive' | 'multiplicative';
  defaultInitial: number[];
  behaviorHint: 'oscillatory' | 'toggle' | 'steady-state';
}

function gene(name: string, o: Partial<GeneCfg> = {}): GeneCfg {
  return {
    name,
    basal: o.basal ?? 0,
    beta: o.beta ?? 20,
    degradation: o.degradation ?? 1,
    y0: o.y0 ?? 0,
  };
}

function edge(from: string, to: string, sign: 1 | -1, o: Partial<EdgeCfg> = {}): EdgeCfg {
  return { from, to, sign, K: o.K ?? 1, n: o.n ?? 3 };
}

/** Build one of the named preset circuits. */
export function buildPreset(name: NonNullable<GrnParams['preset']>): PresetSpec {
  switch (name) {
    case 'repressilator': {
      // 3-gene ring of repressors: g0 ⊣ g1 ⊣ g2 ⊣ g0. N = 3 is odd, so the
      // sec(π/N) Hopf condition applies (see module docstring): n = 4, β/K = 30
      // puts |f'(p*)|/γ ≈ 3.2 well above the secant threshold of 2 (γ = 1 here),
      // giving robust, large-amplitude oscillations; a small basal leak keeps
      // troughs comfortably positive.
      const params = { basal: 0.3, beta: 30, degradation: 1 };
      const genes = [gene('g0', params), gene('g1', params), gene('g2', params)];
      const edges = [
        edge('g2', 'g0', -1, { K: 1, n: 4 }),
        edge('g0', 'g1', -1, { K: 1, n: 4 }),
        edge('g1', 'g2', -1, { K: 1, n: 4 }),
      ];
      // Asymmetric start breaks the unstable symmetric fixed point immediately.
      return {
        genes,
        edges,
        logic: 'multiplicative',
        defaultInitial: [1, 4, 8],
        behaviorHint: 'oscillatory',
      };
    }
    case 'toggleSwitch': {
      // Two genes repressing each other: an N = 2 (even) repressor ring, so the
      // instability threshold is the real-eigenvalue condition |f'(p*)|/γ > 1
      // (not the odd-N sec(π/N) Hopf condition — see module docstring). n = 3,
      // strong β ⇒ |f'(p*)|/γ ≈ 2.5 > 1 ⇒ bistable.
      const params = { basal: 0.05, beta: 12, degradation: 1 };
      const genes = [gene('A', params), gene('B', params)];
      const edges = [edge('B', 'A', -1, { K: 1, n: 3 }), edge('A', 'B', -1, { K: 1, n: 3 })];
      // Default IC favours A; callers swap `initial` to flip the winner.
      return {
        genes,
        edges,
        logic: 'multiplicative',
        defaultInitial: [3, 1],
        behaviorHint: 'toggle',
      };
    }
    case 'feedForwardLoop': {
      // Coherent type-1 FFL with AND logic at Z: X → Y, (X AND Y) → Z.
      const genes = [
        gene('X', { basal: 0, beta: 5, degradation: 1 }),
        gene('Y', { basal: 0, beta: 5, degradation: 1 }),
        gene('Z', { basal: 0, beta: 5, degradation: 1 }),
      ];
      const edges = [
        edge('X', 'Y', 1, { K: 1, n: 2 }),
        edge('X', 'Z', 1, { K: 1, n: 2 }),
        edge('Y', 'Z', 1, { K: 1, n: 2 }),
      ];
      return {
        genes,
        edges,
        logic: 'multiplicative', // AND gate on Z
        defaultInitial: [0, 0, 0],
        behaviorHint: 'steady-state',
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Trajectory analysis: oscillation & steady-state detection
// ---------------------------------------------------------------------------

export interface SeriesAnalysis {
  name: string;
  mean: number;
  min: number;
  max: number;
  /** Half peak-to-trough range over the analysis window. */
  amplitude: number;
  /** Number of upward mean-crossings in the analysis window. */
  upwardCrossings: number;
  /** Completed oscillation periods = upwardCrossings − 1 (≥ 0). */
  cycles: number;
  /** Mean interval between successive upward crossings, or null if < 2. */
  estimatedPeriod: number | null;
  oscillatory: boolean;
  steadyState: boolean;
  finalValue: number;
}

export interface AnalyzeOptions {
  /** Fraction of the leading trajectory discarded as transient. */
  transientFraction?: number;
  /** Minimum amplitude to qualify as a genuine oscillation. */
  amplitudeThreshold?: number;
  /** Minimum completed cycles to qualify as sustained oscillation. */
  minCycles?: number;
}

/**
 * Analyse one species' time course: detect sustained oscillation by counting
 * upward crossings of the window mean, estimate the period from crossing
 * spacings, and flag a steady state when the tail is essentially flat.
 */
export function analyzeSeries(
  t: number[],
  x: number[],
  name: string,
  opts: AnalyzeOptions = {},
): SeriesAnalysis {
  const transientFraction = opts.transientFraction ?? 0.3;
  const amplitudeThreshold = opts.amplitudeThreshold ?? 0.5;
  const minCycles = opts.minCycles ?? 2;

  const nPts = x.length;
  const start = Math.min(nPts - 1, Math.max(0, Math.floor(nPts * transientFraction)));

  // Window statistics.
  let mean = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let count = 0;
  for (let i = start; i < nPts; i++) {
    const v = x[i] ?? 0;
    mean += v;
    if (v < min) min = v;
    if (v > max) max = v;
    count++;
  }
  mean = count > 0 ? mean / count : 0;
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = 0;
  const amplitude = (max - min) / 2;

  // Upward mean-crossings with linear interpolation for crossing times.
  const crossingTimes: number[] = [];
  for (let i = start + 1; i < nPts; i++) {
    const prev = x[i - 1] ?? 0;
    const cur = x[i] ?? 0;
    if (prev < mean && cur >= mean) {
      const tPrev = t[i - 1] ?? 0;
      const tCur = t[i] ?? 0;
      const denom = cur - prev;
      const frac = denom === 0 ? 0 : (mean - prev) / denom;
      crossingTimes.push(tPrev + frac * (tCur - tPrev));
    }
  }
  const upwardCrossings = crossingTimes.length;

  let estimatedPeriod: number | null = null;
  if (upwardCrossings >= 2) {
    let sum = 0;
    for (let i = 1; i < upwardCrossings; i++) {
      sum += (crossingTimes[i] ?? 0) - (crossingTimes[i - 1] ?? 0);
    }
    estimatedPeriod = sum / (upwardCrossings - 1);
  }
  const cycles = Math.max(0, upwardCrossings - 1);

  const oscillatory = cycles >= minCycles && amplitude >= amplitudeThreshold;

  // Steady state: the final 10% of the trajectory is essentially flat.
  const tailStart = Math.max(0, Math.floor(nPts * 0.9));
  let tMin = Number.POSITIVE_INFINITY;
  let tMax2 = Number.NEGATIVE_INFINITY;
  for (let i = tailStart; i < nPts; i++) {
    const v = x[i] ?? 0;
    if (v < tMin) tMin = v;
    if (v > tMax2) tMax2 = v;
  }
  if (!Number.isFinite(tMin)) tMin = 0;
  if (!Number.isFinite(tMax2)) tMax2 = 0;
  const tailRange = tMax2 - tMin;
  const finalValue = x[nPts - 1] ?? 0;
  const steadyState = !oscillatory && tailRange < 1e-3 * (Math.abs(finalValue) + 1);

  return {
    name,
    mean,
    min,
    max,
    amplitude,
    upwardCrossings,
    cycles,
    estimatedPeriod,
    oscillatory,
    steadyState,
    finalValue,
  };
}

// ---------------------------------------------------------------------------
// Engine detail & run
// ---------------------------------------------------------------------------

export interface GrnDetail {
  preset?: string;
  behavior: 'oscillatory' | 'toggle' | 'steady-state';
  genes: string[];
  logic: 'additive' | 'multiplicative';
  analyses: SeriesAnalysis[];
  finalState: number[];
}

/** Assemble the network + initial conditions from either a preset or an explicit spec. */
function assemble(cfg: GrnConfig): {
  net: ResolvedNetwork;
  initial: number[];
  behaviorHint: GrnDetail['behavior'];
  presetName?: string;
} {
  if (cfg.network) {
    const net = resolveNetwork(cfg.network);
    const initial = net.genes.map((g) => g.y0);
    return { net, initial, behaviorHint: 'steady-state' };
  }
  const preset = buildPreset(cfg.preset!);
  const net = resolveNetwork({ genes: preset.genes, edges: preset.edges, logic: preset.logic });
  return {
    net,
    initial: [...preset.defaultInitial],
    behaviorHint: preset.behaviorHint,
    presetName: cfg.preset,
  };
}

/**
 * Run the GRN simulation.
 *
 * Returns protein-concentration time series plus behaviour-specific metrics:
 *   - oscillatory presets → `estimatedPeriod`, `amplitude`, `cycles`;
 *   - toggle switch       → `finalStateA`, `finalStateB`, `winnerIndex`;
 *   - all runs            → per-gene final concentrations.
 */
export function run(params: GrnParams): SimResult<GrnDetail> {
  const cfg = paramsSchema.parse(params);
  const { net, initial, behaviorHint, presetName } = assemble(cfg);

  // Initial conditions: explicit override > assembled defaults.
  let y0 = [...initial];
  if (cfg.initial) {
    if (cfg.initial.length !== net.genes.length) {
      throw new Error(
        `initial has length ${cfg.initial.length} but network has ${net.genes.length} genes`,
      );
    }
    y0 = [...cfg.initial];
  }

  // Optional seeded log-normal jitter on the initial conditions (deterministic
  // given the seed). Keeps concentrations strictly positive.
  if (cfg.initialNoise > 0) {
    const rng = createRng(cfg.seed);
    y0 = y0.map((v) => v * Math.exp(rng.normal(0, cfg.initialNoise)));
  }

  const f = buildDerivative(net);
  const traj = rk45(f, y0, 0, cfg.tMax, {
    tol: cfg.tol,
    outputPoints: cfg.outputPoints,
  });

  // Column-orient the trajectory: one array per gene.
  const geneNames = net.genes.map((g) => g.name);
  const columns: Record<string, number[]> = {};
  geneNames.forEach((name, gi) => {
    columns[name] = traj.y.map((row) => row[gi] ?? 0);
  });

  // Analyse each species.
  const analyses = geneNames.map((name) =>
    analyzeSeries(traj.t, columns[name]!, name, { transientFraction: 0.3 }),
  );

  const finalState = geneNames.map((name) => {
    const col = columns[name]!;
    return col[col.length - 1] ?? 0;
  });

  // Classify overall behaviour.
  const anyOscillating = analyses.some((a) => a.oscillatory);
  let behavior: GrnDetail['behavior'];
  if (anyOscillating) behavior = 'oscillatory';
  else if (behaviorHint === 'toggle') behavior = 'toggle';
  else behavior = 'steady-state';

  // Build metrics.
  const metrics = [] as SimResult<GrnDetail>['metrics'];

  if (behavior === 'oscillatory') {
    const osc = analyses.filter((a) => a.oscillatory);
    const periods = osc.map((a) => a.estimatedPeriod).filter((p): p is number => p !== null);
    const meanPeriod = periods.length > 0 ? periods.reduce((s, p) => s + p, 0) / periods.length : 0;
    const meanAmp = osc.reduce((s, a) => s + a.amplitude, 0) / osc.length;
    const meanCycles = osc.reduce((s, a) => s + a.cycles, 0) / osc.length;
    metrics.push(
      { key: 'estimatedPeriod', label: 'Estimated period', value: meanPeriod, unit: 'time units' },
      { key: 'amplitude', label: 'Oscillation amplitude', value: meanAmp, unit: 'conc.' },
      { key: 'cycles', label: 'Completed cycles', value: meanCycles },
      { key: 'oscillatingGenes', label: 'Oscillating genes', value: osc.length },
    );
  } else if (behavior === 'toggle') {
    const a0 = analyses[0]!;
    const a1 = analyses[1]!;
    const winnerIndex = a0.finalValue >= a1.finalValue ? 0 : 1;
    metrics.push(
      { key: 'finalStateA', label: `Final ${a0.name}`, value: a0.finalValue, unit: 'conc.' },
      { key: 'finalStateB', label: `Final ${a1.name}`, value: a1.finalValue, unit: 'conc.' },
      {
        key: 'winnerIndex',
        label: 'Winning gene index',
        value: winnerIndex,
        note: `${winnerIndex === 0 ? a0.name : a1.name} is the high (ON) state`,
      },
      {
        key: 'separation',
        label: 'High/low separation',
        value: Math.abs(a0.finalValue - a1.finalValue),
        unit: 'conc.',
      },
    );
  }

  // Generic per-gene final concentrations (always included).
  analyses.forEach((a, i) => {
    metrics.push({
      key: `final_${a.name}`,
      label: `Final [${a.name}]`,
      value: a.finalValue,
      unit: 'conc.',
      note: i === 0 ? 'Final protein concentration' : undefined,
    });
  });

  // Series for charting: all proteins vs time.
  const series: Series[] = [
    {
      x: traj.t,
      y: columns,
      xLabel: 'time',
      yLabel: 'protein concentration',
    },
  ];

  // Summary headline.
  let summary: string;
  if (behavior === 'oscillatory') {
    const period = metrics.find((m) => m.key === 'estimatedPeriod')?.value ?? 0;
    summary = `${presetName ?? 'Network'} oscillates with period ≈ ${period.toFixed(2)} time units across ${analyses.filter((a) => a.oscillatory).length} genes.`;
  } else if (behavior === 'toggle') {
    const winner =
      (metrics.find((m) => m.key === 'winnerIndex')?.value ?? 0) === 0
        ? analyses[0]?.name
        : analyses[1]?.name;
    summary = `Toggle switch resolved to a bistable state with ${winner} ON.`;
  } else {
    summary = `${presetName ?? 'Network'} settled to a steady state (final: ${finalState.map((v) => v.toFixed(2)).join(', ')}).`;
  }

  const detail: GrnDetail = {
    preset: presetName,
    behavior,
    genes: geneNames,
    logic: net.logic,
    analyses,
    finalState,
  };

  return {
    engine: 'grn',
    summary,
    metrics,
    series,
    detail,
    provenance: provenance('grn', '1.0.0', cfg as Record<string, unknown>, cfg.seed),
  };
}

// ---------------------------------------------------------------------------
// Engine spec
// ---------------------------------------------------------------------------

export const spec: EngineSpec<GrnParams, GrnDetail> = {
  slug: 'grn',
  title: 'Gene Regulatory Networks',
  domain: 'systems-biology',
  version: '1.0.0',
  description:
    'Deterministic ODE simulator for transcription-factor networks using Hill ' +
    'activation/repression kinetics. Build circuits from signed edges or use the ' +
    'repressilator (oscillator), toggle switch (bistable), and coherent ' +
    'feed-forward-loop presets. Detects oscillation (period/amplitude) and ' +
    'steady states.',
  references: [
    'Elowitz MB, Leibler S. A synthetic oscillatory network of transcriptional regulators. Nature 403:335-338 (2000).',
    'Gardner TS, Cantor CR, Collins JJ. Construction of a genetic toggle switch in Escherichia coli. Nature 403:339-342 (2000).',
    'Alon U. Network motifs: theory and experimental approaches. Nat Rev Genet 8:450-461 (2007).',
    'Thron CD. The secant condition for instability in biochemical feedback control models. Bull Math Biol 53(3):383-401 (1991).',
    'Mallet-Paret J, Smith HL. The Poincare-Bendixson theorem for monotone cyclic feedback systems. J Dyn Diff Eq 2:367-421 (1990).',
    'Mangan S, Alon U. Structure and function of the feed-forward loop network motif. Proc Natl Acad Sci USA 100:11980-11985 (2003).',
  ],
  paramsSchema: paramsSchema as unknown as z.ZodType<GrnParams>,
  run,
  example: { preset: 'repressilator' },
  tags: ['gene-regulation', 'ode', 'hill-kinetics', 'oscillator', 'bistability', 'systems-biology'],
};

export default spec;
