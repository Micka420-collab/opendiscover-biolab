/**
 * Kingman coalescent — the expected genealogy of a neutral sample.
 *
 * Run evolution backwards: trace n sampled genes up their family tree until they
 * all meet at a single common ancestor. When k lineages remain, each pair coalesces
 * independently, so the total coalescence rate is C(k,2)=k(k−1)/2 and the waiting
 * time T_k (in coalescent units of N — or 2N for diploids — generations) is
 * exponential with mean
 *
 *     E[T_k] = 2 / (k(k−1)).
 *
 * Summing gives the exact, closed-form summaries used everywhere in molecular
 * population genetics:
 *
 *     E[T_MRCA] = Σ_{k=2}^{n} E[T_k] = 2(1 − 1/n)          (time to the common ancestor)
 *     E[L]      = Σ_{k=2}^{n} k·E[T_k] = 2·Σ_{k=1}^{n−1} 1/k   (total branch length)
 *
 * Under the infinite-sites model with scaled mutation θ = 4Nμ, the expected number
 * of segregating (polymorphic) sites is E[S] = θ·a_n with a_n = Σ_{k=1}^{n−1} 1/k
 * (Watterson 1975), which inverts to the estimator θ̂_W = S/a_n; the expected number
 * of pairwise differences is E[π] = θ. Strikingly, the last coalescence (T_2, mean 1)
 * takes on average half of E[T_MRCA] no matter how large n is.
 *
 * Deterministic and analytic: no integrator, no randomness.
 *
 * References:
 *   - Kingman, J.F.C. (1982) The coalescent. Stochastic Processes and their
 *     Applications 13:235-248.
 *   - Watterson, G.A. (1975) On the number of segregating sites in genetical models
 *     without recombination. Theoretical Population Biology 7:256-276.
 *   - Wakeley, J. (2009) Coalescent Theory: An Introduction.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Sample size n (number of sampled lineages). */
    sampleSize: z.number().int().min(2).max(100_000).default(20),
    /** Scaled mutation rate θ = 4Nμ (≥ 0). */
    theta: z.number().min(0).max(1_000_000).default(5),
    /** Observed number of segregating sites S, for Watterson's θ̂_W (defaults to E[S]). */
    observedSegregatingSites: z.number().int().min(0).max(10_000_000).optional(),
  })
  .strict();

export type CoalescentParams = z.infer<typeof paramsSchema>;

/** Harmonic number H_m = Σ_{k=1}^{m} 1/k (H_0 = 0). */
export function harmonic(m: number): number {
  let s = 0;
  for (let k = 1; k <= m; k++) s += 1 / k;
  return s;
}

/** Expected coalescent waiting times E[T_k] = 2/(k(k−1)) for k = n, n−1, …, 2. */
export function coalescentTimes(n: number): { k: number; expectedTime: number }[] {
  const out: { k: number; expectedTime: number }[] = [];
  for (let k = n; k >= 2; k--) out.push({ k, expectedTime: 2 / (k * (k - 1)) });
  return out;
}

export function run(rawParams: Partial<CoalescentParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const n = p.sampleSize;
  const theta = p.theta;

  const times = coalescentTimes(n);
  const eTMRCA = times.reduce((s, t) => s + t.expectedTime, 0); // = 2(1 − 1/n)
  const eLength = times.reduce((s, t) => s + t.k * t.expectedTime, 0); // = 2·H_{n−1}
  const aN = harmonic(n - 1); // Watterson's a_n
  const expectedS = theta * aN;
  const expectedPairwiseDiversity = theta;

  // Watterson's estimator of θ from the observed (or expected) segregating-site count.
  const observedS = p.observedSegregatingSites ?? Math.round(expectedS);
  const wattersonTheta = aN > 0 ? observedS / aN : 0;

  const metrics: Metric[] = [
    {
      key: 'expectedTMRCA',
      label: 'E[time to MRCA]',
      value: eTMRCA,
      note: '2(1 − 1/n), in coalescent units of N generations',
    },
    {
      key: 'expectedTreeLength',
      label: 'E[total branch length]',
      value: eLength,
      note: '2·Σ 1/k',
    },
    {
      key: 'expectedSegregatingSites',
      label: 'E[segregating sites]',
      value: expectedS,
      note: 'θ·a_n (infinite-sites)',
    },
    {
      key: 'expectedPairwiseDiversity',
      label: 'E[pairwise differences] π',
      value: expectedPairwiseDiversity,
      note: '= θ',
    },
    { key: 'harmonicNumber', label: "Watterson's a_n", value: aN, note: 'Σ_{k=1}^{n−1} 1/k' },
    {
      key: 'wattersonTheta',
      label: 'θ̂_W (from S)',
      value: wattersonTheta,
      note: `S/a_n with S=${observedS}`,
    },
    { key: 'sampleSize', label: 'Sample size n', value: n },
  ];

  const series: Series[] = [
    {
      x: times.map((t) => t.k),
      y: { expectedTime: times.map((t) => t.expectedTime) },
      xLabel: 'lineages remaining k',
      yLabel: 'expected waiting time E[T_k]',
    },
  ];

  return {
    engine: 'coalescent',
    summary: `Kingman coalescent (n=${n}, θ=${theta}): E[T_MRCA]=${eTMRCA.toFixed(3)}, E[tree length]=${eLength.toFixed(2)}, E[segregating sites]=${expectedS.toFixed(1)}.`,
    metrics,
    series,
    detail: {
      expectedTMRCA: eTMRCA,
      expectedTreeLength: eLength,
      harmonicNumber: aN,
      wattersonTheta,
    },
    provenance: provenance('coalescent', '1.0.0', p),
  };
}

export const spec: EngineSpec<CoalescentParams> = {
  slug: 'coalescent',
  title: 'Kingman Coalescent (tree summary)',
  domain: 'population-genetics',
  version: '1.0.0',
  description:
    "The Kingman coalescent — evolution run backwards — for a neutral sample of n genes. Reports the exact expected genealogy: time to the most recent common ancestor E[T_MRCA]=2(1−1/n), total branch length E[L]=2·Σ1/k, the per-level waiting times E[T_k]=2/(k(k−1)), and, under infinite sites with θ=4Nμ, the expected segregating-site count E[S]=θ·a_n with Watterson's estimator θ̂_W=S/a_n and expected pairwise diversity π=θ. The backward-time complement of the forward Wright-Fisher/Moran models and the basis of θ estimation and Tajima's D.",
  references: [
    'Kingman, J.F.C. (1982) The coalescent. Stochastic Processes and their Applications 13:235-248.',
    'Watterson, G.A. (1975) On the number of segregating sites in genetical models without recombination. Theoretical Population Biology 7:256-276.',
    'Wakeley, J. (2009) Coalescent Theory: An Introduction. Roberts & Company.',
  ],
  paramsSchema: paramsSchema as z.ZodType<CoalescentParams>,
  run,
  example: paramsSchema.parse({ sampleSize: 20, theta: 5 }),
  tags: ['population-genetics', 'coalescent', 'neutral-theory', 'watterson', 'genealogy'],
};

export default spec;
