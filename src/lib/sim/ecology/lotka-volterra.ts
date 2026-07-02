/**
 * Lotka–Volterra predator–prey model.
 *
 * The classic two-species population-dynamics ODE (Lotka 1925, Volterra 1926):
 *
 *     dx/dt =  α·x − β·x·y      (prey: exponential growth, cropped by predation)
 *     dy/dt =  δ·x·y − γ·y      (predator: grows on prey, dies at constant rate)
 *
 * where x is prey abundance, y predator abundance, and α, β, δ, γ > 0.
 *
 * The system oscillates around the non-trivial coexistence equilibrium
 *
 *     x* = γ/δ,   y* = α/β,
 *
 * on closed orbits. Two exact properties make it a strong correctness check —
 * both are verified in the test suite, not just asserted:
 *
 *  1. Conserved quantity. Along every orbit
 *         V(x,y) = δ·x − γ·ln x + β·y − α·ln y
 *     is invariant, so a good integrator keeps V nearly constant.
 *
 *  2. Mean = equilibrium. The time-average of each population over a whole
 *     period equals its equilibrium value: ⟨x⟩ = x*, ⟨y⟩ = y*. This is the
 *     Volterra "law of conservation of averages" — the reason pesticides that
 *     kill both species can paradoxically raise the average *pest* population.
 *
 * Determinism: a pure fixed-step RK4 integration — no clock, no randomness.
 *
 * References:
 *   - Lotka, A.J. (1925) Elements of Physical Biology.
 *   - Volterra, V. (1926) Fluctuations in the abundance of a species considered
 *     mathematically. Nature 118:558–560.
 *   - Murray, J.D. (2002) Mathematical Biology I, ch. 3.
 */

import { z } from 'zod';
import { type Derivative, rk4 } from '../core/ode';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Prey intrinsic growth rate α (1/time). */
    alpha: z.number().positive().default(1.1),
    /** Predation rate coefficient β. */
    beta: z.number().positive().default(0.4),
    /** Predator growth per prey eaten δ. */
    delta: z.number().positive().default(0.1),
    /** Predator death rate γ (1/time). */
    gamma: z.number().positive().default(0.4),
    /** Initial prey abundance. */
    x0: z.number().positive().default(10),
    /** Initial predator abundance. */
    y0: z.number().positive().default(10),
    /** Integration horizon. */
    tEnd: z.number().positive().max(10_000).default(40),
    /** Fixed RK4 steps (accuracy vs cost). */
    steps: z.number().int().positive().max(200_000).default(4000),
    /** Points kept for the plotted series (the ODE is integrated at full `steps`). */
    outputPoints: z.number().int().positive().max(2000).default(400),
  })
  .strict();

export type LotkaVolterraParams = z.infer<typeof paramsSchema>;

/** Derivative for state y = [prey, predator]. */
export function lotkaVolterraDerivative(p: LotkaVolterraParams): Derivative {
  return (_t, s) => {
    const x = s[0] ?? 0;
    const y = s[1] ?? 0;
    return [p.alpha * x - p.beta * x * y, p.delta * x * y - p.gamma * y];
  };
}

/** Conserved first integral V = δx − γ ln x + βy − α ln y (constant on orbits). */
export function conservedQuantity(p: LotkaVolterraParams, x: number, y: number): number {
  return p.delta * x - p.gamma * Math.log(x) + p.beta * y - p.alpha * Math.log(y);
}

/** Evenly pick ~n indices spanning [0, len-1] (keeps endpoints). */
function downsampleIndices(len: number, n: number): number[] {
  if (len <= n) return Array.from({ length: len }, (_, i) => i);
  const denom = Math.max(n - 1, 1); // n === 1 must not divide by zero
  return Array.from({ length: n }, (_, i) => Math.round((i * (len - 1)) / denom));
}

/** Max of an array without spreading it (spreads overflow the stack at ~1e5). */
function arrayMax(a: number[]): number {
  let m = Number.NEGATIVE_INFINITY;
  for (const v of a) if (v > m) m = v;
  return m;
}

export function run(rawParams: Partial<LotkaVolterraParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const traj = rk4(lotkaVolterraDerivative(p), [p.x0, p.y0], 0, p.tEnd, p.steps);
  const t = traj.t;
  const prey = traj.y.map((r) => r[0] ?? 0);
  const pred = traj.y.map((r) => r[1] ?? 0);

  const preyEq = p.gamma / p.delta;
  const predEq = p.alpha / p.beta;

  // Trapezoidal time-averages ⟨x⟩, ⟨y⟩ over [0, tEnd].
  let areaPrey = 0;
  let areaPred = 0;
  for (let i = 1; i < t.length; i++) {
    const dt = (t[i] ?? 0) - (t[i - 1] ?? 0);
    areaPrey += 0.5 * dt * ((prey[i] ?? 0) + (prey[i - 1] ?? 0));
    areaPred += 0.5 * dt * ((pred[i] ?? 0) + (pred[i - 1] ?? 0));
  }
  const meanPrey = areaPrey / p.tEnd;
  const meanPred = areaPred / p.tEnd;

  // Conserved-quantity drift across the run (relative to the initial value).
  const v0 = conservedQuantity(p, p.x0, p.y0);
  let maxAbsDev = 0;
  for (let i = 0; i < t.length; i++) {
    const v = conservedQuantity(p, prey[i] ?? 0, pred[i] ?? 0);
    maxAbsDev = Math.max(maxAbsDev, Math.abs(v - v0));
  }
  const conservedDriftPct = v0 !== 0 ? (100 * maxAbsDev) / Math.abs(v0) : maxAbsDev;

  const metrics: Metric[] = [
    {
      key: 'preyEquilibrium',
      label: 'Prey equilibrium x*',
      value: preyEq,
      note: 'γ/δ',
    },
    {
      key: 'predatorEquilibrium',
      label: 'Predator equilibrium y*',
      value: predEq,
      note: 'α/β',
    },
    {
      key: 'meanPrey',
      label: 'Time-averaged prey ⟨x⟩',
      value: meanPrey,
      note: '→ x* over whole periods',
    },
    {
      key: 'meanPredator',
      label: 'Time-averaged predator ⟨y⟩',
      value: meanPred,
      note: '→ y* over whole periods',
    },
    { key: 'peakPrey', label: 'Peak prey', value: arrayMax(prey) },
    { key: 'peakPredator', label: 'Peak predator', value: arrayMax(pred) },
    {
      key: 'conservedDriftPct',
      label: 'Conserved-quantity drift',
      value: conservedDriftPct,
      unit: '%',
      note: 'max |V − V0| / |V0|; ~0 confirms the integrator stays on the orbit',
    },
  ];

  const idx = downsampleIndices(t.length, p.outputPoints);
  const ts = idx.map((i) => t[i] ?? 0);
  const preyS = idx.map((i) => prey[i] ?? 0);
  const predS = idx.map((i) => pred[i] ?? 0);

  const series: Series[] = [
    { x: ts, y: { prey: preyS, predator: predS }, xLabel: 'time', yLabel: 'population' },
    // Phase portrait — the closed predator-vs-prey orbit.
    { x: preyS, y: { predator: predS }, xLabel: 'prey', yLabel: 'predator' },
  ];

  return {
    engine: 'lotka-volterra',
    summary: `Predator–prey oscillation around (x*, y*) = (${preyEq.toFixed(2)}, ${predEq.toFixed(2)}); conserved-quantity drift ${conservedDriftPct.toFixed(3)}%.`,
    metrics,
    series,
    detail: { preyEquilibrium: preyEq, predatorEquilibrium: predEq, conservedV0: v0 },
    provenance: provenance('lotka-volterra', '1.0.0', p),
  };
}

export const spec: EngineSpec<LotkaVolterraParams> = {
  slug: 'lotka-volterra',
  title: 'Lotka–Volterra Predator–Prey',
  domain: 'ecology',
  version: '1.0.0',
  description:
    'The classic two-species predator–prey ODE. Prey grow exponentially and are cropped by predation; predators grow on prey and die at a constant rate. The system oscillates on closed orbits around the coexistence equilibrium (x*, y*) = (γ/δ, α/β), conserving V = δx − γ ln x + βy − α ln y, with time-averaged populations equal to the equilibrium (Volterra’s law of conservation of averages).',
  references: [
    'Lotka, A.J. (1925) Elements of Physical Biology.',
    'Volterra, V. (1926) Fluctuations in the abundance of a species considered mathematically. Nature 118:558-560.',
    'Murray, J.D. (2002) Mathematical Biology I: An Introduction, 3rd ed., ch. 3.',
  ],
  paramsSchema: paramsSchema as z.ZodType<LotkaVolterraParams>,
  run,
  example: paramsSchema.parse({
    alpha: 1.1,
    beta: 0.4,
    delta: 0.1,
    gamma: 0.4,
    x0: 10,
    y0: 10,
    tEnd: 40,
    steps: 4000,
  }),
  tags: ['ecology', 'predator-prey', 'population-dynamics', 'ode', 'oscillator', 'nonlinear'],
};

export default spec;
