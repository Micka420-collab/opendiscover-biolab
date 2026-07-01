/**
 * Bioreactor & Fermentation engine — Monod-based bioprocess dynamics.
 *
 * Models microbial growth on a single limiting substrate in three classic
 * reactor operating modes, all integrated with the shared adaptive RK45 solver:
 *
 *   1. BATCH        — closed vessel; substrate is consumed, biomass grows then
 *                     plateaus once the substrate is exhausted.
 *   2. FED-BATCH    — substrate is fed continuously at flow F while the working
 *                     volume V grows (dV/dt = F); no outflow.
 *   3. CHEMOSTAT    — continuous stirred-tank reactor (CSTR) at constant volume
 *                     with dilution rate D = F/V; sterile feed at Sin.
 *
 * Kinetics (specific growth rate, Monod):
 *
 *     mu(S) = muMax * S / (Ks + S)
 *
 * Batch balances:
 *     dX/dt = mu*X
 *     dS/dt = -mu*X / Yxs
 *     dP/dt = alpha*mu*X + beta*X            (Luedeking–Piret product formation)
 *
 * Chemostat adds a dilution term (D):
 *     dX/dt = (mu - D)*X
 *     dS/dt = D*(Sin - S) - mu*X/Yxs
 *     dP/dt = alpha*mu*X + beta*X - D*P
 *
 * Fed-batch tracks a growing volume (D(t) = F/V(t)):
 *     dX/dt = mu*X - (F/V)*X
 *     dS/dt = (F/V)*(Sf - S) - mu*X/Yxs
 *     dP/dt = alpha*mu*X + beta*X - (F/V)*P
 *     dV/dt = F
 *
 * Analytic chemostat steady state (mu = D at a non-trivial steady state):
 *     S* = Ks*D / (muMax - D)
 *     X* = Yxs*(Sin - S*)
 *     Productivity = D * X*
 * Washout occurs when D >= D_crit = muMax*Sin/(Ks+Sin) (>= muMax is a looser,
 * always-sufficient bound): the culture cannot grow fast enough to replace the
 * cells swept out, so X -> 0 and S -> Sin.
 *
 * Assumptions: single limiting substrate, constant yield Yxs, no maintenance /
 * endogenous decay, perfectly mixed reactor, no inhibition, isothermal. These
 * are the standard first-course fermentation assumptions (Bailey & Ollis;
 * Shuler & Kargi; Doran, "Bioprocess Engineering Principles").
 *
 * Determinism: the dynamics are a pure ODE. An optional multiplicative sensor
 * noise channel (sensorNoiseCv) adds a reproducible "measured biomass" series
 * drawn from the shared seeded RNG — same seed => identical output.
 */

import { z } from 'zod';
import { type Derivative, type OdeTrajectory, rk45 } from '../core/ode';
import { createRng } from '../core/prng';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const paramsSchema = z
  .object({
    /** Reactor operating mode. */
    mode: z.enum(['batch', 'fedbatch', 'chemostat']).default('batch'),

    // --- kinetics & stoichiometry ---
    /** Maximum specific growth rate (1/h). */
    muMax: z.number().positive().default(0.4),
    /** Monod half-saturation constant (g/L). */
    ks: z.number().positive().default(0.5),
    /** Biomass yield on substrate (g biomass / g substrate). */
    yxs: z.number().positive().default(0.5),
    /** Growth-associated product coefficient (g product / g biomass). */
    alpha: z.number().min(0).default(0.2),
    /** Non-growth-associated product coefficient (g product / g biomass / h). */
    beta: z.number().min(0).default(0),

    // --- initial conditions ---
    /** Initial biomass concentration (g/L). */
    x0: z.number().min(0).default(0.1),
    /** Initial substrate concentration (g/L). */
    s0: z.number().min(0).default(10),
    /** Initial product concentration (g/L). */
    p0: z.number().min(0).default(0),
    /** Simulation horizon (h). */
    tEnd: z.number().positive().default(24),

    // --- chemostat ---
    /** Dilution rate D = F/V (1/h). */
    d: z.number().min(0).default(0.2),
    /** Feed substrate concentration for the CSTR (g/L). */
    sin: z.number().min(0).default(10),

    // --- fed-batch ---
    /** Volumetric feed rate F (L/h). */
    feedRate: z.number().min(0).default(0.05),
    /** Substrate concentration in the fed-batch feed (g/L). */
    feedSubstrate: z.number().min(0).default(200),
    /** Initial working volume (L). */
    v0: z.number().positive().default(1),

    // --- numerics & measurement ---
    /** Number of evenly-spaced output samples for the series. */
    outputPoints: z.number().int().positive().max(5000).default(300),
    /** RK45 relative/absolute tolerance. */
    tol: z.number().positive().default(1e-8),
    /** Multiplicative sensor-noise coefficient of variation (0 = ideal sensor). */
    sensorNoiseCv: z.number().min(0).default(0),
    /** RNG seed for the (optional) sensor noise channel. */
    seed: z.number().int().default(12345),
  })
  .strict();

export type BioreactorParams = z.infer<typeof paramsSchema>;

// ---------------------------------------------------------------------------
// Core scientific functions (exported individually for reuse & testing)
// ---------------------------------------------------------------------------

/** Monod specific growth rate mu(S) = muMax * S / (Ks + S). */
export function monodMu(muMax: number, ks: number, s: number): number {
  const S = Math.max(s, 0);
  return (muMax * S) / (ks + S);
}

/**
 * Critical dilution rate above which a chemostat washes out.
 * D_crit is the growth rate attainable at the feed concentration Sin.
 */
export function criticalDilutionRate(muMax: number, ks: number, sin: number): number {
  return (muMax * sin) / (ks + sin);
}

export interface ChemostatSteadyState {
  /** Residual substrate at steady state (g/L). */
  sStar: number;
  /** Steady-state biomass (g/L). */
  xStar: number;
  /** Volumetric biomass productivity D*X* (g/L/h). */
  productivity: number;
  /** True when the operating point washes the culture out. */
  washout: boolean;
  /** Critical dilution rate (1/h). */
  dCrit: number;
}

/**
 * Analytic chemostat steady state. At a non-trivial steady state mu = D, giving
 * S* = Ks*D/(muMax-D) and X* = Yxs*(Sin-S*). If D exceeds the critical dilution
 * rate the only stable state is washout (X* = 0, S* = Sin).
 */
export function chemostatSteadyState(
  muMax: number,
  ks: number,
  yxs: number,
  sin: number,
  d: number,
): ChemostatSteadyState {
  const dCrit = criticalDilutionRate(muMax, ks, sin);
  if (d >= dCrit || d >= muMax) {
    return { sStar: sin, xStar: 0, productivity: 0, washout: true, dCrit };
  }
  const sStar = (ks * d) / (muMax - d);
  const xStar = yxs * (sin - sStar);
  return { sStar, xStar, productivity: d * xStar, washout: false, dCrit };
}

/** Batch state derivative for y = [X, S, P]. */
export function batchDerivative(p: BioreactorParams): Derivative {
  return (_t, y) => {
    const X = y[0] ?? 0;
    const S = y[1] ?? 0;
    const mu = monodMu(p.muMax, p.ks, S);
    return [mu * X, (-mu * X) / p.yxs, p.alpha * mu * X + p.beta * X];
  };
}

/** Chemostat (CSTR) state derivative for y = [X, S, P] at fixed volume. */
export function chemostatDerivative(p: BioreactorParams): Derivative {
  return (_t, y) => {
    const X = y[0] ?? 0;
    const S = y[1] ?? 0;
    const P = y[2] ?? 0;
    const mu = monodMu(p.muMax, p.ks, S);
    return [
      (mu - p.d) * X,
      p.d * (p.sin - S) - (mu * X) / p.yxs,
      p.alpha * mu * X + p.beta * X - p.d * P,
    ];
  };
}

/** Fed-batch state derivative for y = [X, S, P, V] with growing volume. */
export function fedBatchDerivative(p: BioreactorParams): Derivative {
  return (_t, y) => {
    const X = y[0] ?? 0;
    const S = y[1] ?? 0;
    const P = y[2] ?? 0;
    const V = y[3] ?? 1;
    const D = p.feedRate / V; // instantaneous dilution from the growing volume
    const mu = monodMu(p.muMax, p.ks, S);
    return [
      mu * X - D * X,
      D * (p.feedSubstrate - S) - (mu * X) / p.yxs,
      p.alpha * mu * X + p.beta * X - D * P,
      p.feedRate,
    ];
  };
}

/** Integrate a mode's ODE with the shared adaptive RK45 solver. */
function integrate(f: Derivative, y0: number[], p: BioreactorParams): OdeTrajectory {
  return rk45(f, y0, 0, p.tEnd, { tol: p.tol, outputPoints: p.outputPoints });
}

export function simulateBatch(p: BioreactorParams): OdeTrajectory {
  return integrate(batchDerivative(p), [p.x0, p.s0, p.p0], p);
}

export function simulateChemostat(p: BioreactorParams): OdeTrajectory {
  return integrate(chemostatDerivative(p), [p.x0, p.s0, p.p0], p);
}

export function simulateFedBatch(p: BioreactorParams): OdeTrajectory {
  return integrate(fedBatchDerivative(p), [p.x0, p.s0, p.p0, p.v0], p);
}

// ---------------------------------------------------------------------------
// Helpers for assembling the SimResult
// ---------------------------------------------------------------------------

/** Extract a state component column from a trajectory. */
function col(traj: OdeTrajectory, i: number): number[] {
  return traj.y.map((row) => row[i] ?? 0);
}

/** Last value of a series (trajectories are always non-empty here). */
function last(a: number[]): number {
  return a[a.length - 1] ?? 0;
}

/**
 * First time the substrate falls to/below `threshold`, via linear interpolation
 * between the bracketing samples. Returns null if it never does.
 */
function crossingTime(t: number[], s: number[], threshold: number): number | null {
  for (let i = 1; i < s.length; i++) {
    const s1 = s[i] ?? 0;
    if (s1 <= threshold) {
      const s0 = s[i - 1] ?? s1;
      const ti = t[i] ?? 0;
      if (s0 === s1) return ti;
      const frac = (s0 - threshold) / (s0 - s1);
      return (t[i - 1] ?? 0) + frac * (ti - (t[i - 1] ?? 0));
    }
  }
  return null;
}

/** Optional reproducible "measured biomass" channel with multiplicative noise. */
function measuredBiomass(x: number[], cv: number, seed: number): number[] | null {
  if (cv <= 0) return null;
  const rng = createRng(seed);
  return x.map((v) => Math.max(0, v * (1 + rng.normal(0, cv))));
}

// ---------------------------------------------------------------------------
// Engine entry point
// ---------------------------------------------------------------------------

function runBatch(p: BioreactorParams): SimResult {
  const traj = simulateBatch(p);
  const t = traj.t;
  const X = col(traj, 0);
  const S = col(traj, 1);
  const P = col(traj, 2);

  const finalBiomass = last(X);
  const finalSubstrate = last(S);
  const finalProduct = last(P);
  const maxBiomass = Math.max(...X);

  // Substrate exhaustion: 1% of the initial charge (Monod decay is asymptotic).
  const threshold = Math.max(1e-4, 0.01 * p.s0);
  const tExhaust = crossingTime(t, S, threshold);

  // Mass-balance invariant: X + Yxs*S is conserved for batch growth.
  const invariant0 = p.x0 + p.yxs * p.s0;
  const invariantEnd = finalBiomass + p.yxs * finalSubstrate;
  const massBalanceError = invariantEnd - invariant0;

  const metrics: Metric[] = [
    { key: 'finalBiomass', label: 'Final biomass', value: finalBiomass, unit: 'g/L' },
    {
      key: 'timeToSubstrateExhaustion',
      label: 'Time to substrate exhaustion',
      value: tExhaust ?? p.tEnd,
      unit: 'h',
      note:
        tExhaust === null
          ? 'substrate not exhausted within tEnd'
          : `S < ${threshold.toPrecision(2)} g/L`,
    },
    { key: 'finalSubstrate', label: 'Residual substrate', value: finalSubstrate, unit: 'g/L' },
    { key: 'finalProduct', label: 'Final product', value: finalProduct, unit: 'g/L' },
    { key: 'maxBiomass', label: 'Peak biomass', value: maxBiomass, unit: 'g/L' },
    {
      key: 'massBalanceError',
      label: 'Mass-balance residual',
      value: massBalanceError,
      unit: 'g/L',
      note: 'X + Yxs*S conserved; ~0 confirms consistency',
    },
  ];

  const y: Record<string, number[]> = { X, S, P };
  const measured = measuredBiomass(X, p.sensorNoiseCv, p.seed);
  if (measured) y.measuredBiomass = measured;
  const series: Series[] = [{ x: t, y, xLabel: 'time (h)', yLabel: 'concentration (g/L)' }];

  return {
    engine: 'bioreactor',
    summary: `Batch fermentation: biomass ${finalBiomass.toFixed(2)} g/L${
      tExhaust !== null ? `, substrate exhausted at ${tExhaust.toFixed(1)} h` : ''
    }.`,
    metrics,
    series,
    detail: { mode: 'batch', invariant0, invariantEnd },
    provenance: provenance('bioreactor', '1.0.0', p, p.seed),
  };
}

function runChemostat(p: BioreactorParams): SimResult {
  const ss = chemostatSteadyState(p.muMax, p.ks, p.yxs, p.sin, p.d);
  const traj = simulateChemostat(p);
  const t = traj.t;
  const X = col(traj, 0);
  const S = col(traj, 1);
  const P = col(traj, 2);

  const simBiomass = last(X);
  const simSubstrate = last(S);

  const metrics: Metric[] = [
    {
      key: 'steadyStateBiomass',
      label: 'Steady-state biomass X*',
      value: ss.xStar,
      unit: 'g/L',
      note: 'analytic Yxs*(Sin - S*)',
    },
    {
      key: 'steadyStateSubstrate',
      label: 'Steady-state substrate S*',
      value: ss.sStar,
      unit: 'g/L',
      note: 'analytic Ks*D/(muMax - D)',
    },
    {
      key: 'productivity',
      label: 'Biomass productivity D*X*',
      value: ss.productivity,
      unit: 'g/L/h',
    },
    {
      key: 'criticalDilutionRate',
      label: 'Critical dilution rate',
      value: ss.dCrit,
      unit: '1/h',
      note: 'washout for D >= D_crit',
    },
    { key: 'washout', label: 'Washout', value: ss.washout ? 1 : 0, note: '1 = culture washed out' },
    {
      key: 'simulatedBiomass',
      label: 'Simulated biomass (t=tEnd)',
      value: simBiomass,
      unit: 'g/L',
    },
    {
      key: 'simulatedSubstrate',
      label: 'Simulated substrate (t=tEnd)',
      value: simSubstrate,
      unit: 'g/L',
    },
  ];

  const y: Record<string, number[]> = { X, S, P };
  const measured = measuredBiomass(X, p.sensorNoiseCv, p.seed);
  if (measured) y.measuredBiomass = measured;
  const series: Series[] = [{ x: t, y, xLabel: 'time (h)', yLabel: 'concentration (g/L)' }];

  return {
    engine: 'bioreactor',
    summary: ss.washout
      ? `Chemostat washout: D=${p.d} 1/h >= D_crit=${ss.dCrit.toFixed(3)} 1/h, biomass -> 0.`
      : `Chemostat steady state: X*=${ss.xStar.toFixed(2)} g/L, S*=${ss.sStar.toFixed(3)} g/L, productivity ${ss.productivity.toFixed(3)} g/L/h.`,
    metrics,
    series,
    detail: { mode: 'chemostat', ...ss },
    provenance: provenance('bioreactor', '1.0.0', p, p.seed),
  };
}

function runFedBatch(p: BioreactorParams): SimResult {
  const traj = simulateFedBatch(p);
  const t = traj.t;
  const X = col(traj, 0);
  const S = col(traj, 1);
  const P = col(traj, 2);
  const V = col(traj, 3);

  const finalVolume = last(V);
  const finalBiomassConc = last(X);
  const finalBiomassMass = finalBiomassConc * finalVolume;
  const finalSubstrate = last(S);
  const finalProduct = last(P);

  // Fed-batch mass balance: m_S + m_X/Yxs - F*Sf*t is conserved.
  const fedSubstrate = p.feedRate * p.feedSubstrate * p.tEnd;
  const inv0 = p.s0 * p.v0 + (p.x0 * p.v0) / p.yxs;
  const invEnd = finalSubstrate * finalVolume + finalBiomassMass / p.yxs - fedSubstrate;
  const massBalanceError = invEnd - inv0;

  const metrics: Metric[] = [
    { key: 'finalBiomass', label: 'Final biomass', value: finalBiomassConc, unit: 'g/L' },
    { key: 'finalBiomassMass', label: 'Total biomass', value: finalBiomassMass, unit: 'g' },
    { key: 'finalVolume', label: 'Final volume', value: finalVolume, unit: 'L' },
    { key: 'finalSubstrate', label: 'Residual substrate', value: finalSubstrate, unit: 'g/L' },
    { key: 'finalProduct', label: 'Final product', value: finalProduct, unit: 'g/L' },
    {
      key: 'massBalanceError',
      label: 'Mass-balance residual',
      value: massBalanceError,
      unit: 'g',
      note: 'm_S + m_X/Yxs - F*Sf*t conserved; ~0 confirms consistency',
    },
  ];

  const y: Record<string, number[]> = { X, S, P, V };
  const measured = measuredBiomass(X, p.sensorNoiseCv, p.seed);
  if (measured) y.measuredBiomass = measured;
  const series: Series[] = [
    { x: t, y, xLabel: 'time (h)', yLabel: 'concentration (g/L) / volume (L)' },
  ];

  return {
    engine: 'bioreactor',
    summary: `Fed-batch: biomass ${finalBiomassConc.toFixed(2)} g/L (${finalBiomassMass.toFixed(1)} g) in ${finalVolume.toFixed(2)} L.`,
    metrics,
    series,
    detail: { mode: 'fedbatch', fedSubstrate },
    provenance: provenance('bioreactor', '1.0.0', p, p.seed),
  };
}

/** Pure, deterministic entry point. Validates & applies defaults, then dispatches. */
export function run(rawParams: Partial<BioreactorParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  switch (p.mode) {
    case 'chemostat':
      return runChemostat(p);
    case 'fedbatch':
      return runFedBatch(p);
    default:
      return runBatch(p);
  }
}

// ---------------------------------------------------------------------------
// Engine spec
// ---------------------------------------------------------------------------

export const spec: EngineSpec<BioreactorParams> = {
  slug: 'bioreactor',
  title: 'Bioreactor & Fermentation',
  domain: 'bioprocess',
  version: '1.0.0',
  description:
    'Monod-based microbial growth in batch, fed-batch, and chemostat (CSTR) reactors. Integrates the biomass/substrate/product balances with adaptive RK45 and reports analytic chemostat steady states (S* = Ks*D/(muMax-D), X* = Yxs*(Sin-S*)), washout thresholds, and mass-balance-consistent batch trajectories.',
  references: [
    'Monod, J. (1949) The growth of bacterial cultures. Annu. Rev. Microbiol. 3:371-394.',
    'Bailey, J.E. & Ollis, D.F. (1986) Biochemical Engineering Fundamentals, 2nd ed.',
    'Shuler, M.L. & Kargi, F. (2002) Bioprocess Engineering: Basic Concepts, 2nd ed.',
    'Doran, P.M. (2013) Bioprocess Engineering Principles, 2nd ed.',
  ],
  // Cast narrows the parse-input generic: the schema uses zod defaults (making
  // inputs optional) while EngineSpec pins z.ZodType<TParams>. The *output* type
  // is exactly BioreactorParams, so this is sound.
  paramsSchema: paramsSchema as z.ZodType<BioreactorParams>,
  run,
  example: paramsSchema.parse({
    mode: 'chemostat',
    muMax: 0.4,
    ks: 0.5,
    yxs: 0.5,
    sin: 10,
    d: 0.2,
    x0: 0.1,
    s0: 10,
    tEnd: 200,
  }),
  tags: [
    'bioprocess',
    'fermentation',
    'monod',
    'chemostat',
    'fed-batch',
    'CSTR',
    'growth-kinetics',
  ],
};

export default spec;
