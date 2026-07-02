/**
 * Luria–Delbrück fluctuation test.
 *
 * The 1943 experiment (Nobel Prize 1969) that showed bacterial mutations arise at
 * random BEFORE selection, not in response to it. Many identical cultures are each
 * grown from a tiny inoculum to a large final size, then plated on a selective
 * agent (a phage); the number of pre-existing resistant mutants is counted per
 * culture.
 *
 * The two hypotheses give very different statistics:
 *   - "acquired immunity" (mutation induced by the phage): each cell mutates
 *     independently at plating → resistant counts are Poisson, variance ≈ mean.
 *   - "random mutation during growth" (the truth): a mutation early in a culture's
 *     growth founds a large clone, so a few "jackpot" cultures have enormous counts
 *     → the variance is FAR larger than the mean.
 *
 * This engine simulates the Lea–Coulson version: each culture draws its number of
 * mutations from Poisson(m), m = mutationRate·(Nt − N0); a mutation arising when
 * the population is size x leaves a clone of final size Nt/x, so the resistant
 * count is the sum of those clones. It reports the variance-to-mean ratio (the
 * fluctuation signature) and the classic p0 mutation-rate estimate m = −ln(p0),
 * where p0 is the fraction of cultures with zero mutants.
 *
 * Deterministic: every culture draws from an independent seeded PRNG.
 *
 * References:
 *   - Luria, S.E. & Delbrück, M. (1943) Mutations of bacteria from virus
 *     sensitivity to virus resistance. Genetics 28:491-511.
 *   - Lea, D.E. & Coulson, C.A. (1949) The distribution of the numbers of mutants
 *     in bacterial populations. J. Genet. 49:264-285.
 *   - Foster, P.L. (2006) Methods for determining spontaneous mutation rates.
 *     Methods Enzymol. 409:195-213.
 */

import { z } from 'zod';
import { createRng } from '../core/prng';
import type { EngineSpec, Metric, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Mutation rate per cell division. */
    mutationRate: z.number().positive().default(1e-8),
    /** Final culture size Nt. */
    finalSize: z.number().positive().default(1e8),
    /** Initial inoculum size N0. */
    initialSize: z.number().positive().default(1),
    /** Number of parallel cultures. */
    cultures: z.number().int().min(2).max(200_000).default(2000),
    /** RNG seed. */
    seed: z.union([z.number(), z.string()]).default('luria-delbruck'),
  })
  .strict()
  .refine((p) => p.finalSize > p.initialSize, {
    message: 'finalSize must exceed initialSize',
    path: ['finalSize'],
  })
  .refine((p) => p.mutationRate * (p.finalSize - p.initialSize) * p.cultures <= 5e6, {
    message:
      'expected total mutations (mutationRate·(Nt−N0)·cultures) is too large to simulate — reduce the rate, size, or culture count',
    path: ['mutationRate'],
  });

export type LuriaDelbruckParams = z.infer<typeof paramsSchema>;

/** Hard cap on the per-culture clone loop, guaranteeing termination. */
const MAX_CLONES = 5_000_000;

/** Simulate one culture's resistant-mutant count (Lea–Coulson). */
export function simulateCulture(
  mutationRate: number,
  n0: number,
  nt: number,
  rng: ReturnType<typeof createRng>,
): number {
  const m = mutationRate * (nt - n0);
  const mutations = Math.min(rng.poisson(m), MAX_CLONES);
  let resistant = 0;
  for (let j = 0; j < mutations; j++) {
    const x = rng.uniform(n0, nt); // population size when the mutation arose
    resistant += Math.floor(nt / x); // clone grows to Nt/x by the end
  }
  return resistant;
}

const LOG_BINS: { label: string; lo: number; hi: number }[] = [
  { label: '0', lo: 0, hi: 0.5 },
  { label: '1–9', lo: 0.5, hi: 10 },
  { label: '10–99', lo: 10, hi: 100 },
  { label: '100–10³', lo: 100, hi: 1e3 },
  { label: '10³–10⁴', lo: 1e3, hi: 1e4 },
  { label: '10⁴–10⁵', lo: 1e4, hi: 1e5 },
  { label: '10⁵–10⁶', lo: 1e5, hi: 1e6 },
  { label: '≥10⁶', lo: 1e6, hi: Number.POSITIVE_INFINITY },
];

export function run(rawParams: Partial<LuriaDelbruckParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const m = p.mutationRate * (p.finalSize - p.initialSize);

  const counts: number[] = [];
  for (let k = 0; k < p.cultures; k++) {
    const rng = createRng(`${p.seed}#${k}`);
    counts.push(simulateCulture(p.mutationRate, p.initialSize, p.finalSize, rng));
  }

  let sum = 0;
  let zeros = 0;
  let peak = 0;
  for (const c of counts) {
    sum += c;
    if (c === 0) zeros++;
    if (c > peak) peak = c;
  }
  const mean = sum / p.cultures;
  let sqDev = 0;
  for (const c of counts) sqDev += (c - mean) * (c - mean);
  const variance = sqDev / p.cultures;
  const vmr = mean > 0 ? variance / mean : 0;

  const p0 = zeros / p.cultures;
  // p0 method: a culture has 0 mutants iff it had 0 mutations, so p0 = e^{−m}.
  // Laplace-smooth p0 by half a pseudo-count so the estimate stays finite even when
  // no (p0→0) or all (p0→1) cultures had a mutant.
  const estimatedMutations = -Math.log(Math.max(p0, 0.5 / p.cultures));
  const estimatedRate = estimatedMutations / (p.finalSize - p.initialSize);

  const metrics: Metric[] = [
    {
      key: 'expectedMutations',
      label: 'Expected mutations per culture m',
      value: m,
      note: 'μ·(Nt−N0)',
    },
    { key: 'meanResistant', label: 'Mean resistant count', value: mean },
    {
      key: 'varianceToMeanRatio',
      label: 'Variance-to-mean ratio',
      value: vmr,
      note: '≫1 = fluctuation signature (random mutation); ≈1 would mean Poisson (induced)',
    },
    { key: 'peakResistant', label: 'Largest jackpot', value: peak },
    { key: 'p0', label: 'Fraction with zero mutants (p0)', value: p0 },
    {
      key: 'estimatedMutations',
      label: 'Estimated m (p0 method)',
      value: estimatedMutations,
      note: '−ln(p0); recovers the true m',
    },
    { key: 'estimatedMutationRate', label: 'Estimated mutation rate', value: estimatedRate },
  ];

  // Heavy-tailed distribution of resistant counts across cultures (log bins).
  const binCounts = LOG_BINS.map(() => 0);
  for (const c of counts) {
    for (let b = 0; b < LOG_BINS.length; b++) {
      const bin = LOG_BINS[b];
      if (bin && c >= bin.lo && c < bin.hi) {
        binCounts[b] = (binCounts[b] ?? 0) + 1;
        break;
      }
    }
  }
  const resistantDistribution = LOG_BINS.map((bin, b) => ({
    bin: bin.label,
    probability: (binCounts[b] ?? 0) / p.cultures,
  }));

  return {
    engine: 'luria-delbruck',
    summary:
      mean > 0
        ? `Luria–Delbrück (m=${m.toFixed(2)}): mean ${mean.toFixed(1)} but variance/mean = ${vmr.toFixed(0)} (jackpots up to ${peak}) — mutations arose at random during growth.`
        : `Luria–Delbrück (m=${m.toFixed(2)}): no resistant mutants observed across ${p.cultures} cultures — the mutation rate is too low for this culture size.`,
    metrics,
    detail: {
      expectedMutations: m,
      estimatedMutations,
      varianceToMeanRatio: vmr,
      resistantDistribution,
    },
    provenance: provenance('luria-delbruck', '1.0.0', p, p.seed),
  };
}

export const spec: EngineSpec<LuriaDelbruckParams> = {
  slug: 'luria-delbruck',
  title: 'Luria–Delbrück Fluctuation Test',
  domain: 'population-genetics',
  version: '1.0.0',
  description:
    'The 1943 fluctuation test that proved mutations arise at random during growth, before selection. Many identical cultures are grown and screened for pre-existing resistant mutants; because an early mutation founds a large clone, a few "jackpot" cultures have enormous counts, so the variance of resistant counts is far larger than the mean — unlike the Poisson (variance ≈ mean) expected if resistance were induced by the selective agent. Simulates the Lea–Coulson model and reports the variance-to-mean ratio and the p0 mutation-rate estimate m = −ln(p0).',
  references: [
    'Luria, S.E. & Delbrück, M. (1943) Mutations of bacteria from virus sensitivity to virus resistance. Genetics 28:491-511.',
    'Lea, D.E. & Coulson, C.A. (1949) The distribution of the numbers of mutants in bacterial populations. J. Genet. 49:264-285.',
    'Foster, P.L. (2006) Methods for determining spontaneous mutation rates. Methods Enzymol. 409:195-213.',
  ],
  paramsSchema: paramsSchema as z.ZodType<LuriaDelbruckParams>,
  run,
  example: paramsSchema.parse({
    mutationRate: 1e-8,
    finalSize: 1e8,
    initialSize: 1,
    cultures: 2000,
  }),
  tags: [
    'population-genetics',
    'mutation',
    'fluctuation-test',
    'stochastic',
    'jackpot',
    'evolution',
  ],
};

export default spec;
