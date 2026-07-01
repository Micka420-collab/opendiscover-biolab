/**
 * Branching-process cell population growth (Galton-Watson).
 *
 * Models a proliferating cell lineage (e.g. a small tumor clone or a stem-cell
 * compartment) where, each generation, every existing cell independently
 * either dies (prob d), stays as one quiescent cell (prob s), or divides into
 * two daughter cells (prob b), with d + s + b = 1. This is the classical
 * Galton-Watson branching process — population-level growth/extinction
 * dynamics of individually-stochastic agents, NOT an explicit spatial tissue
 * model (no cell positions, contact inhibition, or diffusion here).
 *
 * Two exact, textbook results are used directly as verifiable invariants:
 *
 *   1. Mean population: E[Z_n] = m^n · Z_0, where m = s + 2b is the mean
 *      number of offspring per individual (law of total expectation, since
 *      each of the Z_n individuals independently contributes mean m to the
 *      next generation).
 *
 *   2. Extinction probability: the smallest root q ∈ [0,1] of q = f(q), where
 *      f(x) = d + s·x + b·x² is the offspring probability-generating
 *      function. For this quadratic f, q solves b·q² + (s−1)·q + d = 0.
 *      Extinction is certain (q=1) whenever m ≤ 1 (sub/critical); q<1 only
 *      when m>1 (supercritical) and d>0.
 *
 * A single stochastic realization is simulated exactly via the sequential-
 * binomial decomposition of a multinomial(N; d,s,b) draw — not an
 * approximation: split N cells into "died" ~ Binomial(N, d), then split the
 * survivors into "divided" ~ Binomial(N − nDied, b/(1−d)) (the conditional
 * divide-vs-stay odds given survival), which reproduces the same distribution
 * as flipping each cell's fate independently, without an O(N) per-cell loop.
 *
 * Determinism: every draw comes from the shared seeded PRNG (`core/prng`).
 *
 * References:
 *   - Galton F, Watson HW (1875). "On the probability of the extinction of
 *     families." J. Anthropol. Inst. Great Britain and Ireland 4:138–144.
 *   - Athreya KB, Ney PE. Branching Processes (1972) — extinction theorem.
 *   - Harris TE. The Theory of Branching Processes (1963).
 */

import { z } from 'zod';
import { createRng } from '../core/prng';
import { provenance } from '../core/types';
import type { EngineSpec, SimResult } from '../core/types';

// ---------------------------------------------------------------------------
// Core theory (pure, exact — no simulation involved)
// ---------------------------------------------------------------------------

/** Mean number of offspring per individual per generation: m = s + 2b. */
export function meanOffspring(deathProb: number, divideProb: number): number {
  const stayProb = 1 - deathProb - divideProb;
  return stayProb + 2 * divideProb;
}

export type Regime = 'subcritical' | 'critical' | 'supercritical';

export function classifyRegime(m: number): Regime {
  if (Math.abs(m - 1) < 1e-9) return 'critical';
  return m < 1 ? 'subcritical' : 'supercritical';
}

/**
 * Exact extinction probability: the smallest root in [0,1] of
 * b·q² + (s−1)·q + d = 0, where s = 1 − d − b.
 */
export function extinctionProbability(deathProb: number, divideProb: number): number {
  const b = divideProb;
  const s = 1 - deathProb - divideProb;
  if (b === 0) {
    // No branching: population never grows. Any death probability makes
    // eventual extinction certain (a lineage with only "stay" survives
    // generation n with probability s^n -> 0 whenever s < 1).
    return deathProb > 0 ? 1 : 0;
  }
  const A = b;
  const B = s - 1;
  const C = deathProb;
  const disc = B * B - 4 * A * C;
  const sqrtDisc = Math.sqrt(Math.max(0, disc));
  const roots = [(-B - sqrtDisc) / (2 * A), (-B + sqrtDisc) / (2 * A)]
    .filter((r) => r >= -1e-9 && r <= 1 + 1e-9)
    .map((r) => Math.max(0, Math.min(1, r)));
  return Math.min(...roots);
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

export interface LineageTrajectory {
  population: number[]; // length generations+1, population[0] = initial
  extinct: boolean;
  capped: boolean;
}

/**
 * Simulate ONE stochastic realization via the exact sequential-binomial
 * multinomial decomposition described above.
 */
export function simulateLineage(
  rng: ReturnType<typeof createRng>,
  initialCells: number,
  deathProb: number,
  divideProb: number,
  generations: number,
  maxPopulationCap: number,
): LineageTrajectory {
  const population = [initialCells];
  let n = initialCells;
  let capped = false;
  for (let g = 0; g < generations; g++) {
    if (n === 0) {
      population.push(0);
      continue;
    }
    if (n > maxPopulationCap) {
      capped = true;
      population.push(n);
      continue;
    }
    const nDied = rng.binomial(n, deathProb);
    const survivors = n - nDied;
    const divideOdds = deathProb < 1 ? divideProb / (1 - deathProb) : 0;
    const nDivided = survivors > 0 ? rng.binomial(survivors, divideOdds) : 0;
    const nStayed = survivors - nDivided;
    n = nStayed + 2 * nDivided;
    population.push(n);
  }
  return { population, extinct: n === 0, capped };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export const branchingGrowthParams = z.object({
  /** Starting number of cells. */
  initialCells: z.number().int().min(1).max(1000).default(20),
  /** Per-cell, per-generation probability of death. */
  deathProb: z.number().min(0).max(1).default(0.2),
  /** Per-cell, per-generation probability of dividing into 2 daughter cells. */
  divideProb: z.number().min(0).max(1).default(0.4),
  /** Number of generations to simulate. */
  generations: z.number().int().min(1).max(200).default(20),
  /** Independent stochastic replicates for the Monte-Carlo statistics. */
  replicates: z.number().int().min(1).max(2000).default(300),
  /** Safety cap on population size per replicate (keeps runtime bounded). */
  maxPopulationCap: z.number().int().min(10).default(200_000),
  /** RNG seed. */
  seed: z.union([z.string(), z.number()]).default('branching-growth'),
});

export type BranchingGrowthParams = z.input<typeof branchingGrowthParams>;

export interface BranchingGrowthDetail {
  meanOffspring: number;
  regime: Regime;
  extinctionProbabilityTheory: number;
  extinctionProbabilityEmpirical: number;
  meanPopulationByGeneration: number[];
  theoreticalMeanByGeneration: number[];
  sampleTrajectories: number[][];
  cappedReplicates: number;
}

function run(rawParams: BranchingGrowthParams): SimResult<BranchingGrowthDetail> {
  const p = branchingGrowthParams.parse(rawParams);
  if (p.deathProb + p.divideProb > 1) {
    throw new Error(
      'deathProb + divideProb must not exceed 1 (the remainder is the stay probability)',
    );
  }

  const rng = createRng(p.seed);
  const m = meanOffspring(p.deathProb, p.divideProb);
  const regime = classifyRegime(m);
  const qTheory = extinctionProbability(p.deathProb, p.divideProb);

  const sums = new Array(p.generations + 1).fill(0);
  let extinctCount = 0;
  let cappedCount = 0;
  const sampleTrajectories: number[][] = [];

  for (let r = 0; r < p.replicates; r++) {
    const traj = simulateLineage(
      rng,
      p.initialCells,
      p.deathProb,
      p.divideProb,
      p.generations,
      p.maxPopulationCap,
    );
    for (let g = 0; g <= p.generations; g++) sums[g] += traj.population[g];
    if (traj.extinct) extinctCount++;
    if (traj.capped) cappedCount++;
    if (sampleTrajectories.length < 8) sampleTrajectories.push(traj.population);
  }

  const meanPopulationByGeneration = sums.map((s) => s / p.replicates);
  const theoreticalMeanByGeneration = Array.from(
    { length: p.generations + 1 },
    (_, g) => p.initialCells * m ** g,
  );
  const extinctionProbabilityEmpirical = extinctCount / p.replicates;

  return {
    engine: 'branching-growth',
    summary: `${regime} branching process (mean offspring m=${m.toFixed(3)}): theoretical extinction probability ${qTheory.toFixed(3)}, observed ${extinctionProbabilityEmpirical.toFixed(3)} across ${p.replicates} replicates.`,
    metrics: [
      { key: 'meanOffspring', label: 'Mean offspring per cell (m)', value: m },
      {
        key: 'extinctionProbabilityTheory',
        label: 'Extinction probability (theory)',
        value: qTheory,
      },
      {
        key: 'extinctionProbabilityEmpirical',
        label: 'Extinction probability (observed)',
        value: extinctionProbabilityEmpirical,
      },
      {
        key: 'finalMeanPopulation',
        label: 'Mean population at final generation',
        value: meanPopulationByGeneration[meanPopulationByGeneration.length - 1],
      },
    ],
    series: [
      {
        x: Array.from({ length: p.generations + 1 }, (_, g) => g),
        y: {
          meanObserved: meanPopulationByGeneration,
          meanTheoretical: theoreticalMeanByGeneration,
        },
        xLabel: 'generation',
        yLabel: 'mean population size',
      },
    ],
    detail: {
      meanOffspring: m,
      regime,
      extinctionProbabilityTheory: qTheory,
      extinctionProbabilityEmpirical,
      meanPopulationByGeneration,
      theoreticalMeanByGeneration,
      sampleTrajectories,
      cappedReplicates: cappedCount,
    },
    provenance: provenance('branching-growth', '1.0.0', p, p.seed),
  };
}

export const spec: EngineSpec<BranchingGrowthParams, BranchingGrowthDetail> = {
  slug: 'branching-growth',
  title: 'Branching Process Cell Population Growth',
  domain: 'systems-biology',
  version: '1.0.0',
  description:
    'Simulates a proliferating cell lineage as a Galton-Watson branching process: each cell, ' +
    'per generation, independently dies, stays quiescent, or divides into two. Reports the exact ' +
    'theoretical mean-population growth rate and extinction probability (from the offspring ' +
    'generating function) alongside Monte-Carlo statistics from many stochastic replicates. ' +
    'Models population-level growth/extinction dynamics only — no spatial structure, cell ' +
    'positions, or contact inhibition.',
  references: [
    'Galton F, Watson HW (1875). J. Anthropol. Inst. 4:138 — extinction of family names.',
    'Athreya KB, Ney PE. Branching Processes (1972) — the extinction-probability theorem.',
  ],
  tags: ['branching-process', 'galton-watson', 'cell-population', 'stochastic', 'extinction'],
  paramsSchema: branchingGrowthParams,
  example: {
    initialCells: 20,
    deathProb: 0.2,
    divideProb: 0.4,
    generations: 20,
    replicates: 300,
    seed: 'clone-1',
  },
  run,
};
