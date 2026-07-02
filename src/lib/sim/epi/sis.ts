/**
 * SIS endemic epidemic model.
 *
 * The counterpart of SIR (see `compartmental`) for infections that confer NO
 * lasting immunity — the infected recover straight back to susceptible (many
 * bacterial STIs, the common cold in aggregate). In prevalence fraction i (with
 * susceptible fraction s = 1 - i):
 *
 *     di/dt = beta * i * (1 - i) - gamma * i
 *
 * which is a logistic equation with intrinsic rate (beta - gamma) and a carrying
 * capacity equal to the endemic prevalence. With R0 = beta / gamma:
 *
 *     R0 <= 1:  the infection dies out, i -> 0 (disease-free equilibrium)
 *     R0 > 1:   the infection becomes endemic at  i* = 1 - 1/R0  (a persistent
 *               steady state, unlike SIR's single self-limiting wave)
 *
 * Deterministic: a pure 1-D ODE integrated with fixed-step RK4, with i clamped
 * to [0, 1].
 *
 * References:
 *   - Kermack, W.O. & McKendrick, A.G. (1932) Contributions to the mathematical
 *     theory of epidemics, II. Proc. R. Soc. Lond. A 138:55-83.
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
    beta: z.number().positive().default(0.3),
    /** Recovery rate gamma (recovered return to susceptible). */
    gamma: z.number().positive().default(0.1),
    /** Initial infected fraction i0 (0 < i0 < 1). */
    i0: z.number().gt(0).lt(1).default(0.01),
    /** Integration horizon. */
    tEnd: z.number().positive().max(100_000).default(120),
    /** Adaptive RK45 tolerance (stable for any beta/gamma, unlike a fixed step). */
    tol: z.number().positive().default(1e-8),
    /** Points kept for the plotted series. */
    outputPoints: z.number().int().positive().max(2000).default(400),
  })
  .strict();

export type SisParams = z.infer<typeof paramsSchema>;

/** Endemic prevalence i* = 1 - 1/R0 for R0 > 1, else 0 (disease-free). */
export function endemicPrevalence(beta: number, gamma: number): number {
  const r0 = beta / gamma;
  return r0 > 1 ? 1 - 1 / r0 : 0;
}

/** di/dt = beta*i*(1-i) - gamma*i, as a 1-D ODE. */
export function sisDerivative(p: SisParams): Derivative {
  return (_t, y) => {
    const i = Math.min(Math.max(y[0] ?? 0, 0), 1);
    return [p.beta * i * (1 - i) - p.gamma * i];
  };
}

export function run(rawParams: Partial<SisParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const r0 = p.beta / p.gamma;
  const iStar = endemicPrevalence(p.beta, p.gamma);

  const traj = rk45(sisDerivative(p), [p.i0], 0, p.tEnd, {
    tol: p.tol,
    outputPoints: p.outputPoints,
  });
  const infected = traj.y.map((row) => Math.min(Math.max(row[0] ?? 0, 0), 1));
  const finalPrevalence = infected[infected.length - 1] ?? 0;
  const endemic = r0 > 1;

  const metrics: Metric[] = [
    { key: 'r0', label: 'Basic reproduction number R₀', value: r0, note: 'beta / gamma' },
    {
      key: 'endemicPrevalence',
      label: 'Endemic prevalence i*',
      value: iStar,
      note: r0 > 1 ? '1 - 1/R₀ (persistent)' : 'disease-free (R₀ ≤ 1)',
    },
    {
      key: 'finalPrevalence',
      label: 'Final prevalence (t=tEnd)',
      value: finalPrevalence,
      note: 'simulated; converges to i*',
    },
    {
      key: 'endemic',
      label: 'Becomes endemic',
      value: endemic ? 1 : 0,
      note: '1 = persists at a positive steady state',
    },
  ];

  const idx = downsampleIndices(traj.t.length, p.outputPoints);
  const ts = idx.map((k) => traj.t[k] ?? 0);
  const iS = idx.map((k) => infected[k] ?? 0);
  const series: Series[] = [
    {
      x: ts,
      y: { infected: iS, susceptible: iS.map((v) => 1 - v) },
      xLabel: 'time',
      yLabel: 'fraction',
    },
  ];

  return {
    engine: 'sis',
    summary: endemic
      ? `SIS endemic at R₀=${r0.toFixed(2)}: prevalence settles to i*=${iStar.toFixed(3)}.`
      : `SIS below threshold (R₀=${r0.toFixed(2)} ≤ 1): infection dies out.`,
    metrics,
    series,
    detail: { r0, endemicPrevalence: iStar, finalPrevalence },
    provenance: provenance('sis', '1.0.0', p),
  };
}

export const spec: EngineSpec<SisParams> = {
  slug: 'sis',
  title: 'SIS Endemic Epidemic',
  domain: 'epidemiology',
  version: '1.0.0',
  description:
    'The SIS model for infections that confer no lasting immunity: the infected recover straight back to susceptible. In prevalence, di/dt = beta·i·(1−i) − gamma·i is a logistic equation. With R₀ = beta/gamma, the infection dies out for R₀ ≤ 1 and becomes endemic at the persistent steady state i* = 1 − 1/R₀ for R₀ > 1 — unlike the single self-limiting wave of an SIR epidemic.',
  references: [
    'Kermack, W.O. & McKendrick, A.G. (1932) Contributions to the mathematical theory of epidemics, II. Proc. R. Soc. Lond. A 138:55-83.',
    'Hethcote, H.W. (2000) The mathematics of infectious diseases. SIAM Review 42:599-653.',
    'Keeling, M.J. & Rohani, P. (2008) Modeling Infectious Diseases in Humans and Animals, ch. 2.',
  ],
  paramsSchema: paramsSchema as z.ZodType<SisParams>,
  run,
  example: paramsSchema.parse({ beta: 0.3, gamma: 0.1, i0: 0.01 }),
  tags: ['epidemiology', 'sis', 'endemic', 'logistic', 'ode', 'reproduction-number'],
};

export default spec;
