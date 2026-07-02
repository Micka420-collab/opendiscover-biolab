/**
 * Kuramoto model — synchronization of coupled phase oscillators.
 *
 * N oscillators, each with its own natural frequency ωᵢ, are coupled through the
 * global mean field:
 *
 *     dθᵢ/dt = ωᵢ + (K/N) Σⱼ sin(θⱼ − θᵢ)
 *
 * Using the complex order parameter  r·e^{iψ} = (1/N) Σⱼ e^{iθⱼ}, this collapses
 * to the efficient mean-field form
 *
 *     dθᵢ/dt = ωᵢ + K·r·sin(ψ − θᵢ),
 *
 * so each oscillator feels the population only through r (coherence, 0→1) and ψ
 * (mean phase). Below a critical coupling Kc the population is incoherent (r≈0);
 * above it a synchronized cluster nucleates and r rises toward 1. This is the
 * canonical model of collective rhythm — flashing fireflies, pacemaker cells,
 * circadian neurons, applauding audiences.
 *
 * For Gaussian natural frequencies (sd σ), Kc = 2/(π·g(0)) = 2σ√(2π)/π ≈ 1.596·σ.
 *
 * Deterministic: natural frequencies and initial phases are drawn from the shared
 * seeded PRNG, so a given seed reproduces the trajectory exactly.
 *
 * References:
 *   - Kuramoto, Y. (1975) Self-entrainment of a population of coupled non-linear
 *     oscillators. Lecture Notes in Physics 39:420-422.
 *   - Strogatz, S.H. (2000) From Kuramoto to Crawford. Physica D 143:1-20.
 *   - Acebrón et al. (2005) The Kuramoto model. Rev. Mod. Phys. 77:137.
 */

import { z } from 'zod';
import { type Derivative, rk4 } from '../core/ode';
import { createRng } from '../core/prng';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Number of oscillators N. */
    oscillators: z.number().int().min(2).max(2000).default(64),
    /** Global coupling strength K. */
    coupling: z.number().min(0).default(2),
    /** Standard deviation σ of the (Gaussian) natural-frequency distribution. */
    freqSpread: z.number().positive().default(1),
    /** Integration horizon. */
    tEnd: z.number().positive().max(10_000).default(40),
    /** Fixed RK4 steps. */
    steps: z.number().int().positive().max(200_000).default(2000),
    /** Points kept for the plotted order-parameter series. */
    outputPoints: z.number().int().positive().max(2000).default(400),
    /** RNG seed for natural frequencies + initial phases. */
    seed: z.union([z.number(), z.string()]).default('kuramoto'),
  })
  .strict();

export type KuramotoParams = z.infer<typeof paramsSchema>;

/** Complex order parameter: r = coherence (0–1), psi = mean phase. */
export function orderParameter(theta: number[]): { r: number; psi: number } {
  let sumCos = 0;
  let sumSin = 0;
  for (const t of theta) {
    sumCos += Math.cos(t);
    sumSin += Math.sin(t);
  }
  const n = theta.length || 1;
  sumCos /= n;
  sumSin /= n;
  return { r: Math.hypot(sumCos, sumSin), psi: Math.atan2(sumSin, sumCos) };
}

/** Mean-field Kuramoto derivative closing over natural frequencies + coupling. */
export function kuramotoDerivative(omega: number[], k: number): Derivative {
  return (_t, theta) => {
    const { r, psi } = orderParameter(theta);
    return theta.map((th, i) => (omega[i] ?? 0) + k * r * Math.sin(psi - th));
  };
}

/** Critical coupling for a Gaussian frequency distribution: Kc = 2σ√(2π)/π. */
export function criticalCoupling(freqSpread: number): number {
  return (2 * freqSpread * Math.sqrt(2 * Math.PI)) / Math.PI;
}

function downsampleIndices(len: number, n: number): number[] {
  if (len <= n) return Array.from({ length: len }, (_, i) => i);
  return Array.from({ length: n }, (_, i) => Math.round((i * (len - 1)) / (n - 1)));
}

export function run(rawParams: Partial<KuramotoParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const rng = createRng(p.seed);

  const omega = Array.from({ length: p.oscillators }, () => rng.normal(0, p.freqSpread));
  const theta0 = Array.from({ length: p.oscillators }, () => rng.uniform(0, 2 * Math.PI));

  const traj = rk4(kuramotoDerivative(omega, p.coupling), theta0, 0, p.tEnd, p.steps);
  const rSeries = traj.y.map((theta) => orderParameter(theta).r);

  const finalR = rSeries[rSeries.length - 1] ?? 0;
  // Steady-state coherence: average over the second half of the run.
  const half = Math.floor(rSeries.length / 2);
  const tail = rSeries.slice(half);
  const meanR = tail.reduce((s, r) => s + r, 0) / (tail.length || 1);

  const kc = criticalCoupling(p.freqSpread);
  const synchronized = meanR > 0.5;

  const metrics: Metric[] = [
    {
      key: 'finalOrderParameter',
      label: 'Final coherence r',
      value: finalR,
      note: '0 = incoherent, 1 = fully synchronized',
    },
    {
      key: 'meanOrderParameter',
      label: 'Steady-state coherence ⟨r⟩',
      value: meanR,
      note: 'averaged over the second half of the run',
    },
    {
      key: 'criticalCoupling',
      label: 'Critical coupling Kc',
      value: kc,
      note: '2σ√(2π)/π for Gaussian frequencies; sync emerges for K > Kc',
    },
    { key: 'coupling', label: 'Coupling K', value: p.coupling },
    {
      key: 'synchronized',
      label: 'Synchronized',
      value: synchronized ? 1 : 0,
      note: '1 = steady-state coherence above 0.5',
    },
    { key: 'oscillators', label: 'Oscillators N', value: p.oscillators },
  ];

  const idx = downsampleIndices(traj.t.length, p.outputPoints);
  const series: Series[] = [
    {
      x: idx.map((i) => traj.t[i] ?? 0),
      y: { coherence: idx.map((i) => rSeries[i] ?? 0) },
      xLabel: 'time',
      yLabel: 'order parameter r',
    },
  ];

  return {
    engine: 'kuramoto',
    summary: `${p.oscillators} oscillators at K=${p.coupling} (Kc≈${kc.toFixed(2)}): steady-state coherence ⟨r⟩=${meanR.toFixed(3)} — ${synchronized ? 'synchronized' : 'incoherent'}.`,
    metrics,
    series,
    detail: { criticalCoupling: kc, finalOrderParameter: finalR, meanOrderParameter: meanR },
    provenance: provenance('kuramoto', '1.0.0', p, p.seed),
  };
}

export const spec: EngineSpec<KuramotoParams> = {
  slug: 'kuramoto',
  title: 'Kuramoto Synchronization',
  domain: 'systems-biology',
  version: '1.0.0',
  description:
    'A population of coupled phase oscillators (fireflies, pacemaker cells, neurons) that spontaneously synchronize once the global coupling K exceeds a critical value Kc. Integrates the mean-field Kuramoto equations and tracks the order parameter r (0 = incoherent, 1 = fully synchronized) over time. Natural frequencies and initial phases are drawn from a seeded PRNG, so runs are reproducible.',
  references: [
    'Kuramoto, Y. (1975) Self-entrainment of a population of coupled non-linear oscillators. LNP 39:420-422.',
    'Strogatz, S.H. (2000) From Kuramoto to Crawford. Physica D 143:1-20.',
    'Acebrón, J.A. et al. (2005) The Kuramoto model. Rev. Mod. Phys. 77:137-185.',
  ],
  paramsSchema: paramsSchema as z.ZodType<KuramotoParams>,
  run,
  example: paramsSchema.parse({ oscillators: 64, coupling: 2, freqSpread: 1, tEnd: 40 }),
  tags: [
    'synchronization',
    'oscillators',
    'collective-dynamics',
    'nonlinear',
    'ode',
    'order-parameter',
  ],
};

export default spec;
