/**
 * Endemic SIR with vital dynamics (demography).
 *
 * The `compartmental` engine models a single self-limiting outbreak in a closed
 * population. Add births and deaths (rate mu) and the picture changes: susceptibles
 * are continually replenished, so the infection can settle into a persistent
 * endemic state that it reaches through DAMPED oscillations — the recurrent
 * epidemics of measles, pertussis, etc. In fractions (S + I + R = 1):
 *
 *     dS/dt = mu - beta*S*I - mu*S
 *     dI/dt = beta*S*I - (gamma + mu)*I
 *     dR/dt = gamma*I - mu*R
 *
 * With R0 = beta / (gamma + mu):
 *   R0 <= 1: disease-free equilibrium (I -> 0).
 *   R0 > 1:  a stable endemic equilibrium, reached via damped oscillations:
 *              S* = 1/R0,   I* = mu*(R0 - 1)/beta.
 *
 * Deterministic: integrated with the adaptive RK45 (stable for any rates), with
 * the fractions clamped to [0, 1].
 *
 * References:
 *   - Anderson, R.M. & May, R.M. (1991) Infectious Diseases of Humans, ch. 6.
 *   - Hethcote, H.W. (2000) The mathematics of infectious diseases. SIAM Review 42:599.
 *   - Keeling, M.J. & Rohani, P. (2008) Modeling Infectious Diseases, ch. 2.
 */

import { z } from 'zod';
import { type Derivative, rk45 } from '../core/ode';
import { downsampleIndices } from '../core/series';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Transmission rate beta. */
    beta: z.number().positive().default(0.5),
    /** Recovery rate gamma. */
    gamma: z.number().positive().default(0.1),
    /** Per-capita birth = death rate mu (keeps N constant). */
    mu: z.number().positive().default(0.01),
    /** Initial infected fraction i0. */
    i0: z.number().gt(0).lt(1).default(0.001),
    /** Initial recovered fraction r0. */
    r0: z.number().min(0).lt(1).default(0),
    /** Integration horizon. */
    tEnd: z.number().positive().max(100_000).default(2000),
    /** Adaptive RK45 tolerance. */
    tol: z.number().positive().default(1e-8),
    /** Points kept for the plotted series. */
    outputPoints: z.number().int().positive().max(2000).default(600),
  })
  .strict()
  .refine((p) => p.i0 + p.r0 < 1, {
    message: 'i0 + r0 must be < 1 (susceptibles get the remainder)',
    path: ['r0'],
  });

export type SirEndemicParams = z.infer<typeof paramsSchema>;

/** Endemic equilibrium (S*, I*) for R0>1, else the disease-free (1, 0). */
export function endemicEquilibrium(
  beta: number,
  gamma: number,
  mu: number,
): { s: number; i: number; r0: number } {
  const r0 = beta / (gamma + mu);
  if (r0 <= 1) return { s: 1, i: 0, r0 };
  return { s: 1 / r0, i: (mu * (r0 - 1)) / beta, r0 };
}

/** Derivative for y = [S, I] (R = 1 − S − I is implicit). */
export function sirEndemicDerivative(p: SirEndemicParams): Derivative {
  return (_t, y) => {
    const s = y[0] ?? 0;
    const i = y[1] ?? 0;
    return [p.mu - p.beta * s * i - p.mu * s, p.beta * s * i - (p.gamma + p.mu) * i];
  };
}

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

export function run(rawParams: Partial<SirEndemicParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const eq = endemicEquilibrium(p.beta, p.gamma, p.mu);
  const s0 = 1 - p.i0 - p.r0;

  const traj = rk45(sirEndemicDerivative(p), [s0, p.i0], 0, p.tEnd, {
    tol: p.tol,
    outputPoints: p.outputPoints,
  });
  const susceptible = traj.y.map((row) => clamp01(row[0] ?? 0));
  const infected = traj.y.map((row) => clamp01(row[1] ?? 0));

  const finalInfected = infected[infected.length - 1] ?? 0;
  // Time-averaged prevalence over the second half — robust to slow damping,
  // centres on the endemic equilibrium.
  const half = Math.floor(infected.length / 2);
  let sumTail = 0;
  for (let k = half; k < infected.length; k++) sumTail += infected[k] ?? 0;
  const meanInfected = sumTail / Math.max(infected.length - half, 1);

  const metrics: Metric[] = [
    { key: 'r0', label: 'Basic reproduction number R₀', value: eq.r0, note: 'beta / (gamma + mu)' },
    {
      key: 'susceptibleEquilibrium',
      label: 'Susceptible equilibrium S*',
      value: eq.s,
      note: eq.r0 > 1 ? '1/R₀' : 'disease-free',
    },
    {
      key: 'endemicPrevalence',
      label: 'Endemic prevalence I*',
      value: eq.i,
      note: eq.r0 > 1 ? 'mu·(R₀−1)/beta' : '0 (R₀ ≤ 1)',
    },
    {
      key: 'meanInfected',
      label: 'Time-averaged prevalence',
      value: meanInfected,
      note: 'over the second half; approaches I* only once the oscillations have damped',
    },
    { key: 'finalInfected', label: 'Final prevalence (t=tEnd)', value: finalInfected },
    {
      key: 'endemic',
      label: 'Becomes endemic',
      value: eq.r0 > 1 ? 1 : 0,
      note: '1 = persists at a positive steady state',
    },
  ];

  const idx = downsampleIndices(traj.t.length, p.outputPoints);
  const ts = idx.map((k) => traj.t[k] ?? 0);
  const sS = idx.map((k) => susceptible[k] ?? 0);
  const iS = idx.map((k) => infected[k] ?? 0);
  const series: Series[] = [
    {
      x: ts,
      y: { susceptible: sS, infected: iS, recovered: sS.map((s, j) => 1 - s - (iS[j] ?? 0)) },
      xLabel: 'time',
      yLabel: 'fraction',
    },
  ];

  // Has the endemic level actually been reached within tEnd? (Small mu damps
  // slowly, so the run may still be deep in a post-outbreak trough.)
  const settled = eq.r0 > 1 && Math.abs(finalInfected - eq.i) < 0.1 * eq.i;

  return {
    engine: 'sir-endemic',
    summary:
      eq.r0 <= 1
        ? `Endemic SIR (R₀=${eq.r0.toFixed(2)} ≤ 1): infection dies out.`
        : settled
          ? `Endemic SIR (R₀=${eq.r0.toFixed(2)}): damped oscillations settle to I*=${eq.i.toFixed(4)}, S*=${eq.s.toFixed(3)}.`
          : `Endemic SIR (R₀=${eq.r0.toFixed(2)}): still approaching the endemic level I*=${eq.i.toFixed(4)} — a horizon longer than tEnd=${p.tEnd} is needed to settle.`,
    metrics,
    series,
    detail: { equilibrium: eq, meanInfected, finalInfected },
    provenance: provenance('sir-endemic', '1.0.0', p),
  };
}

export const spec: EngineSpec<SirEndemicParams> = {
  slug: 'sir-endemic',
  title: 'Endemic SIR (with demography)',
  domain: 'epidemiology',
  version: '1.0.0',
  description:
    'SIR with vital dynamics: births continually replenish susceptibles, so an infection can persist as an endemic steady state reached through damped oscillations — the recurrent epidemics of measles and pertussis. With R0 = beta/(gamma+mu), it dies out for R0 ≤ 1 and settles at S* = 1/R0, I* = mu·(R0−1)/beta for R0 > 1.',
  references: [
    'Anderson, R.M. & May, R.M. (1991) Infectious Diseases of Humans: Dynamics and Control, ch. 6.',
    'Hethcote, H.W. (2000) The mathematics of infectious diseases. SIAM Review 42:599-653.',
    'Keeling, M.J. & Rohani, P. (2008) Modeling Infectious Diseases in Humans and Animals, ch. 2.',
  ],
  paramsSchema: paramsSchema as z.ZodType<SirEndemicParams>,
  run,
  example: paramsSchema.parse({ beta: 0.5, gamma: 0.1, mu: 0.01, i0: 0.001 }),
  tags: ['epidemiology', 'sir', 'endemic', 'vital-dynamics', 'damped-oscillations', 'ode'],
};

export default spec;
