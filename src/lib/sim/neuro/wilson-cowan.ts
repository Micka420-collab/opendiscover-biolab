/**
 * Wilson–Cowan model of coupled excitatory / inhibitory neural populations.
 *
 * Rather than tracking single spikes, this is a MEAN-FIELD (population) model: E(t)
 * and I(t) are the fractions of the excitatory and inhibitory populations that are
 * active. Each population drives itself and the other through weighted connections
 * and a saturating (sigmoid) response, relaxing on its own time constant:
 *
 *     τ_E dE/dt = −E + S_E( c_EE·E − c_EI·I + P )
 *     τ_I dI/dt = −I + S_I( c_IE·E − c_II·I + Q )
 *
 * with the baseline-subtracted logistic response  S(x) = σ(a(x−θ)) − σ(−aθ)  so that
 * zero input gives zero drive (σ is the standard logistic). Depending on the weights
 * this settles to a fixed point or, through a Hopf bifurcation, into a limit cycle —
 * the population-level origin of cortical rhythms (gamma, etc.).
 *
 * Deterministic: a 2-D ODE integrated with the adaptive RK45. The response is
 * evaluated with a numerically stable logistic so large inputs can't overflow.
 *
 * References:
 *   - Wilson, H.R. & Cowan, J.D. (1972) Excitatory and inhibitory interactions in
 *     localized populations of model neurons. Biophysical Journal 12(1):1-24.
 *   - Ermentrout, G.B. & Terman, D.H. (2010) Mathematical Foundations of
 *     Neuroscience. Springer (ch. 11, firing-rate models).
 */

import { z } from 'zod';
import { type Derivative, rk45 } from '../core/ode';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Excitatory→excitatory weight c_EE. */
    cEE: z.number().min(0).default(16),
    /** Inhibitory→excitatory weight c_EI. */
    cEI: z.number().min(0).default(12),
    /** Excitatory→inhibitory weight c_IE. */
    cIE: z.number().min(0).default(15),
    /** Inhibitory→inhibitory weight c_II. */
    cII: z.number().min(0).default(3),
    /** External drive to the excitatory population P. */
    P: z.number().default(1.25),
    /** External drive to the inhibitory population Q. */
    Q: z.number().default(0),
    /** Excitatory response gain a_E. */
    aE: z.number().positive().default(1.3),
    /** Excitatory response threshold θ_E. */
    thetaE: z.number().default(4),
    /** Inhibitory response gain a_I. */
    aI: z.number().positive().default(2),
    /** Inhibitory response threshold θ_I. */
    thetaI: z.number().default(3.7),
    /** Excitatory time constant τ_E. */
    tauE: z.number().positive().default(1),
    /** Inhibitory time constant τ_I. */
    tauI: z.number().positive().default(1),
    /** Initial excitatory activity. */
    E0: z.number().min(0).max(1).default(0.1),
    /** Initial inhibitory activity. */
    I0: z.number().min(0).max(1).default(0.1),
    /** Integration horizon. */
    tEnd: z.number().positive().max(100_000).default(60),
    /** Adaptive RK45 tolerance. */
    tol: z.number().positive().default(1e-8),
    /** Points kept for the plotted series. */
    outputPoints: z.number().int().positive().max(4000).default(600),
  })
  .strict();

export type WilsonCowanParams = z.infer<typeof paramsSchema>;

/** Numerically stable logistic σ(z) = 1/(1+e^−z), never overflows. */
function logistic(z: number): number {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

/** Baseline-subtracted sigmoid response S(x) = σ(a(x−θ)) − σ(−aθ), so S(0) = 0. */
export function response(x: number, a: number, theta: number): number {
  return logistic(a * (x - theta)) - logistic(-a * theta);
}

/** The Wilson–Cowan derivative for y = [E, I]. */
export function wilsonCowanDerivative(p: WilsonCowanParams): Derivative {
  return (_t, y) => {
    const E = y[0] ?? 0;
    const I = y[1] ?? 0;
    const dE = (-E + response(p.cEE * E - p.cEI * I + p.P, p.aE, p.thetaE)) / p.tauE;
    const dI = (-I + response(p.cIE * E - p.cII * I + p.Q, p.aI, p.thetaI)) / p.tauI;
    return [dE, dI];
  };
}

export interface OscillationStats {
  oscillates: boolean;
  amplitude: number;
  mean: number;
  period: number;
}

/**
 * Characterize the steady behavior of a signal over its second half (after the
 * transient): peak-to-peak amplitude, mean, and — if it oscillates — the dominant
 * period from successive upward mean-crossings. Pure and well-guarded.
 */
export function analyzeOscillation(t: number[], v: number[]): OscillationStats {
  const n = v.length;
  if (n < 4) {
    const mean = n > 0 ? v.reduce((s, x) => s + x, 0) / n : 0;
    return { oscillates: false, amplitude: 0, mean, period: 0 };
  }
  const start = Math.floor(n / 2);
  let max = Number.NEGATIVE_INFINITY;
  let min = Number.POSITIVE_INFINITY;
  let sum = 0;
  let count = 0;
  for (let i = start; i < n; i++) {
    const x = v[i] ?? 0;
    if (x > max) max = x;
    if (x < min) min = x;
    sum += x;
    count++;
  }
  const mean = count > 0 ? sum / count : 0;
  const amplitude = max - min;
  const oscillates = amplitude > 0.02;

  let period = 0;
  if (oscillates) {
    // Times where the signal crosses its mean going upward (linear interpolation).
    const crossings: number[] = [];
    for (let i = start + 1; i < n; i++) {
      const prev = v[i - 1] ?? 0;
      const cur = v[i] ?? 0;
      if (prev < mean && cur >= mean) {
        const tp = t[i - 1] ?? 0;
        const tc = t[i] ?? 0;
        const frac = cur === prev ? 0 : (mean - prev) / (cur - prev);
        crossings.push(tp + frac * (tc - tp));
      }
    }
    if (crossings.length >= 2) {
      const first = crossings[0] as number;
      const last = crossings[crossings.length - 1] as number;
      period = (last - first) / (crossings.length - 1);
    }
  }
  return { oscillates, amplitude, mean, period };
}

function downsampleIndices(len: number, n: number): number[] {
  if (len <= n) return Array.from({ length: len }, (_, i) => i);
  const denom = Math.max(n - 1, 1);
  return Array.from({ length: n }, (_, i) => Math.round((i * (len - 1)) / denom));
}

export function run(rawParams: Partial<WilsonCowanParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);

  const traj = rk45(wilsonCowanDerivative(p), [p.E0, p.I0], 0, p.tEnd, {
    tol: p.tol,
    outputPoints: p.outputPoints,
  });
  const eSeries = traj.y.map((row) => row[0] ?? 0);
  const iSeries = traj.y.map((row) => row[1] ?? 0);
  const eStats = analyzeOscillation(traj.t, eSeries);
  const iStats = analyzeOscillation(traj.t, iSeries);

  const metrics: Metric[] = [
    {
      key: 'oscillates',
      label: 'Sustained oscillation',
      value: eStats.oscillates ? 1 : 0,
      note: eStats.oscillates ? 'limit cycle (rhythmic activity)' : 'settles to a fixed point',
    },
    {
      key: 'meanE',
      label: eStats.oscillates ? 'Mean excitatory activity' : 'Steady-state E',
      value: eStats.mean,
    },
    {
      key: 'meanI',
      label: eStats.oscillates ? 'Mean inhibitory activity' : 'Steady-state I',
      value: iStats.mean,
    },
    { key: 'amplitudeE', label: 'Excitatory peak-to-peak amplitude', value: eStats.amplitude },
    {
      key: 'periodE',
      label: 'Oscillation period',
      value: eStats.period,
      note: eStats.period > 0 ? `≈ ${(1 / eStats.period).toFixed(3)} cycles per time unit` : 'n/a',
    },
  ];

  const idx = downsampleIndices(traj.t.length, p.outputPoints);
  const series: Series[] = [
    {
      x: idx.map((k) => traj.t[k] ?? 0),
      y: {
        E: idx.map((k) => eSeries[k] ?? 0),
        I: idx.map((k) => iSeries[k] ?? 0),
      },
      xLabel: 'time',
      yLabel: 'population activity',
    },
  ];

  return {
    engine: 'wilson-cowan',
    summary: eStats.oscillates
      ? `Wilson–Cowan: sustained oscillation — E swings ${eStats.amplitude.toFixed(3)} peak-to-peak with period ≈ ${eStats.period.toFixed(2)} (a population rhythm).`
      : `Wilson–Cowan: settles to a fixed point at E*=${eStats.mean.toFixed(3)}, I*=${iStats.mean.toFixed(3)}.`,
    metrics,
    series,
    detail: {
      oscillates: eStats.oscillates,
      amplitudeE: eStats.amplitude,
      periodE: eStats.period,
      meanE: eStats.mean,
      meanI: iStats.mean,
    },
    provenance: provenance('wilson-cowan', '1.0.0', p),
  };
}

export const spec: EngineSpec<WilsonCowanParams> = {
  slug: 'wilson-cowan',
  title: 'Wilson–Cowan (neural populations)',
  domain: 'neuroscience',
  version: '1.0.0',
  description:
    'The Wilson–Cowan mean-field model of two coupled neural populations — excitatory E and inhibitory I — each a fraction of active cells that drives itself and the other through weighted connections and a saturating sigmoid response. Depending on the coupling it relaxes to a fixed point or, via a Hopf bifurcation, into a sustained limit cycle: the population-level origin of brain rhythms. Adaptive RK45 with a numerically stable response function.',
  references: [
    'Wilson, H.R. & Cowan, J.D. (1972) Excitatory and inhibitory interactions in localized populations of model neurons. Biophysical Journal 12(1):1-24.',
    'Ermentrout, G.B. & Terman, D.H. (2010) Mathematical Foundations of Neuroscience. Springer.',
  ],
  paramsSchema: paramsSchema as z.ZodType<WilsonCowanParams>,
  run,
  // Classic oscillatory regime (Wilson & Cowan 1972): E/I populations chase each
  // other into a limit cycle.
  example: paramsSchema.parse({}),
  tags: ['neuroscience', 'population-dynamics', 'oscillation', 'limit-cycle', 'ode'],
};

export default spec;
