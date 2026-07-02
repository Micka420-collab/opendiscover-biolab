/**
 * Hardy–Weinberg equilibrium test for a single biallelic locus.
 *
 * Given observed genotype counts (AA, Aa, aa), this does what a population
 * geneticist actually does: estimate the allele frequencies, compute the
 * genotype frequencies EXPECTED under Hardy–Weinberg equilibrium, and test the
 * observed counts against them with a chi-square goodness-of-fit test.
 *
 * With p = freq(A), q = freq(a) = 1 − p, the HW proportions are
 *
 *     AA : p²      Aa : 2pq      aa : q²
 *
 * A χ² statistic well below the df = 1, α = 0.05 critical value (3.841) means the
 * population is consistent with random mating; a large χ² signals a departure
 * (selection, inbreeding, population structure, assortative mating, …). The
 * inbreeding coefficient F = 1 − H_obs/H_exp quantifies the heterozygote deficit.
 *
 * Pure and deterministic — closed-form frequencies, no randomness.
 *
 * References:
 *   - Hardy, G.H. (1908) Mendelian proportions in a mixed population. Science 28:49-50.
 *   - Weinberg, W. (1908) Über den Nachweis der Vererbung beim Menschen.
 *   - Hartl, D.L. & Clark, A.G. (2007) Principles of Population Genetics, 4th ed.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Observed count of homozygous AA individuals. */
    countAA: z.number().int().min(0).default(35),
    /** Observed count of heterozygous Aa individuals. */
    countAa: z.number().int().min(0).default(48),
    /** Observed count of homozygous aa individuals. */
    countaa: z.number().int().min(0).default(17),
  })
  .strict()
  .refine((p) => p.countAA + p.countAa + p.countaa > 0, {
    message: 'need at least one individual',
    path: ['countAA'],
  });

export type HardyWeinbergParams = z.infer<typeof paramsSchema>;

/** χ² goodness-of-fit statistic; classes with zero expectation are skipped
 * (they carry zero observed count when p/q come from the data itself). */
export function chiSquare(observed: number[], expected: number[]): number {
  let chi = 0;
  for (let i = 0; i < observed.length; i++) {
    const e = expected[i] ?? 0;
    if (e <= 0) continue;
    const o = observed[i] ?? 0;
    chi += ((o - e) * (o - e)) / e;
  }
  return chi;
}

/** df = 1, α = 0.05 critical value for the biallelic HW test. */
export const CHI2_CRIT_DF1 = 3.841;

export function run(rawParams: Partial<HardyWeinbergParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const n = p.countAA + p.countAa + p.countaa;

  // Allele frequencies from the observed genotypes.
  const freqA = (2 * p.countAA + p.countAa) / (2 * n);
  const freqa = 1 - freqA;

  // Expected HW genotype frequencies and counts.
  const expFreq = { AA: freqA * freqA, Aa: 2 * freqA * freqa, aa: freqa * freqa };
  const expCount = { AA: n * expFreq.AA, Aa: n * expFreq.Aa, aa: n * expFreq.aa };

  const obsFreq = { AA: p.countAA / n, Aa: p.countAa / n, aa: p.countaa / n };

  const chi = chiSquare([p.countAA, p.countAa, p.countaa], [expCount.AA, expCount.Aa, expCount.aa]);
  const rejected = chi > CHI2_CRIT_DF1;

  const hExp = expFreq.Aa; // expected heterozygosity 2pq
  const hObs = obsFreq.Aa;
  const fInbreeding = hExp > 0 ? 1 - hObs / hExp : 0;

  const metrics: Metric[] = [
    { key: 'freqA', label: 'Allele frequency p (A)', value: freqA },
    { key: 'freqa', label: 'Allele frequency q (a)', value: freqa },
    { key: 'expectedHeterozygosity', label: 'Expected heterozygosity 2pq', value: hExp },
    { key: 'observedHeterozygosity', label: 'Observed heterozygosity', value: hObs },
    {
      key: 'inbreedingCoefficient',
      label: 'Inbreeding coefficient F',
      value: fInbreeding,
      note: '1 − H_obs/H_exp; >0 = heterozygote deficit',
    },
    {
      key: 'chiSquare',
      label: 'χ² statistic',
      value: chi,
      note: `df=1; > ${CHI2_CRIT_DF1} rejects HW at α=0.05`,
    },
    {
      key: 'rejectedHW',
      label: 'Departs from HW (α=0.05)',
      value: rejected ? 1 : 0,
      note: '1 = observed differs significantly from Hardy–Weinberg',
    },
  ];

  return {
    engine: 'hardy-weinberg',
    summary: rejected
      ? `Departs from Hardy–Weinberg (χ²=${chi.toFixed(2)} > ${CHI2_CRIT_DF1}); p(A)=${freqA.toFixed(3)}, F=${fInbreeding.toFixed(2)}.`
      : `Consistent with Hardy–Weinberg (χ²=${chi.toFixed(2)} ≤ ${CHI2_CRIT_DF1}); p(A)=${freqA.toFixed(3)}.`,
    metrics,
    detail: {
      observedGenotypeDistribution: [
        { genotype: 'AA', probability: obsFreq.AA },
        { genotype: 'Aa', probability: obsFreq.Aa },
        { genotype: 'aa', probability: obsFreq.aa },
      ],
      expectedGenotypeDistribution: [
        { genotype: 'AA', probability: expFreq.AA },
        { genotype: 'Aa', probability: expFreq.Aa },
        { genotype: 'aa', probability: expFreq.aa },
      ],
      expectedCounts: expCount,
    },
    provenance: provenance('hardy-weinberg', '1.0.0', p),
  };
}

export const spec: EngineSpec<HardyWeinbergParams> = {
  slug: 'hardy-weinberg',
  title: 'Hardy–Weinberg Equilibrium',
  domain: 'population-genetics',
  version: '1.0.0',
  description:
    'Tests observed genotype counts (AA, Aa, aa) at a biallelic locus against Hardy–Weinberg equilibrium. Estimates allele frequencies p and q, computes the expected p²:2pq:q² genotype proportions, runs a chi-square goodness-of-fit test (df=1), and reports the inbreeding coefficient F = 1 − H_obs/H_exp. A large χ² flags departure from random mating (selection, inbreeding, structure).',
  references: [
    'Hardy, G.H. (1908) Mendelian proportions in a mixed population. Science 28:49-50.',
    'Weinberg, W. (1908) Über den Nachweis der Vererbung beim Menschen.',
    'Hartl, D.L. & Clark, A.G. (2007) Principles of Population Genetics, 4th ed.',
  ],
  paramsSchema: paramsSchema as z.ZodType<HardyWeinbergParams>,
  run,
  example: paramsSchema.parse({ countAA: 35, countAa: 48, countaa: 17 }),
  tags: ['population-genetics', 'hardy-weinberg', 'allele-frequency', 'chi-square', 'inbreeding'],
};

export default spec;
