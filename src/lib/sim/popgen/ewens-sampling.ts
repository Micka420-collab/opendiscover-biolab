/**
 * Ewens sampling formula — the allelic spectrum of a neutral sample.
 *
 * Take a sample of n genes at a neutral locus evolving under the infinite-alleles
 * model (every mutation makes a brand-new allele), with scaled mutation rate
 * θ = 4Nμ. Ewens (1972) gives the stationary distribution of the *allelic
 * partition* — how the n genes fall into allele classes. Its key expectations are
 * exact, closed-form functions of (n, θ):
 *
 *   - Expected number of distinct alleles:  E[K_n] = Σ_{i=0}^{n-1} θ/(θ+i).
 *   - Expected homozygosity (P two random genes share an allele): F = 1/(1+θ),
 *     so the effective number of alleles is 1/F = 1+θ.
 *   - Expected frequency spectrum E[a_j] (alleles present in exactly j copies):
 *         E[a_j] = (θ/j) · Π_{k=0}^{j-1} (n−k)/(θ+n−1−k),
 *     which satisfies two identities used as test anchors — Σ_j E[a_j] = E[K_n]
 *     and Σ_j j·E[a_j] = n.
 *
 * Deterministic and analytic: no integrator, no randomness. The spectrum is built
 * with an O(n) recurrence whose denominators are bounded below by θ > 0.
 *
 * References:
 *   - Ewens, W.J. (1972) The sampling theory of selectively neutral alleles.
 *     Theoretical Population Biology 3:87-112.
 *   - Crow, J.F. & Kimura, M. (1970) An Introduction to Population Genetics Theory.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Sample size n (number of genes sampled). */
    sampleSize: z.number().int().min(2).max(2000).default(50),
    /** Scaled mutation rate θ = 4Nμ (> 0). */
    theta: z.number().positive().max(10_000).default(1),
  })
  .strict();

export type EwensSamplingParams = z.infer<typeof paramsSchema>;

/** Expected number of distinct alleles E[K_n] = Σ_{i=0}^{n-1} θ/(θ+i). */
export function expectedAlleles(n: number, theta: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += theta / (theta + i);
  return sum;
}

/**
 * Expected allele-frequency spectrum: `out[j-1] = E[a_j]`, the expected number of
 * alleles represented by exactly j copies, for j = 1..n. O(n) recurrence.
 */
export function alleleSpectrum(n: number, theta: number): number[] {
  const a = new Array<number>(n);
  a[0] = (n * theta) / (theta + n - 1); // E[a_1] = nθ/(θ+n−1)
  for (let j = 2; j <= n; j++) {
    const prev = a[j - 2] as number;
    // E[a_j] = E[a_{j−1}] · ((j−1)/j) · (n−j+1)/(θ+n−j); (θ+n−j) ≥ θ > 0.
    a[j - 1] = (prev * (j - 1) * (n - j + 1)) / (j * (theta + n - j));
  }
  return a;
}

export function run(rawParams: Partial<EwensSamplingParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const n = p.sampleSize;
  const theta = p.theta;

  const eK = expectedAlleles(n, theta);
  const homozygosity = 1 / (1 + theta);
  const effectiveAlleles = 1 + theta;
  const expectedSingletons = (n * theta) / (theta + n - 1);
  const spectrum = alleleSpectrum(n, theta);

  const metrics: Metric[] = [
    {
      key: 'expectedAlleles',
      label: 'Expected number of alleles E[K]',
      value: eK,
      note: 'Σ θ/(θ+i)',
    },
    {
      key: 'expectedHomozygosity',
      label: 'Expected homozygosity F',
      value: homozygosity,
      note: '1/(1+θ) — P two random genes share an allele',
    },
    {
      key: 'effectiveAlleles',
      label: 'Effective number of alleles',
      value: effectiveAlleles,
      note: '1/F = 1+θ',
    },
    {
      key: 'expectedSingletons',
      label: 'Expected singletons E[a₁]',
      value: expectedSingletons,
      note: 'nθ/(θ+n−1)',
    },
    { key: 'theta', label: 'Scaled mutation rate θ', value: theta },
    { key: 'sampleSize', label: 'Sample size n', value: n },
  ];

  const series: Series[] = [
    {
      x: Array.from({ length: n }, (_, i) => i + 1),
      y: { expectedCount: spectrum },
      xLabel: 'allele multiplicity j (copies in the sample)',
      yLabel: 'expected number of alleles E[a_j]',
    },
  ];

  return {
    engine: 'ewens-sampling',
    summary: `Ewens sampling (n=${n}, θ=${theta}): expect ${eK.toFixed(2)} distinct alleles, homozygosity ${homozygosity.toFixed(3)}, ~${expectedSingletons.toFixed(1)} singletons.`,
    metrics,
    series,
    detail: { expectedAlleles: eK, homozygosity, effectiveAlleles, expectedSingletons },
    provenance: provenance('ewens-sampling', '1.0.0', p),
  };
}

export const spec: EngineSpec<EwensSamplingParams> = {
  slug: 'ewens-sampling',
  title: 'Ewens Sampling Formula',
  domain: 'population-genetics',
  version: '1.0.0',
  description:
    'The Ewens sampling formula for a neutral sample of n genes under the infinite-alleles model with scaled mutation θ = 4Nμ. Reports the expected number of distinct alleles E[K] = Σθ/(θ+i), the expected homozygosity F = 1/(1+θ) (and effective allele number 1+θ), the expected singleton count, and the full expected allele-frequency spectrum E[a_j]. Closed-form and deterministic — a cornerstone of the neutral theory and the basis of the Ewens–Watterson neutrality test.',
  references: [
    'Ewens, W.J. (1972) The sampling theory of selectively neutral alleles. Theoretical Population Biology 3:87-112.',
    'Crow, J.F. & Kimura, M. (1970) An Introduction to Population Genetics Theory. Harper & Row.',
  ],
  paramsSchema: paramsSchema as z.ZodType<EwensSamplingParams>,
  run,
  example: paramsSchema.parse({ sampleSize: 50, theta: 1 }),
  tags: ['population-genetics', 'neutral-theory', 'infinite-alleles', 'ewens', 'homozygosity'],
};

export default spec;
