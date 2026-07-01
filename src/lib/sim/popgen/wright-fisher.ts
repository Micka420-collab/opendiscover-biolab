/**
 * Wright-Fisher population genetics.
 *
 * Models the stochastic evolution of a single biallelic locus (alleles A and a)
 * in a finite, randomly-mating diploid population under the three classic forces:
 *
 *   - Genetic drift  — the next generation's 2N gene copies are a *random sample*
 *                      (with replacement) of the current gene pool.  We draw the
 *                      new count of A alleles as Binomial(2N, p'), which is the
 *                      exact Wright-Fisher transition kernel.
 *   - Selection      — genotypes AA / Aa / aa reproduce in proportion to their
 *                      relative fitnesses wAA / wAa / waa.  Under Hardy-Weinberg
 *                      mating the post-selection allele frequency is
 *                          p' = (p^2 wAA + p q wAa) / w̄,   w̄ = mean fitness.
 *   - Mutation       — recurrent forward (A→a, rate μ) and back (a→A, rate ν)
 *                      mutation:  p'' = p'(1-μ) + (1-p')ν.
 *
 * A single generation applies deterministic selection + mutation to obtain the
 * expected frequency, then multinomial (here binomial, for two alleles) sampling
 * of 2N gametes to inject drift.  This is the standard formulation in Ewens,
 * *Mathematical Population Genetics* and Gillespie, *Population Genetics: A
 * Concise Guide*.
 *
 * Key analytical facts this module reproduces and tests against:
 *   - Neutral drift: E[p_{t+1}] = p_t, so the mean final frequency over many
 *     replicates equals p0, and the probability that A ultimately fixes equals
 *     its initial frequency p0 (a cornerstone result of neutral theory).
 *   - Hardy-Weinberg: genotype frequencies (p^2, 2pq, q^2); p=½ → ¼ ; ½ ; ¼.
 *   - Directional selection: a favoured allele is driven towards fixation.
 *
 * A Moran-model variant (overlapping generations, one birth-death event per
 * step) is provided as well; its neutral fixation probability is i/N and its
 * selective fixation probability is the textbook (1 - r^-i)/(1 - r^-N).
 *
 * Determinism: all randomness flows through `createRng(seed)` from the shared
 * core PRNG.  No Date, no Math.random, no I/O.
 */

import { z } from 'zod';
import { type Rng, createRng } from '../core/prng';
import type { EngineSpec, SimResult } from '../core/types';
import { provenance } from '../core/types';

// ---------------------------------------------------------------------------
// Model parameter types
// ---------------------------------------------------------------------------

/** Relative fitnesses of the three genotypes (need not be normalised). */
export interface Fitness {
  wAA: number;
  wAa: number;
  waa: number;
}

/** Recurrent mutation rates per generation. */
export interface Mutation {
  /** Forward rate μ: A → a. */
  forward: number;
  /** Back rate ν: a → A. */
  back: number;
}

/** Neutral fitness (no selection). */
export const NEUTRAL_FITNESS: Fitness = { wAA: 1, wAa: 1, waa: 1 };
/** No mutation. */
export const NO_MUTATION: Mutation = { forward: 0, back: 0 };

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

// ---------------------------------------------------------------------------
// Deterministic (mean-field) building blocks
// ---------------------------------------------------------------------------

/**
 * Hardy-Weinberg genotype frequencies for allele frequency p (of A).
 * Assumes random mating and no evolutionary forces within a generation.
 * Returns { AA: p^2, Aa: 2pq, aa: q^2 }, which always sums to 1.
 */
export function hardyWeinberg(p: number): { AA: number; Aa: number; aa: number } {
  const q = 1 - p;
  return { AA: p * p, Aa: 2 * p * q, aa: q * q };
}

/** Population mean fitness w̄ = p^2 wAA + 2pq wAa + q^2 waa. */
export function meanFitness(p: number, f: Fitness): number {
  const q = 1 - p;
  return p * p * f.wAA + 2 * p * q * f.wAa + q * q * f.waa;
}

/**
 * Allele frequency after one round of viability selection under random mating.
 *   p' = (p^2 wAA + p q wAa) / w̄.
 * If mean fitness is zero (population extinction) the frequency is left
 * unchanged to avoid a division by zero.
 */
export function frequencyAfterSelection(p: number, f: Fitness): number {
  const q = 1 - p;
  const wbar = meanFitness(p, f);
  if (wbar <= 0) return p;
  const marginalA = p * f.wAA + q * f.wAa; // marginal fitness of an A allele
  return clamp01((p * marginalA) / wbar);
}

/** Allele frequency after recurrent mutation: p' = p(1-μ) + (1-p)ν. */
export function frequencyAfterMutation(p: number, m: Mutation): number {
  return clamp01(p * (1 - m.forward) + (1 - p) * m.back);
}

/**
 * Expected allele frequency in the next generation *before* drift: apply
 * selection, then mutation. This is the deterministic mean-field recursion and,
 * for the neutral case with no mutation, is the identity map (E[p']=p).
 */
export function expectedNextFrequency(p: number, f: Fitness, m: Mutation): number {
  return frequencyAfterMutation(frequencyAfterSelection(p, f), m);
}

/**
 * The mean-field (infinite-population, drift-free) frequency trajectory obtained
 * by iterating `expectedNextFrequency`. Length = generations + 1.
 */
export function deterministicTrajectory(
  initFreq: number,
  generations: number,
  f: Fitness,
  m: Mutation,
): number[] {
  const traj: number[] = [initFreq];
  let p = initFreq;
  for (let g = 0; g < generations; g++) {
    p = expectedNextFrequency(p, f, m);
    traj.push(p);
  }
  return traj;
}

// ---------------------------------------------------------------------------
// Stochastic Wright-Fisher dynamics
// ---------------------------------------------------------------------------

/**
 * One Wright-Fisher generation. Given the current count of A alleles among the
 * 2N gene copies, returns the new count after deterministic selection+mutation
 * followed by binomial resampling of 2N gametes (the drift step).
 */
export function wrightFisherGeneration(
  count: number,
  popSize: number,
  f: Fitness,
  m: Mutation,
  rng: Rng,
): number {
  const twoN = 2 * popSize;
  const p = count / twoN;
  const pExpected = expectedNextFrequency(p, f, m);
  return rng.binomial(twoN, pExpected);
}

/** Outcome of a single simulated replicate. */
export interface ReplicateResult {
  /** Allele frequency of A at generations 0..generations (length generations+1). */
  trajectory: number[];
  /** Frequency of A at the final recorded generation. */
  finalFreq: number;
  /** A reached fixation (count === 2N) at some generation. */
  fixed: boolean;
  /** A was lost (count === 0) at some generation. */
  lost: boolean;
  /** Generation index of first fixation of A, or null if never fixed. */
  fixationTime: number | null;
  /** Generation index of first absorption (fixation or loss), or null. */
  absorptionTime: number | null;
}

/**
 * Simulate one Wright-Fisher replicate for `generations` generations.
 *
 * When there is no mutation the boundary states (0 and 2N) are absorbing, so we
 * short-circuit once absorbed and pad the remaining trajectory with the constant
 * boundary frequency — this keeps every trajectory the same length while making
 * long neutral runs cheap. With mutation present the boundaries are permeable,
 * so we always simulate the full length.
 */
export function simulateReplicate(
  popSize: number,
  initFreq: number,
  generations: number,
  f: Fitness,
  m: Mutation,
  rng: Rng,
): ReplicateResult {
  const twoN = 2 * popSize;
  const absorbing = m.forward === 0 && m.back === 0;
  // Round the initial frequency to an integer allele count.
  let count = Math.round(initFreq * twoN);
  const trajectory: number[] = [count / twoN];

  let fixationTime: number | null = count === twoN ? 0 : null;
  let absorptionTime: number | null = count === twoN || count === 0 ? 0 : null;

  for (let g = 1; g <= generations; g++) {
    if (absorbing && (count === 0 || count === twoN)) {
      // Absorbed: frequency is frozen, so just repeat it for the remaining gens.
      const frozen = count / twoN;
      for (let k = g; k <= generations; k++) trajectory.push(frozen);
      break;
    }
    count = wrightFisherGeneration(count, popSize, f, m, rng);
    trajectory.push(count / twoN);
    if (fixationTime === null && count === twoN) fixationTime = g;
    if (absorptionTime === null && (count === twoN || count === 0)) absorptionTime = g;
  }

  const finalFreq = trajectory[trajectory.length - 1] ?? count / twoN;
  return {
    trajectory,
    finalFreq,
    fixed: fixationTime !== null,
    lost: absorptionTime !== null && fixationTime === null,
    fixationTime,
    absorptionTime,
  };
}

/** Aggregate statistics over many replicates. */
export interface WrightFisherStats {
  replicates: ReplicateResult[];
  /** Mean allele frequency at the final generation across replicates. */
  meanFinalFreq: number;
  /** Empirical fixation probability of A (fraction of replicates that fixed). */
  fixationProbability: number;
  /** Empirical loss probability of A. */
  lossProbability: number;
  /** Mean generations to fixation among replicates that fixed (0 if none). */
  meanTimeToFixation: number;
  /** Mean generations to absorption among replicates that were absorbed (0 if none). */
  meanAbsorptionTime: number;
}

export interface RunConfig {
  popSize: number;
  initFreq: number;
  generations: number;
  replicates: number;
  fitness: Fitness;
  mutation: Mutation;
  rng: Rng;
}

/** Run `replicates` independent Wright-Fisher trajectories and aggregate them. */
export function runWrightFisher(cfg: RunConfig): WrightFisherStats {
  const { popSize, initFreq, generations, replicates, fitness, mutation, rng } = cfg;
  const results: ReplicateResult[] = [];
  let sumFinal = 0;
  let fixed = 0;
  let lost = 0;
  let sumFixTime = 0;
  let sumAbsorbTime = 0;
  let absorbedCount = 0;

  for (let r = 0; r < replicates; r++) {
    const rep = simulateReplicate(popSize, initFreq, generations, fitness, mutation, rng);
    results.push(rep);
    sumFinal += rep.finalFreq;
    if (rep.fixed) {
      fixed++;
      sumFixTime += rep.fixationTime ?? 0;
    }
    if (rep.lost) lost++;
    if (rep.absorptionTime !== null) {
      absorbedCount++;
      sumAbsorbTime += rep.absorptionTime;
    }
  }

  return {
    replicates: results,
    meanFinalFreq: sumFinal / replicates,
    fixationProbability: fixed / replicates,
    lossProbability: lost / replicates,
    meanTimeToFixation: fixed > 0 ? sumFixTime / fixed : 0,
    meanAbsorptionTime: absorbedCount > 0 ? sumAbsorbTime / absorbedCount : 0,
  };
}

/**
 * Neutral fixation probability: under pure drift the probability that an allele
 * ultimately fixes equals its current frequency. Exact martingale result.
 */
export function neutralFixationProbability(p0: number): number {
  return p0;
}

// ---------------------------------------------------------------------------
// Moran model variant (overlapping generations)
// ---------------------------------------------------------------------------

/**
 * One step of the haploid Moran model on a population of `size` gene copies with
 * `i` copies of A. Exactly one individual reproduces (chosen with probability
 * proportional to fitness) and one dies (chosen uniformly at random); the
 * offspring replaces the dead individual. Returns the new count of A.
 *
 *   P(i → i+1) = [i fA / (i fA + (N-i) fa)] · [(N-i)/N]
 *   P(i → i-1) = [(N-i) fa / (i fA + (N-i) fa)] · [i/N]
 */
export function moranStep(i: number, size: number, fA: number, fa: number, rng: Rng): number {
  if (i <= 0 || i >= size) return i; // absorbing boundaries
  const totalFitness = i * fA + (size - i) * fa;
  const reproduceA = rng.next() < (i * fA) / totalFitness;
  const dieA = rng.next() < i / size;
  if (reproduceA && !dieA) return i + 1;
  if (!reproduceA && dieA) return i - 1;
  return i;
}

/** Outcome of a single Moran replicate. */
export interface MoranResult {
  fixed: boolean;
  lost: boolean;
  /** Number of birth-death steps until absorption (or maxSteps if not absorbed). */
  steps: number;
}

/**
 * Simulate the Moran model from `initCount` copies of A until absorption (or
 * `maxSteps` steps as a safety cap).
 */
export function simulateMoran(
  size: number,
  initCount: number,
  fA: number,
  fa: number,
  maxSteps: number,
  rng: Rng,
): MoranResult {
  let i = initCount;
  let steps = 0;
  while (i > 0 && i < size && steps < maxSteps) {
    i = moranStep(i, size, fA, fa, rng);
    steps++;
  }
  return { fixed: i >= size, lost: i <= 0, steps };
}

/**
 * Analytic Moran fixation probability from `i` copies of A. For neutral fitness
 * (fA === fa) this is i/N; otherwise, with relative fitness r = fA/fa,
 *   ρ_i = (1 - r^-i) / (1 - r^-N)
 * (Nowak, *Evolutionary Dynamics*, ch. 6).
 */
export function moranFixationProbability(i: number, size: number, fA: number, fa: number): number {
  if (fA === fa) return i / size;
  const r = fA / fa;
  return (1 - r ** -i) / (1 - r ** -size);
}

// ---------------------------------------------------------------------------
// Engine spec
// ---------------------------------------------------------------------------

const fitnessSchema = z.object({
  wAA: z.number().nonnegative().describe('Relative fitness of the AA homozygote.'),
  wAa: z.number().nonnegative().describe('Relative fitness of the Aa heterozygote.'),
  waa: z.number().nonnegative().describe('Relative fitness of the aa homozygote.'),
});

const mutationSchema = z.object({
  forward: z.number().min(0).max(1).describe('Forward mutation rate μ (A→a).'),
  back: z.number().min(0).max(1).describe('Back mutation rate ν (a→A).'),
});

export const paramsSchema = z.object({
  popSize: z
    .number()
    .int()
    .positive()
    .describe('Number of diploid individuals N; the gene pool holds 2N copies.'),
  initFreq: z.number().min(0).max(1).describe('Initial frequency p0 of the focal allele A.'),
  // Optional (not `.default()`) so the schema's input and output types coincide,
  // which is required to assign the ZodObject to `EngineSpec.paramsSchema:
  // z.ZodType<TParams>`. Defaults are applied inside `runEngine`.
  generations: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Generations to simulate (default 200).'),
  replicates: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Number of independent replicate populations (default 200).'),
  selection: fitnessSchema
    .optional()
    .describe('Genotype fitnesses; omitted ⇒ neutral (wAA=wAa=waa=1).'),
  mutation: mutationSchema.optional().describe('Mutation rates; omitted ⇒ no mutation.'),
  seed: z
    .union([z.number().int(), z.string()])
    .optional()
    .describe('PRNG seed for reproducibility (default 1).'),
});

/** Defaults applied when the corresponding param is omitted. */
const DEFAULT_GENERATIONS = 200;
const DEFAULT_REPLICATES = 200;
const DEFAULT_SEED: number | string = 1;

export type WrightFisherParams = z.infer<typeof paramsSchema>;

interface WrightFisherDetail {
  hardyWeinbergAtStart: { AA: number; Aa: number; aa: number };
  neutralFixationProbability: number;
  numFixed: number;
  numLost: number;
  numSegregating: number;
  effectiveMutationApplied: boolean;
  selectionApplied: boolean;
}

/** Maximum number of example trajectories exposed as chart series. */
const MAX_EXAMPLE_TRAJECTORIES = 5;

function runEngine(params: WrightFisherParams): SimResult<WrightFisherDetail> {
  const p = paramsSchema.parse(params);
  const generations = p.generations ?? DEFAULT_GENERATIONS;
  const replicates = p.replicates ?? DEFAULT_REPLICATES;
  const seed = p.seed ?? DEFAULT_SEED;
  const fitness = p.selection ?? NEUTRAL_FITNESS;
  const mutation = p.mutation ?? NO_MUTATION;
  const rng = createRng(seed);

  const stats = runWrightFisher({
    popSize: p.popSize,
    initFreq: p.initFreq,
    generations,
    replicates,
    fitness,
    mutation,
    rng,
  });

  // A few example trajectories + the deterministic mean-field expectation.
  const x = Array.from({ length: generations + 1 }, (_, i) => i);
  const y: Record<string, number[]> = {};
  const examples = stats.replicates.slice(
    0,
    Math.min(MAX_EXAMPLE_TRAJECTORIES, stats.replicates.length),
  );
  examples.forEach((rep, i) => {
    y[`replicate ${i + 1}`] = rep.trajectory;
  });
  y['expected (mean-field)'] = deterministicTrajectory(p.initFreq, generations, fitness, mutation);

  const numFixed = stats.replicates.filter((r) => r.fixed).length;
  const numLost = stats.replicates.filter((r) => r.lost).length;
  const numSegregating = replicates - numFixed - numLost;

  const detail: WrightFisherDetail = {
    hardyWeinbergAtStart: hardyWeinberg(p.initFreq),
    neutralFixationProbability: neutralFixationProbability(p.initFreq),
    numFixed,
    numLost,
    numSegregating,
    effectiveMutationApplied: mutation.forward > 0 || mutation.back > 0,
    selectionApplied: !(fitness.wAA === fitness.wAa && fitness.wAa === fitness.waa),
  };

  const summary =
    `Wright-Fisher: N=${p.popSize} (2N=${2 * p.popSize}), p0=${p.initFreq}, ` +
    `${replicates} replicates × ${generations} gens → ` +
    `fixation P(A)≈${stats.fixationProbability.toFixed(3)}, ` +
    `mean final freq=${stats.meanFinalFreq.toFixed(3)}.`;

  return {
    engine: 'wright-fisher',
    summary,
    metrics: [
      {
        key: 'meanFinalFreq',
        label: 'Mean final allele frequency',
        value: stats.meanFinalFreq,
        note: 'Average frequency of A at the final generation across replicates.',
      },
      {
        key: 'fixationProbability',
        label: 'Empirical fixation probability of A',
        value: stats.fixationProbability,
        note: 'Fraction of replicates in which A reached frequency 1 (neutral expectation = p0).',
      },
      {
        key: 'meanTimeToFixation',
        label: 'Mean time to fixation',
        value: stats.meanTimeToFixation,
        unit: 'generations',
        note: 'Averaged over replicates that fixed A; 0 if none fixed.',
      },
      {
        key: 'lossProbability',
        label: 'Empirical loss probability of A',
        value: stats.lossProbability,
      },
      {
        key: 'meanAbsorptionTime',
        label: 'Mean time to absorption',
        value: stats.meanAbsorptionTime,
        unit: 'generations',
        note: 'Fixation or loss, averaged over absorbed replicates.',
      },
    ],
    series: [
      {
        x,
        y,
        xLabel: 'generation',
        yLabel: 'frequency of A',
      },
    ],
    detail,
    provenance: provenance('wright-fisher', '1.0.0', { ...p }, seed),
  };
}

export const spec: EngineSpec<WrightFisherParams, WrightFisherDetail> = {
  slug: 'wright-fisher',
  title: 'Wright-Fisher Population Genetics',
  domain: 'population-genetics',
  version: '1.0.0',
  description:
    'Stochastic Wright-Fisher model of a biallelic locus in a finite diploid population. ' +
    'Each generation applies deterministic viability selection (genotype fitnesses wAA/wAa/waa) ' +
    'and recurrent mutation, then binomially resamples the 2N gametes to inject genetic drift. ' +
    'Runs many replicate trajectories and reports the mean final allele frequency, the empirical ' +
    'fixation probability (which equals p0 under neutrality), and the mean time to fixation, ' +
    'alongside Hardy-Weinberg genotype frequencies and example allele-frequency trajectories.',
  references: [
    'Ewens, W.J. (2004). Mathematical Population Genetics, 2nd ed. Springer.',
    'Gillespie, J.H. (2004). Population Genetics: A Concise Guide, 2nd ed. Johns Hopkins UP.',
    'Kimura, M. (1962). On the probability of fixation of mutant genes in a population. Genetics 47:713-719.',
    'Nowak, M.A. (2006). Evolutionary Dynamics. Harvard UP (Moran model).',
  ],
  paramsSchema,
  run: runEngine,
  example: {
    popSize: 100,
    initFreq: 0.5,
    generations: 200,
    replicates: 200,
    seed: 1,
  },
  tags: [
    'population-genetics',
    'genetic-drift',
    'selection',
    'mutation',
    'fixation',
    'wright-fisher',
    'moran',
  ],
};

export default spec;
