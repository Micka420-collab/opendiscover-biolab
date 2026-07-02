/**
 * Logistic map — deterministic chaos in a one-line population model.
 *
 *     x_{n+1} = r · x_n · (1 − x_n),      x ∈ [0, 1],  r ∈ [0, 4]
 *
 * Robert May's 1976 "simple mathematical models with very complicated dynamics":
 * a discrete population where growth (r) is checked by crowding (1 − x). As r
 * rises the long-run behaviour goes fixed point → period-2 → period-4 → … →
 * chaos, via the period-doubling (Feigenbaum) cascade.
 *
 * Deterministic and exact — pure integer iteration of a rational map, no clock,
 * no randomness. Two landmark facts anchor the test suite:
 *
 *  - Non-trivial fixed point x* = 1 − 1/r (r > 1), stable for 1 < r < 3.
 *  - At r = 4 the map is conjugate to the tent map, so its Lyapunov exponent is
 *    exactly λ = ln 2 ≈ 0.6931 — a hard number to hit by accident.
 *
 * The headline visual is the bifurcation diagram (attractor x vs r), returned as
 * a recommended scatter `vizSpec`.
 *
 * References:
 *   - May, R.M. (1976) Simple mathematical models with very complicated dynamics.
 *     Nature 261:459–467.
 *   - Strogatz, S.H. (2015) Nonlinear Dynamics and Chaos, 2nd ed., ch. 10.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Growth parameter r (0–4); >~3.57 is chaotic. */
    r: z.number().min(0).max(4).default(3.7),
    /** Initial population fraction x0 (0–1, exclusive of the 0.5 collapse point). */
    x0: z.number().gt(0).lt(1).default(0.4),
    /** Orbit length shown as the time series. */
    iterations: z.number().int().positive().max(5000).default(120),
    /** Iterations discarded before measuring the attractor / Lyapunov exponent. */
    transient: z.number().int().min(0).max(100_000).default(1000),
    /** Iterations averaged for the Lyapunov exponent. */
    analysisIterations: z.number().int().positive().max(200_000).default(4000),
    // --- bifurcation diagram ---
    /** Lower r for the bifurcation sweep. */
    rMin: z.number().min(0).max(4).default(2.5),
    /** Upper r for the bifurcation sweep. */
    rMax: z.number().min(0).max(4).default(4),
    /** Number of r columns in the sweep. */
    rSteps: z.number().int().positive().max(1000).default(200),
    /** Iterations discarded per r column before sampling the attractor. */
    bifTransient: z.number().int().min(0).max(100_000).default(400),
    /** Attractor points kept per r column. */
    bifSamples: z.number().int().positive().max(400).default(40),
  })
  .strict()
  .refine((p) => p.rMax > p.rMin, { message: 'rMax must exceed rMin', path: ['rMax'] });

export type LogisticMapParams = z.infer<typeof paramsSchema>;

const step = (r: number, x: number): number => r * x * (1 - x);

/** Lyapunov exponent λ = ⟨ln|f'(x)|⟩, f'(x) = r(1 − 2x). Skips measure-zero x=½. */
export function lyapunovExponent(r: number, x0: number, transient: number, n: number): number {
  let x = x0;
  for (let i = 0; i < transient; i++) x = step(r, x);
  let sum = 0;
  let counted = 0;
  for (let i = 0; i < n; i++) {
    const deriv = Math.abs(r * (1 - 2 * x));
    if (deriv > 0) {
      sum += Math.log(deriv);
      counted++;
    }
    x = step(r, x);
  }
  return counted > 0 ? sum / counted : Number.NEGATIVE_INFINITY;
}

/**
 * Smallest attractor period ≤ maxPeriod (1 = fixed point), or 0 if none is found
 * within tolerance (aperiodic / chaotic).
 */
export function attractorPeriod(r: number, x0: number, transient: number, maxPeriod = 64): number {
  let x = x0;
  for (let i = 0; i < transient; i++) x = step(r, x);
  const window: number[] = [];
  for (let i = 0; i < maxPeriod * 4; i++) {
    x = step(r, x);
    window.push(x);
  }
  for (let p = 1; p <= maxPeriod; p++) {
    let matches = true;
    for (let i = 0; i + p < window.length; i++) {
      if (Math.abs((window[i] ?? 0) - (window[i + p] ?? 0)) > 1e-6) {
        matches = false;
        break;
      }
    }
    if (matches) return p;
  }
  return 0;
}

export function run(rawParams: Partial<LogisticMapParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);

  // Orbit time series for the focus r.
  const xs: number[] = [];
  const ns: number[] = [];
  let x = p.x0;
  for (let n = 0; n <= p.iterations; n++) {
    ns.push(n);
    xs.push(x);
    x = step(p.r, x);
  }

  const fixedPoint = p.r > 1 ? 1 - 1 / p.r : 0;
  const lyap = lyapunovExponent(p.r, p.x0, p.transient, p.analysisIterations);
  const period = attractorPeriod(p.r, p.x0, p.transient);
  const chaotic = lyap > 0;

  const metrics: Metric[] = [
    {
      key: 'fixedPoint',
      label: 'Non-trivial fixed point x*',
      value: fixedPoint,
      note: p.r > 1 ? '1 − 1/r (stable only for r < 3)' : 'population collapses to 0 for r ≤ 1',
    },
    {
      key: 'lyapunovExponent',
      label: 'Lyapunov exponent λ',
      value: lyap,
      note: 'λ > 0 ⇒ sensitive dependence (chaos); at r=4, λ = ln 2',
    },
    {
      key: 'attractorPeriod',
      label: 'Attractor period',
      value: period,
      note: period === 0 ? 'aperiodic / chaotic' : `period-${period} cycle`,
    },
    {
      key: 'chaotic',
      label: 'Chaotic',
      value: chaotic ? 1 : 0,
      note: '1 = positive Lyapunov exponent',
    },
  ];

  const series: Series[] = [{ x: ns, y: { x: xs }, xLabel: 'iteration n', yLabel: 'xₙ' }];

  // Bifurcation diagram (attractor x vs r) as a recommended scatter vizSpec.
  const bif: { r: number; x: number }[] = [];
  const rDenom = Math.max(p.rSteps - 1, 1); // rSteps === 1 must not divide by zero
  for (let i = 0; i < p.rSteps; i++) {
    const rr = p.rMin + ((p.rMax - p.rMin) * i) / rDenom;
    let bx = p.x0;
    for (let k = 0; k < p.bifTransient; k++) bx = step(rr, bx);
    for (let k = 0; k < p.bifSamples; k++) {
      bx = step(rr, bx);
      bif.push({ r: rr, x: bx });
    }
  }
  const vizSpec: Record<string, unknown> = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    title: 'Bifurcation diagram (attractor vs r)',
    data: { values: bif },
    mark: { type: 'point', size: 2, filled: true, opacity: 0.35 },
    encoding: {
      x: { field: 'r', type: 'quantitative', title: 'r', scale: { zero: false } },
      y: { field: 'x', type: 'quantitative', title: 'x (attractor)' },
    },
    width: 'container',
    height: 320,
  };

  const regime = chaotic
    ? 'chaotic'
    : period === 1
      ? 'a stable fixed point'
      : period > 0
        ? `a period-${period} cycle`
        : 'non-chaotic';

  return {
    engine: 'logistic-map',
    summary: `Logistic map at r=${p.r.toFixed(2)}: λ=${lyap.toFixed(3)} — ${regime}${
      period > 0 ? ` (x*=${fixedPoint.toFixed(3)})` : ''
    }.`,
    metrics,
    series,
    vizSpec,
    detail: { focusR: p.r, fixedPoint, lyapunovExponent: lyap, attractorPeriod: period },
    provenance: provenance('logistic-map', '1.0.0', p),
  };
}

export const spec: EngineSpec<LogisticMapParams> = {
  slug: 'logistic-map',
  title: 'Logistic Map (deterministic chaos)',
  domain: 'ecology',
  version: '1.0.0',
  description:
    "Robert May's logistic map x → r·x·(1−x): a one-line discrete population model whose long-run behaviour period-doubles into chaos as the growth parameter r rises. Reports the non-trivial fixed point x*=1−1/r, the Lyapunov exponent (exactly ln 2 at r=4), the attractor period, and the full bifurcation diagram.",
  references: [
    'May, R.M. (1976) Simple mathematical models with very complicated dynamics. Nature 261:459-467.',
    'Feigenbaum, M.J. (1978) Quantitative universality for a class of nonlinear transformations. J. Stat. Phys. 19:25-52.',
    'Strogatz, S.H. (2015) Nonlinear Dynamics and Chaos, 2nd ed., ch. 10.',
  ],
  paramsSchema: paramsSchema as z.ZodType<LogisticMapParams>,
  run,
  example: paramsSchema.parse({ r: 3.7, x0: 0.4 }),
  tags: ['ecology', 'chaos', 'bifurcation', 'nonlinear', 'population', 'dynamical-systems'],
};

export default spec;
