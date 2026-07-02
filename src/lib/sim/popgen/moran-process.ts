/**
 * Moran process — genetic drift and fixation in a finite population.
 *
 * A constant population of N individuals, some mutant (relative fitness r) and
 * the rest wild-type (fitness 1). Each step: one individual is chosen to
 * reproduce with probability proportional to fitness, and one is chosen
 * uniformly to die — so N stays fixed. The mutant count j performs a biased
 * birth-death random walk that is absorbed at 0 (loss) or N (fixation).
 *
 * The discrete-generation counterpart of Wright-Fisher (see `wright-fisher`),
 * the Moran model has an exact closed-form fixation probability for i initial
 * mutants:
 *
 *     r = 1 (neutral):   rho_i = i / N
 *     r != 1:            rho_i = (1 - (1/r)^i) / (1 - (1/r)^N)
 *
 * This engine reports that analytic value AND an empirical estimate from a
 * seeded Monte-Carlo ensemble of full realizations, so the two can be compared
 * (they agree). Deterministic: every draw comes from the seeded PRNG.
 *
 * References:
 *   - Moran, P.A.P. (1958) Random processes in genetics. Proc. Camb. Phil. Soc.
 *     54:60-71.
 *   - Nowak, M.A. (2006) Evolutionary Dynamics, ch. 6.
 *   - Ewens, W.J. (2004) Mathematical Population Genetics, 2nd ed.
 */

import { z } from 'zod';
import { type Rng, createRng } from '../core/prng';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Population size N. */
    populationSize: z.number().int().min(2).max(100_000).default(50),
    /** Initial number of mutants i (0 < i < N). */
    initialMutants: z.number().int().min(1).default(1),
    /** Relative fitness r of the mutant (1 = neutral, >1 beneficial, <1 deleterious). */
    relativeFitness: z.number().positive().default(2),
    /** Number of Monte-Carlo realizations for the empirical fixation estimate. */
    replicates: z.number().int().positive().max(50_000).default(500),
    /** Safety cap on steps per realization. */
    maxSteps: z.number().int().positive().max(50_000_000).default(2_000_000),
    /** Points kept for the plotted example trajectory. */
    outputPoints: z.number().int().positive().max(2000).default(400),
    /** RNG seed. */
    seed: z.union([z.number(), z.string()]).default('moran'),
  })
  .strict()
  .refine((p) => p.initialMutants < p.populationSize, {
    message: 'initialMutants must be < populationSize',
    path: ['initialMutants'],
  });

export type MoranProcessParams = z.infer<typeof paramsSchema>;

/** Exact fixation probability of i mutants of relative fitness r in a Moran population of N. */
export function moranFixationProbability(n: number, i: number, r: number): number {
  if (i <= 0) return 0;
  if (i >= n) return 1;
  if (Math.abs(r - 1) < 1e-12) return i / n;
  const q = 1 / r;
  if (q > 1) {
    // Deleterious mutant (r < 1): q**i and q**n would overflow to +Infinity, making
    // (1-Inf)/(1-Inf) = NaN. Divide through by q**n and use NEGATIVE exponents, which
    // underflow harmlessly to 0.
    const a = q ** -n;
    const b = q ** -(n - i);
    return (a - b) / (a - 1);
  }
  return (1 - q ** i) / (1 - q ** n);
}

interface Realization {
  fixed: boolean;
  absorbed: boolean;
  steps: number;
  trajectory: number[]; // mutant count over time (empty unless recorded)
}

/** One Moran realization from j0 mutants until absorption (or maxSteps). */
export function simulateMoran(
  n: number,
  j0: number,
  r: number,
  rng: Rng,
  maxSteps: number,
  record = false,
): Realization {
  let j = j0;
  const trajectory: number[] = record ? [j] : [];
  let steps = 0;
  while (j > 0 && j < n && steps < maxSteps) {
    const fitnessTotal = r * j + (n - j);
    const mutantReproduces = rng.next() < (r * j) / fitnessTotal;
    const mutantDies = rng.next() < j / n;
    if (mutantReproduces && !mutantDies) j++;
    else if (!mutantReproduces && mutantDies) j--;
    steps++;
    if (record) trajectory.push(j);
  }
  return { fixed: j >= n, absorbed: j <= 0 || j >= n, steps, trajectory };
}

function downsampleIndices(len: number, n: number): number[] {
  if (len <= n) return Array.from({ length: len }, (_, i) => i);
  const denom = Math.max(n - 1, 1);
  return Array.from({ length: n }, (_, i) => Math.round((i * (len - 1)) / denom));
}

export function run(rawParams: Partial<MoranProcessParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);

  const analytic = moranFixationProbability(p.populationSize, p.initialMutants, p.relativeFitness);

  // Monte-Carlo ensemble: independent seeded realizations.
  let fixations = 0;
  let absorbedCount = 0;
  let absorbedSteps = 0;
  for (let k = 0; k < p.replicates; k++) {
    const rng = createRng(`${p.seed}#${k}`);
    const res = simulateMoran(
      p.populationSize,
      p.initialMutants,
      p.relativeFitness,
      rng,
      p.maxSteps,
    );
    // Only absorbed realizations inform the estimate; runs capped at maxSteps are
    // neither fixed nor lost and would bias the fixation frequency toward 0.
    if (res.absorbed) {
      absorbedCount++;
      absorbedSteps += res.steps;
      if (res.fixed) fixations++;
    }
  }
  const empirical = absorbedCount > 0 ? fixations / absorbedCount : Number.NaN;
  const meanAbsorptionTime = absorbedCount > 0 ? absorbedSteps / absorbedCount : Number.NaN;
  const nonAbsorbedFraction = (p.replicates - absorbedCount) / p.replicates;

  // One example trajectory for the chart.
  const example = simulateMoran(
    p.populationSize,
    p.initialMutants,
    p.relativeFitness,
    createRng(`${p.seed}#example`),
    p.maxSteps,
    true,
  );

  const metrics: Metric[] = [
    {
      key: 'analyticFixationProbability',
      label: 'Fixation probability (analytic)',
      value: analytic,
      note: 'exact closed form',
    },
    {
      key: 'empiricalFixationProbability',
      label: 'Fixation probability (Monte-Carlo)',
      value: empirical,
      note: `over ${absorbedCount} absorbed realizations`,
    },
    {
      key: 'meanAbsorptionTime',
      label: 'Mean absorption time',
      value: meanAbsorptionTime,
      unit: 'steps',
      note: 'over absorbed realizations',
    },
    {
      key: 'nonAbsorbedFraction',
      label: 'Non-absorbed fraction',
      value: nonAbsorbedFraction,
      note: 'runs that hit maxSteps without fixing or losing (excluded from the estimate)',
    },
    { key: 'populationSize', label: 'Population size N', value: p.populationSize },
    { key: 'relativeFitness', label: 'Relative fitness r', value: p.relativeFitness },
    {
      key: 'exampleFixed',
      label: 'Example realization fixed',
      value: example.fixed ? 1 : 0,
      note: '1 = the plotted run reached fixation',
    },
  ];

  const idx = downsampleIndices(example.trajectory.length, p.outputPoints);
  const series: Series[] = [
    {
      x: idx.map((i) => i),
      y: { mutants: idx.map((i) => example.trajectory[i] ?? 0) },
      xLabel: 'step',
      yLabel: 'mutant count',
    },
  ];

  return {
    engine: 'moran-process',
    summary: `Moran process (N=${p.populationSize}, r=${p.relativeFitness}): fixation probability ${(100 * analytic).toFixed(1)}% (analytic) vs ${(100 * empirical).toFixed(1)}% over ${p.replicates} runs.`,
    metrics,
    series,
    detail: { analyticFixationProbability: analytic, empiricalFixationProbability: empirical },
    provenance: provenance('moran-process', '1.0.0', p, p.seed),
  };
}

export const spec: EngineSpec<MoranProcessParams> = {
  slug: 'moran-process',
  title: 'Moran Process (fixation & drift)',
  domain: 'population-genetics',
  version: '1.0.0',
  description:
    'A finite population of N individuals where mutants (relative fitness r) and wild-type compete via overlapping-generation birth-death dynamics. The mutant count is a biased random walk absorbed at loss (0) or fixation (N). Reports the exact closed-form fixation probability — neutral i/N, or (1-(1/r)^i)/(1-(1/r)^N) under selection — alongside a seeded Monte-Carlo estimate that confirms it, plus an example trajectory.',
  references: [
    'Moran, P.A.P. (1958) Random processes in genetics. Proc. Camb. Phil. Soc. 54:60-71.',
    'Nowak, M.A. (2006) Evolutionary Dynamics: Exploring the Equations of Life, ch. 6.',
    'Ewens, W.J. (2004) Mathematical Population Genetics, 2nd ed.',
  ],
  paramsSchema: paramsSchema as z.ZodType<MoranProcessParams>,
  run,
  example: paramsSchema.parse({
    populationSize: 50,
    initialMutants: 1,
    relativeFitness: 2,
    replicates: 500,
  }),
  tags: ['population-genetics', 'fixation', 'genetic-drift', 'selection', 'stochastic', 'moran'],
};

export default spec;
