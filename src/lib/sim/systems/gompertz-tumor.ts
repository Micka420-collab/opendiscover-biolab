/**
 * Gompertz tumour growth — how a tumour (or any resource-limited cell population) grows when
 * its expansion slows as it fills the space and blood supply available to it.
 *
 * The Gompertz law is the workhorse model of tumour growth. Unlike logistic growth, which is
 * symmetric about its midpoint, Gompertz growth is LOP-SIDED: it is fastest very early (when
 * the population is only about 37% — 1/e — of its ceiling) and then decelerates gently over a
 * long tail as it approaches the maximum size K. In closed form,
 *
 *     N(t) = K · exp( ln(N₀/K) · e^(−b·t) ),
 *
 * where N₀ is the starting size, K the carrying capacity (the largest the tumour can reach for
 * a given blood supply), and b sets how fast growth decelerates. The instantaneous growth rate
 * is dN/dt = b·N·ln(K/N), a bell that peaks at N = K/e.
 *
 * This engine reports the final size, the fraction of capacity reached, the current and peak
 * growth rate, the size and time at the inflection (steepest-growth) point, plus the growth
 * curve and its bell-shaped growth-rate curve. It is a caricature of a real tumour — no
 * treatment, no metastasis — but it captures the central, clinically important fact that a
 * tumour grows fastest while it is still small and hardest to detect.
 *
 * Closed-form and deterministic. To stay finite for every schema-valid input, size ratios are
 * evaluated as differences of logs (log N₀ − log K) rather than log of a ratio, which would
 * underflow to −∞·0 = NaN for a tiny N₀ over a huge K.
 *
 * References:
 *   - Gompertz, B. (1825) Phil. Trans. R. Soc. 115:513-583.
 *   - Laird, A.K. (1964) Dynamics of tumour growth. Br. J. Cancer 18:490-502.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Starting size N₀ (cells, mm³, or any consistent unit). */
    initialSize: z.number().min(1e-9).max(1e12).default(0.01),
    /** Carrying capacity K — the largest the population can reach. */
    carryingCapacity: z.number().min(1e-9).max(1e12).default(1),
    /** Growth-deceleration constant b (1/time); larger = reaches the ceiling sooner. */
    growthRate: z.number().min(1e-6).max(10).default(0.2),
    /** Simulated time. */
    tEnd: z.number().min(1e-6).max(1e9).default(20),
    /** Points in the plotted curves. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type GompertzParams = z.infer<typeof paramsSchema>;

/**
 * Gompertz size at time t. Uses log(N0) − log(K) (not log(N0/K)) so the exponent stays finite
 * even when N0/K would underflow to 0.
 */
export function gompertz(t: number, n0: number, k: number, b: number): number {
  const lnN0overK = Math.log(n0) - Math.log(k); // finite for n0, k > 0
  return k * Math.exp(lnN0overK * Math.exp(-b * t));
}

/** Instantaneous growth rate dN/dt = b·N·(ln K − ln N) at a given size N. */
function growthRateAt(n: number, k: number, b: number): number {
  return b * n * (Math.log(k) - Math.log(n));
}

export function run(rawParams: Partial<GompertzParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { initialSize: n0, carryingCapacity: k, growthRate: b, tEnd } = p;

  const finalSize = gompertz(tEnd, n0, k, b);
  const fractionOfCapacity = finalSize / k;
  const currentGrowthRate = growthRateAt(n0, k, b);
  const peakGrowthRate = (b * k) / Math.E; // dN/dt maximised at N = K/e
  const inflectionSize = k / Math.E;

  // Steepest-growth time exists only while the tumour is still below K/e (ln(K/N0) > 1);
  // otherwise it is already past its peak → report 0. Guarded to always be finite.
  const lnRatio = Math.log(k) - Math.log(n0); // = ln(K/N0)
  const inflectionTime = lnRatio > 1 ? Math.log(lnRatio) / b : 0;

  const metrics: Metric[] = [
    {
      key: 'finalSize',
      label: `Size at t=${tEnd}`,
      value: finalSize,
      note: 'K·exp(ln(N₀/K)·e^(−b·t))',
    },
    {
      key: 'fractionOfCapacity',
      label: 'Fraction of capacity reached',
      value: fractionOfCapacity,
      note: 'final size ÷ K',
    },
    {
      key: 'currentGrowthRate',
      label: 'Initial growth rate',
      value: currentGrowthRate,
      note: 'dN/dt at the start = b·N₀·ln(K/N₀)',
    },
    {
      key: 'peakGrowthRate',
      label: 'Peak growth rate',
      value: peakGrowthRate,
      note: 'fastest dN/dt, reached at N = K/e',
    },
    {
      key: 'inflectionSize',
      label: 'Size at fastest growth',
      value: inflectionSize,
      note: 'K/e ≈ 37% of capacity — the steepest point',
    },
    {
      key: 'inflectionTime',
      label: 'Time of fastest growth',
      value: inflectionTime,
      note: lnRatio > 1 ? 'when the tumour passes K/e' : 'already past its steepest growth at t=0',
    },
  ];

  const n = p.outputPoints;
  const times = Array.from({ length: n }, (_, i) => (tEnd * i) / (n - 1));
  const size = times.map((t) => gompertz(t, n0, k, b));
  const growth = size.map((s) => growthRateAt(s, k, b));
  const series: Series[] = [
    {
      x: times,
      y: { size, growthRate: growth },
      xLabel: 'time',
      yLabel: 'size / growth rate',
    },
  ];

  return {
    engine: 'gompertz-tumor',
    summary: `Gompertz growth: from ${n0} the tumour reaches ${finalSize.toPrecision(3)} by t=${tEnd} (${(fractionOfCapacity * 100).toPrecision(3)}% of capacity ${k}). Growth is fastest at ${inflectionSize.toPrecision(3)} (K/e)${lnRatio > 1 ? `, around t=${inflectionTime.toPrecision(3)}` : ' — already passed'}, then decelerates.`,
    metrics,
    series,
    detail: { finalSize, fractionOfCapacity, inflectionSize, inflectionTime, peakGrowthRate },
    provenance: provenance('gompertz-tumor', '1.0.0', p),
  };
}

export const spec: EngineSpec<GompertzParams> = {
  slug: 'gompertz-tumor',
  title: 'Tumour Growth (Gompertz)',
  domain: 'systems-biology',
  version: '1.0.0',
  description:
    'How a tumour grows by the Gompertz law N(t)=K·exp(ln(N₀/K)·e^(−bt)) — the standard model of tumour growth. Unlike symmetric logistic growth, Gompertz growth is lop-sided: fastest when the tumour is only ~37% (1/e) of its ceiling and small enough to be hard to detect, then decelerating over a long tail toward the maximum size K. Reports the final size, fraction of capacity, current and peak growth rate, and the size (K/e) and time of the steepest-growth (inflection) point, plus the growth curve and its bell-shaped growth-rate curve. Closed-form and deterministic; ratios are evaluated as log differences so output stays finite for any valid input.',
  references: [
    'Gompertz, B. (1825) Phil. Trans. R. Soc. 115:513-583.',
    'Laird, A.K. (1964) Dynamics of tumour growth. Br. J. Cancer 18:490-502.',
  ],
  paramsSchema: paramsSchema as z.ZodType<GompertzParams>,
  run,
  example: paramsSchema.parse({
    initialSize: 0.01,
    carryingCapacity: 1,
    growthRate: 0.2,
    tEnd: 20,
  }),
  tags: ['systems-biology', 'tumour', 'cancer', 'gompertz', 'growth', 'oncology'],
};

export default spec;
