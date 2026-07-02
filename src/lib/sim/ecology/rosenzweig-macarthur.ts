/**
 * Rosenzweig–MacArthur predator–prey model.
 *
 * Lotka–Volterra made realistic: the prey grows logistically (self-limiting) and
 * the predator has a saturating Holling type-II functional response (a handling
 * time caps how fast it can eat):
 *
 *     f(N) = a·N / (1 + a·h·N)
 *     dN/dt = r·N·(1 − N/K) − f(N)·P
 *     dP/dt = e·f(N)·P − m·P
 *
 * Unlike Lotka–Volterra's neutral cycles, this has a genuine attractor: a stable
 * coexistence equilibrium OR a stable limit cycle. The famous result is the
 * **paradox of enrichment** (Rosenzweig 1971): raising the prey carrying capacity
 * K — "enriching" the system — DESTABILIZES it, tipping a calm equilibrium into
 * large boom–bust oscillations past a Hopf threshold.
 *
 * Interior equilibrium (exact):
 *     N* = m / (a·(e − m·h))           (needs e > m·h for the predator to persist)
 *     P* = e·r·N*·(1 − N* / K) / m
 * Hopf/enrichment threshold: the equilibrium is stable iff K < K_H = 2·N* + 1/(a·h).
 *
 * Deterministic: a pure ODE integrated with fixed-step RK4.
 *
 * References:
 *   - Rosenzweig, M.L. & MacArthur, R.H. (1963) Graphical representation and
 *     stability conditions of predator-prey interactions. Am. Nat. 97:209-223.
 *   - Rosenzweig, M.L. (1971) Paradox of enrichment. Science 171:385-387.
 *   - Murray, J.D. (2002) Mathematical Biology I, ch. 3.
 */

import { z } from 'zod';
import { type Derivative, rk45 } from '../core/ode';
import { downsampleIndices } from '../core/series';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Prey intrinsic growth rate r. */
    r: z.number().positive().default(1),
    /** Prey carrying capacity K (the "enrichment" knob). */
    k: z.number().min(1e-9).default(6),
    /** Attack rate a. */
    a: z.number().min(1e-9).default(1),
    /** Handling time h > 0 (Holling type-II saturation; h→0 is the linear type-I limit). */
    h: z.number().min(1e-9).default(0.5),
    /** Conversion efficiency e (prey eaten → predators). */
    e: z.number().min(1e-9).default(0.5),
    /** Predator mortality m. */
    m: z.number().positive().default(0.2),
    /** Initial prey N0. */
    n0: z.number().positive().default(1),
    /** Initial predator P0. */
    p0: z.number().positive().default(1),
    /** Integration horizon. */
    tEnd: z.number().positive().max(10_000).default(300),
    /** Adaptive RK45 tolerance. */
    tol: z.number().positive().default(1e-8),
    /** Points kept for the plotted series. */
    outputPoints: z.number().int().positive().max(2000).default(600),
  })
  .strict();

export type RosenzweigMacArthurParams = z.infer<typeof paramsSchema>;

/** Holling type-II functional response f(N) = aN/(1+ahN). */
export function hollingTypeII(a: number, h: number, n: number): number {
  const N = Math.max(n, 0);
  return (a * N) / (1 + a * h * N);
}

/** Derivative for state y = [prey N, predator P]. */
export function rosenzweigMacArthurDerivative(p: RosenzweigMacArthurParams): Derivative {
  return (_t, y) => {
    const N = y[0] ?? 0;
    const P = y[1] ?? 0;
    const f = hollingTypeII(p.a, p.h, N);
    return [p.r * N * (1 - N / p.k) - f * P, p.e * f * P - p.m * P];
  };
}

/** Interior coexistence equilibrium (N*, P*), or null if the predator can't persist. */
export function interiorEquilibrium(p: RosenzweigMacArthurParams): { n: number; p: number } | null {
  const denom = p.a * (p.e - p.m * p.h);
  if (denom <= 0) return null; // e ≤ m·h ⇒ no positive N*
  const nStar = p.m / denom;
  if (nStar >= p.k) return null; // equilibrium beyond carrying capacity
  const pStar = (p.e * p.r * nStar * (1 - nStar / p.k)) / p.m;
  return { n: nStar, p: pStar };
}

function arrayMinMax(a: number[]): { min: number; max: number } {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of a) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

export function run(rawParams: Partial<RosenzweigMacArthurParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  // Adaptive RK45: near a deep boom–bust trough a large fixed step would overshoot
  // N below zero and the logistic term would then run it to −∞; the adaptive
  // stepper tracks the (always-positive) true solution instead.
  const traj = rk45(rosenzweigMacArthurDerivative(p), [p.n0, p.p0], 0, p.tEnd, {
    tol: p.tol,
    outputPoints: p.outputPoints,
  });
  // Populations are physical: clamp to ≥0 to guard against any tiny numerical undershoot.
  const prey = traj.y.map((row) => Math.max(0, row[0] ?? 0));
  const pred = traj.y.map((row) => Math.max(0, row[1] ?? 0));

  const eq = interiorEquilibrium(p);
  const enrichmentThreshold = eq ? 2 * eq.n + 1 / (p.a * p.h) : Number.NaN;

  // Classify the regime from the exact Hopf condition (K > K_H), not a fragile
  // amplitude cutoff that a still-decaying transient would trip. Amplitude is a
  // diagnostic only.
  const half = Math.floor(prey.length / 2);
  const { min: nMin, max: nMax } = arrayMinMax(prey.slice(half));
  const amplitude = nMax - nMin;
  const limitCycle = eq ? p.k > enrichmentThreshold : false;

  const metrics: Metric[] = [
    {
      key: 'preyEquilibrium',
      label: 'Prey equilibrium N*',
      value: eq ? eq.n : Number.NaN,
      note: 'm / (a(e − m·h))',
    },
    {
      key: 'predatorEquilibrium',
      label: 'Predator equilibrium P*',
      value: eq ? eq.p : Number.NaN,
    },
    {
      key: 'enrichmentThreshold',
      label: 'Enrichment threshold K_H',
      value: enrichmentThreshold,
      note: 'stable coexistence for K < K_H; limit cycle above (paradox of enrichment)',
    },
    {
      key: 'oscillationAmplitude',
      label: 'Steady-state prey amplitude',
      value: amplitude,
      note: 'peak-to-peak over the second half',
    },
    {
      key: 'limitCycle',
      label: 'Limit cycle',
      value: limitCycle ? 1 : 0,
      note: '1 = sustained oscillation; 0 = settles to equilibrium',
    },
    { key: 'carryingCapacity', label: 'Carrying capacity K', value: p.k },
  ];

  const idx = downsampleIndices(traj.t.length, p.outputPoints);
  const ts = idx.map((i) => traj.t[i] ?? 0);
  const preyS = idx.map((i) => prey[i] ?? 0);
  const predS = idx.map((i) => pred[i] ?? 0);
  const series: Series[] = [
    { x: ts, y: { prey: preyS, predator: predS }, xLabel: 'time', yLabel: 'population' },
    { x: preyS, y: { predator: predS }, xLabel: 'prey N', yLabel: 'predator P' },
  ];

  const regime = eq
    ? limitCycle
      ? `limit cycle (K=${p.k} > K_H=${enrichmentThreshold.toFixed(2)})`
      : `stable coexistence at (N*, P*)=(${eq.n.toFixed(2)}, ${eq.p.toFixed(2)})`
    : 'predator extinction (no interior equilibrium)';

  return {
    engine: 'rosenzweig-macarthur',
    summary: `Rosenzweig–MacArthur: ${regime}.`,
    metrics,
    series,
    detail: { equilibrium: eq, enrichmentThreshold, limitCycle, amplitude },
    provenance: provenance('rosenzweig-macarthur', '1.0.0', p),
  };
}

export const spec: EngineSpec<RosenzweigMacArthurParams> = {
  slug: 'rosenzweig-macarthur',
  title: 'Rosenzweig–MacArthur Predator–Prey',
  domain: 'ecology',
  version: '1.0.0',
  description:
    'A realistic predator–prey model: logistic (self-limiting) prey and a saturating Holling type-II predator. It has a genuine attractor — a stable coexistence equilibrium or a stable limit cycle — and exhibits the paradox of enrichment: raising the prey carrying capacity K destabilizes the equilibrium into boom–bust oscillations past the Hopf threshold K_H = 2N* + 1/(a·h). Reports the exact interior equilibrium, the enrichment threshold, and both the time course and (N, P) phase portrait.',
  references: [
    'Rosenzweig, M.L. & MacArthur, R.H. (1963) Graphical representation and stability conditions of predator-prey interactions. Am. Nat. 97:209-223.',
    'Rosenzweig, M.L. (1971) Paradox of enrichment: destabilization of exploitation ecosystems in ecological time. Science 171:385-387.',
    'Murray, J.D. (2002) Mathematical Biology I: An Introduction, 3rd ed., ch. 3.',
  ],
  paramsSchema: paramsSchema as z.ZodType<RosenzweigMacArthurParams>,
  run,
  example: paramsSchema.parse({ r: 1, k: 6, a: 1, h: 0.5, e: 0.5, m: 0.2 }),
  tags: ['ecology', 'predator-prey', 'paradox-of-enrichment', 'holling', 'limit-cycle', 'ode'],
};

export default spec;
