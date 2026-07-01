/**
 * Gillespie Stochastic Simulation Algorithm (SSA) — direct method.
 *
 * This engine produces an *exact* realisation of the Chemical Master Equation
 * (CME) for a well-mixed system of reacting species. Instead of integrating
 * average concentrations (an ODE), it evolves discrete, non-negative integer
 * molecule counts one reaction event at a time, which is the correct picture
 * when copy numbers are small — the regime of gene expression, single-cell
 * biology, and low-count signalling where intrinsic noise dominates.
 *
 * Direct method (Gillespie 1977):
 *   1. From state X, compute the propensity a_j(X) of every reaction j.
 *      For mass-action kinetics a_j = c_j * (# distinct reactant combinations).
 *   2. Let a0 = Σ_j a_j. If a0 = 0 the system is absorbing and time stops.
 *   3. Draw the waiting time to the next event  τ ~ Exponential(a0).
 *   4. Draw which reaction fires  P(j) = a_j / a0  (weighted choice).
 *   5. Advance t <- t + τ, apply reaction j's net stoichiometry, repeat.
 *
 * Because τ is exponential and the reaction index is chosen proportional to its
 * propensity, the generated trajectory is statistically exact for the CME — no
 * time-step discretisation error, unlike tau-leaping or ODE methods.
 *
 * Determinism: all randomness comes from `createRng(seed)` in the core PRNG, so
 * a given (model, seed) reproduces the trajectory byte-for-byte.
 *
 * Assumptions / limitations:
 *   - Well-mixed, constant volume, mass-action propensities.
 *   - Rate constants are already expressed in stochastic (per-copy) units.
 *   - Counts are non-negative integers at all times (guaranteed: a reaction
 *     whose reactants are not all present has propensity 0 and cannot fire).
 *
 * References:
 *   - Gillespie, D.T. (1977) "Exact Stochastic Simulation of Coupled Chemical
 *     Reactions", J. Phys. Chem. 81(25):2340–2361.
 *   - Gillespie, D.T. (2007) "Stochastic Simulation of Chemical Kinetics",
 *     Annu. Rev. Phys. Chem. 58:35–55.
 *   - Wilkinson, D.J. (2018) "Stochastic Modelling for Systems Biology", 3rd ed.
 */

import { z } from 'zod';
import { createRng } from '../core/prng';
import type { EngineSpec, SimResult } from '../core/types';
import { provenance } from '../core/types';

// ---------------------------------------------------------------------------
// Model types
// ---------------------------------------------------------------------------

/** A single mass-action reaction. Stoichiometries are keyed by species name. */
export interface Reaction {
  /** Optional human-readable label (e.g. "birth", "predation"). */
  name?: string;
  /** Reactant species and how many copies each event consumes. */
  reactants: Record<string, number>;
  /** Product species and how many copies each event produces. */
  products: Record<string, number>;
  /** Stochastic rate constant c_j (units depend on molecularity). */
  rate: number;
}

/** A reaction network: initial integer counts plus a list of reactions. */
export interface GillespieModel {
  /** Initial molecule counts keyed by species name. */
  species: Record<string, number>;
  /** Reaction channels. */
  reactions: Reaction[];
}

/** Output of a raw SSA run (before packaging into a SimResult). */
export interface SsaTrajectory {
  /** Species names in the fixed column order used by `counts`. */
  species: string[];
  /** Event times; `t[0] = 0`. When the horizon is reached the final entry is tMax. */
  t: number[];
  /** `counts[i]` is the integer state vector on the interval [t[i], t[i+1]). */
  counts: number[][];
  /** Number of reaction events that fired. */
  numReactions: number;
  /** True if total propensity hit zero (absorbing state) before tMax. */
  halted: boolean;
  /** True if the `maxSteps` safety cap was hit before tMax. */
  reachedMaxSteps: boolean;
  /** Simulated time actually covered by the trajectory. */
  endTime: number;
}

// ---------------------------------------------------------------------------
// Core simulation
// ---------------------------------------------------------------------------

/** Precompiled reaction: consumption + net-change vectors in species order. */
interface CompiledReaction {
  rate: number;
  /** Copies of each species consumed (for the propensity combinatorics). */
  consume: number[];
  /** Net change to each species when the reaction fires (products − reactants). */
  net: number[];
}

/** n! for the small stoichiometric coefficients that appear in propensities. */
function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/**
 * Run the Gillespie direct method.
 *
 * @param model  Reaction network with initial counts.
 * @param opts   tMax (horizon), seed (PRNG seed), maxSteps (safety cap).
 */
export function simulateSSA(
  model: GillespieModel,
  opts: { tMax: number; seed: number | string; maxSteps?: number },
): SsaTrajectory {
  const { tMax } = opts;
  const maxSteps = opts.maxSteps ?? 1_000_000;
  const rng = createRng(opts.seed);

  const species = Object.keys(model.species);
  const S = species.length;

  // Compile each reaction into dense consumption / net-change vectors so the
  // hot loop does no map lookups.
  const reactions: CompiledReaction[] = model.reactions.map((r) => {
    const consume = species.map((s) => r.reactants[s] ?? 0);
    const net = species.map((s) => (r.products[s] ?? 0) - (r.reactants[s] ?? 0));
    return { rate: r.rate, consume, net };
  });

  const state = species.map((s) => model.species[s] ?? 0);
  let time = 0;
  const t: number[] = [0];
  const counts: number[][] = [[...state]];
  let numReactions = 0;
  let halted = false;
  let reachedMaxSteps = false;

  // Mass-action propensity: rate * Π_s C(X_s, ν_s), where C is the number of
  // distinct ways to choose ν_s reactant molecules of species s.
  const propensityOf = (rxn: CompiledReaction): number => {
    let a = rxn.rate;
    for (let i = 0; i < S; i++) {
      const need = rxn.consume[i] ?? 0;
      if (need === 0) continue;
      const have = state[i] ?? 0;
      if (have < need) return 0;
      // Falling factorial have*(have-1)*...*(have-need+1) / need!
      let ff = 1;
      for (let m = 0; m < need; m++) ff *= have - m;
      a *= ff / factorial(need);
    }
    return a;
  };

  const propensities = new Array<number>(reactions.length).fill(0);

  while (time < tMax) {
    let a0 = 0;
    for (let j = 0; j < reactions.length; j++) {
      const aj = propensityOf(reactions[j] as CompiledReaction);
      propensities[j] = aj;
      a0 += aj;
    }

    // Absorbing state: no reaction can ever fire again.
    if (a0 <= 0) {
      halted = true;
      break;
    }

    // Time to next reaction ~ Exponential(a0).
    const tau = rng.exponential(a0);
    if (time + tau >= tMax) {
      // Next event would land beyond the horizon: nothing more happens.
      break;
    }
    time += tau;

    // Choose the reaction that fires, weighted by propensity.
    const chosen = rng.weightedPick(reactions, propensities);
    for (let i = 0; i < S; i++) state[i] = (state[i] ?? 0) + (chosen.net[i] ?? 0);

    numReactions++;
    t.push(time);
    counts.push([...state]);

    if (numReactions >= maxSteps) {
      reachedMaxSteps = true;
      break;
    }
  }

  // If we reached the time horizon (not the step cap), record a terminal sample
  // at tMax holding the final state so the last dwell interval is represented.
  let endTime = time;
  if (!reachedMaxSteps) {
    endTime = tMax;
    const lastT = t[t.length - 1] ?? 0;
    if (lastT < tMax) {
      t.push(tMax);
      counts.push([...state]);
    }
  }

  return { species, t, counts, numReactions, halted, reachedMaxSteps, endTime };
}

// ---------------------------------------------------------------------------
// Trajectory statistics
// ---------------------------------------------------------------------------

/**
 * Time-weighted mean of one species over the tail of a trajectory.
 *
 * A step trajectory spends unequal amounts of time in each state, so the
 * ergodic (long-run) average must weight each recorded count by its dwell time
 * dt = t[i+1] − t[i], not by the number of samples. `fromTime` discards a
 * burn-in transient.
 */
export function timeWeightedMean(t: number[], values: number[], fromTime = 0): number {
  let num = 0;
  let den = 0;
  for (let i = 0; i < t.length - 1; i++) {
    const t1 = t[i + 1] ?? 0;
    if (t1 <= fromTime) continue;
    const t0 = Math.max(t[i] ?? 0, fromTime);
    const dt = t1 - t0;
    if (dt <= 0) continue;
    num += (values[i] ?? 0) * dt;
    den += dt;
  }
  return den > 0 ? num / den : (values[values.length - 1] ?? 0);
}

/** Time-weighted variance of one species over the tail (E[X²]−E[X]²). */
export function timeWeightedVariance(t: number[], values: number[], fromTime = 0): number {
  const mean = timeWeightedMean(t, values, fromTime);
  let num = 0;
  let den = 0;
  for (let i = 0; i < t.length - 1; i++) {
    const t1 = t[i + 1] ?? 0;
    if (t1 <= fromTime) continue;
    const t0 = Math.max(t[i] ?? 0, fromTime);
    const dt = t1 - t0;
    if (dt <= 0) continue;
    const d = (values[i] ?? 0) - mean;
    num += d * d * dt;
    den += dt;
  }
  return den > 0 ? num / den : 0;
}

/** Extract one species' count column across the whole trajectory. */
export function speciesColumn(traj: SsaTrajectory, name: string): number[] {
  const idx = traj.species.indexOf(name);
  if (idx < 0) throw new Error(`speciesColumn: unknown species "${name}"`);
  return traj.counts.map((row) => row[idx] ?? 0);
}

// ---------------------------------------------------------------------------
// Preset reaction networks
// ---------------------------------------------------------------------------

/**
 * Immigration–death (birth–death) process:
 *   ∅ --k-->  X        (birth, constant propensity k)
 *   X --γ-->  ∅        (death, propensity γ·X)
 *
 * Stationary distribution is Poisson with mean k/γ, so the long-run mean count
 * is exactly k/γ and the variance equals the mean.
 */
export function birthDeathModel(
  opts: { k?: number; gamma?: number; x0?: number } = {},
): GillespieModel {
  const k = opts.k ?? 10;
  const gamma = opts.gamma ?? 1;
  const x0 = opts.x0 ?? 0;
  return {
    species: { X: x0 },
    reactions: [
      { name: 'birth', reactants: {}, products: { X: 1 }, rate: k },
      { name: 'death', reactants: { X: 1 }, products: {}, rate: gamma },
    ],
  };
}

/**
 * Stochastic Lotka–Volterra predator–prey:
 *   Prey            --α-->  2 Prey            (prey reproduction, α·Prey)
 *   Prey + Predator --β-->  2 Predator        (predation,        β·Prey·Predator)
 *   Predator        --δ-->  ∅                 (predator death,   δ·Predator)
 *
 * The deterministic mean-field ODEs have a neutrally-stable fixed point at
 *   Prey* = δ/β,   Predator* = α/β,
 * about which the stochastic system oscillates with fluctuating amplitude.
 */
export function lotkaVolterraModel(
  opts: { alpha?: number; beta?: number; delta?: number; prey0?: number; predator0?: number } = {},
): GillespieModel {
  const alpha = opts.alpha ?? 1;
  const beta = opts.beta ?? 0.01;
  const delta = opts.delta ?? 1;
  const prey0 = opts.prey0 ?? Math.round(delta / beta); // start at the fixed point
  const predator0 = opts.predator0 ?? Math.round(alpha / beta);
  return {
    species: { Prey: prey0, Predator: predator0 },
    reactions: [
      { name: 'preyBirth', reactants: { Prey: 1 }, products: { Prey: 2 }, rate: alpha },
      {
        name: 'predation',
        reactants: { Prey: 1, Predator: 1 },
        products: { Predator: 2 },
        rate: beta,
      },
      { name: 'predatorDeath', reactants: { Predator: 1 }, products: {}, rate: delta },
    ],
  };
}

/** Deterministic mean-field coexistence fixed point of the LV model above. */
export function lotkaVolterraFixedPoint(
  opts: { alpha?: number; beta?: number; delta?: number } = {},
): {
  prey: number;
  predator: number;
} {
  const alpha = opts.alpha ?? 1;
  const beta = opts.beta ?? 0.01;
  const delta = opts.delta ?? 1;
  return { prey: delta / beta, predator: alpha / beta };
}

/**
 * Two-state ("telegraph") gene expression with bursting:
 *   Goff --k_on-->  Gon                    gene activation
 *   Gon  --k_off--> Goff                   gene inactivation
 *   Gon  --k_m-->   Gon + mRNA             transcription (only when ON)
 *   mRNA --γ_m-->   ∅                      mRNA decay
 *   mRNA --k_p-->   mRNA + Protein         translation
 *   Protein --γ_p--> ∅                     protein decay
 *
 * Promoter switching makes transcription intermittent, so mRNA/protein arrive in
 * bursts rather than at a steady trickle. Because every propensity is at most
 * first-order, the *mean* equations close exactly, giving steady-state values:
 *   P(on)      = k_on / (k_on + k_off)
 *   ⟨mRNA⟩     = k_m · P(on) / γ_m
 *   ⟨Protein⟩  = k_p · ⟨mRNA⟩ / γ_p
 */
export function geneExpressionBurstingModel(
  opts: {
    kOn?: number;
    kOff?: number;
    kM?: number;
    gammaM?: number;
    kP?: number;
    gammaP?: number;
  } = {},
): GillespieModel {
  const kOn = opts.kOn ?? 1;
  const kOff = opts.kOff ?? 1;
  const kM = opts.kM ?? 20;
  const gammaM = opts.gammaM ?? 2;
  const kP = opts.kP ?? 2;
  const gammaP = opts.gammaP ?? 1;
  return {
    species: { Goff: 1, Gon: 0, mRNA: 0, Protein: 0 },
    reactions: [
      { name: 'activate', reactants: { Goff: 1 }, products: { Gon: 1 }, rate: kOn },
      { name: 'deactivate', reactants: { Gon: 1 }, products: { Goff: 1 }, rate: kOff },
      { name: 'transcribe', reactants: { Gon: 1 }, products: { Gon: 1, mRNA: 1 }, rate: kM },
      { name: 'mRNADecay', reactants: { mRNA: 1 }, products: {}, rate: gammaM },
      { name: 'translate', reactants: { mRNA: 1 }, products: { mRNA: 1, Protein: 1 }, rate: kP },
      { name: 'proteinDecay', reactants: { Protein: 1 }, products: {}, rate: gammaP },
    ],
  };
}

/** Analytic steady-state means of the telegraph model (used for validation). */
export function geneExpressionSteadyState(
  opts: {
    kOn?: number;
    kOff?: number;
    kM?: number;
    gammaM?: number;
    kP?: number;
    gammaP?: number;
  } = {},
): { fractionOn: number; mRNA: number; protein: number } {
  const kOn = opts.kOn ?? 1;
  const kOff = opts.kOff ?? 1;
  const kM = opts.kM ?? 20;
  const gammaM = opts.gammaM ?? 2;
  const kP = opts.kP ?? 2;
  const gammaP = opts.gammaP ?? 1;
  const fractionOn = kOn / (kOn + kOff);
  const mRNA = (kM * fractionOn) / gammaM;
  const protein = (kP * mRNA) / gammaP;
  return { fractionOn, mRNA, protein };
}

// ---------------------------------------------------------------------------
// Parameter schema & preset resolution
// ---------------------------------------------------------------------------

const PRESETS = ['birthDeath', 'lotkaVolterra', 'geneExpressionBursting'] as const;
type Preset = (typeof PRESETS)[number];

const reactionSchema = z.object({
  name: z.string().optional(),
  reactants: z.record(z.string(), z.number().int().nonnegative()).default({}),
  products: z.record(z.string(), z.number().int().nonnegative()).default({}),
  rate: z.number().positive(),
});

const modelSchema = z.object({
  species: z.record(z.string(), z.number().int().nonnegative()),
  reactions: z.array(reactionSchema).min(1),
});

export const gillespieParamsSchema = z
  .object({
    /** Named preset network. Ignored if `model` is supplied. */
    preset: z.enum(PRESETS).optional(),
    /** Numeric overrides forwarded to the preset builder (k, gamma, alpha, ...). */
    presetParams: z.record(z.string(), z.number()).optional(),
    /** A fully custom reaction network (takes precedence over `preset`). */
    model: modelSchema.optional(),
    /** Simulation horizon in the model's time units. */
    tMax: z.number().positive().default(50),
    /** PRNG seed for reproducibility. */
    seed: z.union([z.number(), z.string()]).default(42),
    /** Fraction of the run discarded as burn-in before computing tail means. */
    burnInFraction: z.number().min(0).max(0.9).default(0.2),
    /** Hard cap on reaction events (guards against runaway networks). */
    maxSteps: z.number().int().positive().default(2_000_000),
    /** Maximum points kept in the output series (trajectory is downsampled). */
    maxSeriesPoints: z.number().int().positive().default(500),
  })
  .refine((p) => p.preset !== undefined || p.model !== undefined, {
    message: 'Provide either a `preset` or a custom `model`.',
  });

export type GillespieParams = z.input<typeof gillespieParamsSchema>;
type ResolvedParams = z.output<typeof gillespieParamsSchema>;

/** Resolve params into a concrete model plus the "headline" species to report. */
function resolveModel(p: ResolvedParams): {
  model: GillespieModel;
  primary: string;
  label: string;
} {
  if (p.model) {
    const first = Object.keys(p.model.species)[0] ?? 'species';
    return { model: p.model, primary: first, label: 'custom network' };
  }
  const pp = p.presetParams ?? {};
  switch (p.preset as Preset) {
    case 'birthDeath':
      return { model: birthDeathModel(pp), primary: 'X', label: 'birth–death process' };
    case 'lotkaVolterra':
      return {
        model: lotkaVolterraModel(pp),
        primary: 'Prey',
        label: 'Lotka–Volterra predator–prey',
      };
    case 'geneExpressionBursting':
      return {
        model: geneExpressionBurstingModel(pp),
        primary: 'Protein',
        label: 'bursting gene expression',
      };
    default:
      // Unreachable because the schema refine guarantees preset or model.
      throw new Error('resolveModel: no preset or model provided');
  }
}

// ---------------------------------------------------------------------------
// Series downsampling
// ---------------------------------------------------------------------------

/** Evenly-spaced indices into [0, n) keeping first & last, at most maxPoints. */
function downsampleIndices(n: number, maxPoints: number): number[] {
  if (n <= maxPoints) return Array.from({ length: n }, (_, i) => i);
  const seen = new Set<number>();
  const out: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i * (n - 1)) / (maxPoints - 1));
    if (!seen.has(idx)) {
      seen.add(idx);
      out.push(idx);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Engine entry point
// ---------------------------------------------------------------------------

interface GillespieDetail {
  model: string;
  species: string[];
  numReactions: number;
  halted: boolean;
  reachedMaxSteps: boolean;
  endTime: number;
  finalCounts: Record<string, number>;
  /** Time-weighted tail mean per species. */
  tailMeans: Record<string, number>;
}

function runGillespie(rawParams: GillespieParams): SimResult<GillespieDetail> {
  const p = gillespieParamsSchema.parse(rawParams);
  const { model, primary, label } = resolveModel(p);

  const traj = simulateSSA(model, { tMax: p.tMax, seed: p.seed, maxSteps: p.maxSteps });
  const fromTime = p.burnInFraction * traj.endTime;

  // Time-weighted tail means & final counts for every species.
  const tailMeans: Record<string, number> = {};
  const finalCounts: Record<string, number> = {};
  const lastRow = traj.counts[traj.counts.length - 1] ?? [];
  for (let i = 0; i < traj.species.length; i++) {
    const name = traj.species[i] as string;
    const col = traj.counts.map((row) => row[i] ?? 0);
    tailMeans[name] = timeWeightedMean(traj.t, col, fromTime);
    finalCounts[name] = lastRow[i] ?? 0;
  }

  // Metrics: a headline mean plus a per-species mean and useful diagnostics.
  const primaryMean = tailMeans[primary] ?? 0;
  const metrics: SimResult['metrics'] = [
    {
      key: 'meanPopulation',
      label: `Mean ${primary} (tail avg)`,
      value: primaryMean,
      note: `Time-weighted average of ${primary} over the final ${((1 - p.burnInFraction) * 100).toFixed(0)}% of the run.`,
    },
    { key: 'numReactions', label: 'Reaction events', value: traj.numReactions },
    { key: 'endTime', label: 'Simulated time', value: traj.endTime },
  ];
  for (const name of traj.species) {
    if (name === primary) continue;
    metrics.push({
      key: `mean_${name}`,
      label: `Mean ${name} (tail avg)`,
      value: tailMeans[name] ?? 0,
    });
  }
  for (const name of traj.species) {
    metrics.push({ key: `final_${name}`, label: `Final ${name}`, value: finalCounts[name] ?? 0 });
  }

  // Build a downsampled step-trajectory series for charting.
  const idx = downsampleIndices(traj.t.length, p.maxSeriesPoints);
  const x = idx.map((i) => traj.t[i] ?? 0);
  const y: Record<string, number[]> = {};
  for (let s = 0; s < traj.species.length; s++) {
    const name = traj.species[s] as string;
    y[name] = idx.map((i) => (traj.counts[i] ?? [])[s] ?? 0);
  }

  const summary = traj.halted
    ? `${label}: reached an absorbing state after ${traj.numReactions} events (t=${traj.endTime.toFixed(2)}); mean ${primary} ≈ ${primaryMean.toFixed(2)}.`
    : `${label}: ${traj.numReactions} reaction events over t=${traj.endTime.toFixed(1)}; mean ${primary} ≈ ${primaryMean.toFixed(2)}.`;

  return {
    engine: 'gillespie',
    summary,
    metrics,
    series: [{ x, y, xLabel: 'time', yLabel: 'molecule count' }],
    detail: {
      model: label,
      species: traj.species,
      numReactions: traj.numReactions,
      halted: traj.halted,
      reachedMaxSteps: traj.reachedMaxSteps,
      endTime: traj.endTime,
      finalCounts,
      tailMeans,
    },
    provenance: provenance('gillespie', '1.0.0', { ...rawParams }, p.seed),
  };
}

// ---------------------------------------------------------------------------
// Engine spec
// ---------------------------------------------------------------------------

export const spec: EngineSpec<GillespieParams, GillespieDetail> = {
  slug: 'gillespie',
  title: 'Gillespie Stochastic SSA',
  domain: 'systems-biology',
  version: '1.0.0',
  description:
    'Exact stochastic simulation of the chemical master equation via Gillespie’s direct ' +
    'method. Evolves discrete molecule counts one reaction at a time, sampling the waiting ' +
    'time from an exponential of the total propensity and the firing reaction proportional to ' +
    'its propensity. Captures intrinsic noise that mean-field ODE models miss. Ships with ' +
    'birth–death, Lotka–Volterra, and bursting gene-expression presets, and accepts ' +
    'arbitrary user-defined reaction networks. Deterministic given a seed.',
  references: [
    'Gillespie, D.T. (1977) J. Phys. Chem. 81(25):2340-2361',
    'Gillespie, D.T. (2007) Annu. Rev. Phys. Chem. 58:35-55',
    'Wilkinson, D.J. (2018) Stochastic Modelling for Systems Biology, 3rd ed.',
  ],
  paramsSchema: gillespieParamsSchema,
  run: runGillespie,
  example: {
    preset: 'birthDeath',
    presetParams: { k: 10, gamma: 1, x0: 0 },
    tMax: 50,
    seed: 42,
  },
  tags: [
    'stochastic',
    'ssa',
    'gillespie',
    'chemical-master-equation',
    'systems-biology',
    'noise',
    'cme',
  ],
};

export default spec;
