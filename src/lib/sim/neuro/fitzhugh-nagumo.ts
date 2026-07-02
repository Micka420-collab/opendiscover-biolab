/**
 * FitzHugh–Nagumo model — a two-variable caricature of an excitable neuron.
 *
 * A reduction of Hodgkin–Huxley to its essential fast–slow structure:
 *
 *     dv/dt = v − v³/3 − w + I        (fast: membrane-voltage-like activator)
 *     dw/dt = ε·(v + a − b·w)         (slow: recovery / refractoriness)
 *
 * The cubic v-nullcline plus the linear w-nullcline give one fixed point (for the
 * standard a=0.7, b=0.8 regime). At low drive I the rest state is stable but
 * EXCITABLE — a small kick decays, a supra-threshold kick fires one large spike.
 * As I increases past a Hopf bifurcation the rest state loses stability and the
 * neuron fires a periodic train (a relaxation-oscillation limit cycle); raising I
 * further quenches spiking again ("excitation block").
 *
 * Deterministic: a pure fast–slow ODE integrated with fixed-step RK4.
 *
 * References:
 *   - FitzHugh, R. (1961) Impulses and physiological states in theoretical models
 *     of nerve membrane. Biophys. J. 1:445-466.
 *   - Nagumo, J., Arimoto, S., Yoshizawa, S. (1962) An active pulse transmission
 *     line simulating nerve axon. Proc. IRE 50:2061-2070.
 *   - Izhikevich, E.M. (2007) Dynamical Systems in Neuroscience, ch. 4.
 */

import { z } from 'zod';
import { type Derivative, rk4 } from '../core/ode';
import { downsampleIndices } from '../core/series';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Constant input current I (the bifurcation parameter). */
    current: z.number().default(0.5),
    /** Recovery offset a. */
    a: z.number().default(0.7),
    /** Recovery slope b. */
    b: z.number().positive().default(0.8),
    /** Timescale separation ε (small ⇒ sharp relaxation spikes). */
    epsilon: z.number().positive().default(0.08),
    /** Initial voltage v0. */
    v0: z.number().default(-1),
    /** Initial recovery w0. */
    w0: z.number().default(-0.6),
    /** Integration horizon. */
    tEnd: z.number().positive().max(10_000).default(200),
    /** Fixed RK4 steps. */
    steps: z.number().int().positive().max(200_000).default(4000),
    /** Points kept for the plotted series. */
    outputPoints: z.number().int().positive().max(2000).default(800),
  })
  .strict();

export type FitzHughNagumoParams = z.infer<typeof paramsSchema>;

/** Derivative for state y = [v, w]. */
export function fitzHughNagumoDerivative(p: FitzHughNagumoParams): Derivative {
  return (_t, y) => {
    const v = y[0] ?? 0;
    const w = y[1] ?? 0;
    return [v - (v * v * v) / 3 - w + p.current, p.epsilon * (v + p.a - p.b * w)];
  };
}

/**
 * A fixed point via bracketed bisection on the reduced equation
 * h(v) = v − v³/3 − (v+a)/b + I = 0, with w* = (v*+a)/b.
 *
 * Bisection (not Newton) so it converges for every valid input: h is a cubic
 * with a negative leading term, so h(−M) > 0 and h(+M) < 0 for large enough M —
 * a sign change always exists. This avoids Newton stalling at a zero derivative
 * (which happens at v=0 when b=1) and always returns a genuine root.
 */
export function fixedPoint(
  a: number,
  b: number,
  current: number,
): { v: number; w: number; residual: number } {
  const h = (v: number) => v - (v * v * v) / 3 - (v + a) / b + current;
  let lo = -10;
  let hi = 10;
  // Widen until the bracket straddles a root (guaranteed by the −v³/3 term).
  for (let i = 0; i < 80 && h(lo) <= 0; i++) lo *= 2;
  for (let i = 0; i < 80 && h(hi) >= 0; i++) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (h(mid) > 0) lo = mid;
    else hi = mid;
  }
  const v = (lo + hi) / 2;
  return { v, w: (v + a) / b, residual: h(v) };
}

export function run(rawParams: Partial<FitzHughNagumoParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const traj = rk4(fitzHughNagumoDerivative(p), [p.v0, p.w0], 0, p.tEnd, p.steps);
  const v = traj.y.map((row) => row[0] ?? 0);
  const w = traj.y.map((row) => row[1] ?? 0);

  // Steady-state behaviour: measure over the second half of the run.
  const half = Math.floor(v.length / 2);
  let vMin = Number.POSITIVE_INFINITY;
  let vMax = Number.NEGATIVE_INFINITY;
  let vSum = 0;
  for (let i = half; i < v.length; i++) {
    const vi = v[i] ?? 0;
    if (vi < vMin) vMin = vi;
    if (vi > vMax) vMax = vi;
    vSum += vi;
  }
  const amplitude = vMax - vMin;
  const meanV = vSum / Math.max(v.length - half, 1);
  const spiking = amplitude > 0.5;

  const fp = fixedPoint(p.a, p.b, p.current);

  // Spike count over the second half (upward crossings of the mean).
  let spikes = 0;
  for (let i = half + 1; i < v.length; i++) {
    if ((v[i - 1] ?? 0) <= meanV && (v[i] ?? 0) > meanV) spikes++;
  }
  const window = p.tEnd / 2;
  const firingRate = spiking && window > 0 ? spikes / window : 0;

  const metrics: Metric[] = [
    { key: 'fixedPointV', label: 'Fixed point v*', value: fp.v, note: 'on both nullclines' },
    { key: 'fixedPointW', label: 'Fixed point w*', value: fp.w },
    {
      key: 'oscillationAmplitude',
      label: 'Steady-state v amplitude',
      value: amplitude,
      note: 'peak-to-peak over the second half',
    },
    {
      key: 'spiking',
      label: 'Repetitive firing',
      value: spiking ? 1 : 0,
      note: '1 = limit-cycle spiking; 0 = quiescent (excitable rest)',
    },
    {
      key: 'firingRate',
      label: 'Firing rate',
      value: firingRate,
      unit: 'spikes/time',
      note: 'steady-state, 0 when quiescent',
    },
    { key: 'current', label: 'Input current I', value: p.current },
  ];

  const idx = downsampleIndices(traj.t.length, p.outputPoints);
  const series: Series[] = [
    {
      x: idx.map((i) => traj.t[i] ?? 0),
      y: { v: idx.map((i) => v[i] ?? 0), w: idx.map((i) => w[i] ?? 0) },
      xLabel: 'time',
      yLabel: 'state',
    },
    // Phase portrait (v vs w) — the limit cycle or the spiral into rest.
    { x: idx.map((i) => v[i] ?? 0), y: { w: idx.map((i) => w[i] ?? 0) }, xLabel: 'v', yLabel: 'w' },
  ];

  return {
    engine: 'fitzhugh-nagumo',
    summary: spiking
      ? `Repetitive firing at I=${p.current} (v amplitude ${amplitude.toFixed(2)}, ${firingRate.toFixed(3)} spikes/time).`
      : `Quiescent (excitable rest) at I=${p.current}: settles to v*=${fp.v.toFixed(3)}.`,
    metrics,
    series,
    detail: { fixedPoint: fp, spiking, amplitude },
    provenance: provenance('fitzhugh-nagumo', '1.0.0', p),
  };
}

export const spec: EngineSpec<FitzHughNagumoParams> = {
  slug: 'fitzhugh-nagumo',
  title: 'FitzHugh–Nagumo Neuron',
  domain: 'neuroscience',
  version: '1.0.0',
  description:
    'A two-variable reduction of Hodgkin–Huxley capturing neural excitability: a fast voltage-like variable v and a slow recovery variable w. At low input current I the rest state is stable but excitable; past a Hopf bifurcation the neuron fires a periodic relaxation-oscillation spike train. Reports the fixed point, steady-state spike amplitude, firing rate, and both the time course and the (v, w) phase portrait.',
  references: [
    'FitzHugh, R. (1961) Impulses and physiological states in theoretical models of nerve membrane. Biophys. J. 1:445-466.',
    'Nagumo, J., Arimoto, S., Yoshizawa, S. (1962) An active pulse transmission line simulating nerve axon. Proc. IRE 50:2061-2070.',
    'Izhikevich, E.M. (2007) Dynamical Systems in Neuroscience, ch. 4.',
  ],
  paramsSchema: paramsSchema as z.ZodType<FitzHughNagumoParams>,
  run,
  example: paramsSchema.parse({ current: 0.5, a: 0.7, b: 0.8, epsilon: 0.08 }),
  tags: ['neuroscience', 'excitable', 'spiking', 'limit-cycle', 'ode', 'phase-plane'],
};

export default spec;
