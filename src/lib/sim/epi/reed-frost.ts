/**
 * Reed–Frost chain-binomial epidemic (deterministic expectation).
 *
 * The classic DISCRETE-generation epidemic model (Reed & Frost, 1928). In each
 * generation the infectives I_t each make "adequate contact" with a given
 * susceptible independently with probability p, so a susceptible escapes all of
 * them with probability (1−p)^{I_t} and the expected new cases are
 *
 *     I_{t+1} = S_t · (1 − (1−p)^{I_t}),      S_{t+1} = S_t − I_{t+1}.
 *
 * This is the chain-binomial counterpart of the continuous SIR ODE: generations
 * instead of continuous time, and a binomial escape term instead of mass action.
 * The basic reproduction number is R0 = p·(N−1); the model is parameterized by R0
 * (with p = R0/(N−1)) so it lines up with the other epidemic engines. For large N
 * the final epidemic size approaches the familiar z = 1 − e^(−R0·z).
 *
 * Deterministic: a bounded recurrence over the expected counts (no randomness), run
 * until incidence dies out or a generation cap is hit; all counts stay in [0, N].
 *
 * References:
 *   - Abbey, H. (1952) An examination of the Reed-Frost theory of epidemics. Human
 *     Biology 24:201-233.
 *   - Bailey, N.T.J. (1975) The Mathematical Theory of Infectious Diseases, 2nd ed.
 */

import { z } from 'zod';
import { downsampleIndices } from '../core/series';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Total population N. */
    population: z.number().int().min(2).max(10_000_000).default(1000),
    /** Basic reproduction number R0 = p·(N−1). */
    r0: z.number().min(0).max(50).default(2.5),
    /** Initial infectives (index cases). */
    initialInfectives: z.number().int().min(1).default(1),
    /** Individuals already immune at the start (removed from the susceptible pool). */
    initialImmune: z.number().int().min(0).default(0),
    /** Generation cap (the epidemic usually dies out well before this). */
    maxGenerations: z.number().int().min(1).max(1000).default(200),
  })
  .strict()
  .refine((p) => p.initialInfectives + p.initialImmune <= p.population, {
    message: 'initialInfectives + initialImmune must not exceed the population',
  });

export type ReedFrostParams = z.infer<typeof paramsSchema>;

/**
 * Final-size fraction z: the nontrivial root of z = 1 − e^(−R0·z) on (0,1).
 * Found by bisection — fixed-point iteration stalls as R0 → 1+ (its convergence
 * rate → 1), giving wrong values just above the epidemic threshold.
 */
export function analyticFinalSize(r0: number): number {
  if (r0 <= 1) return 0;
  // g(z) = z − (1 − e^(−R0 z)); g(0+) < 0 and g(1) = e^(−R0) > 0 for R0 > 1.
  const g = (z: number) => z - (1 - Math.exp(-r0 * z));
  let lo = 1e-12;
  let hi = 1;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface ReedFrostRun {
  generation: number[];
  newCases: number[];
  susceptible: number[];
  totalInfected: number;
  peakIncidence: number;
  peakGeneration: number;
  /** True if incidence fell below the die-out threshold; false if the generation cap was hit. */
  diedOut: boolean;
}

/** Run the deterministic Reed–Frost recurrence over expected counts. */
export function simulate(p: ReedFrostParams): ReedFrostRun {
  const N = p.population;
  const pContact = Math.min(p.r0 / (N - 1), 1 - 1e-12); // R0 = p·(N−1)
  const q = 1 - pContact;

  let S = N - p.initialInfectives - p.initialImmune;
  let I = p.initialInfectives;
  const generation = [0];
  const newCases = [I];
  const susceptible = [S];
  let totalInfected = I;
  let peakIncidence = I;
  let peakGeneration = 0;
  let diedOut = false;

  for (let g = 1; g <= p.maxGenerations; g++) {
    const newI = S * (1 - q ** I); // expected new cases this generation
    if (newI < 1e-9) {
      diedOut = true; // incidence has effectively died out
      break;
    }
    S -= newI;
    I = newI;
    totalInfected += newI;
    generation.push(g);
    newCases.push(newI);
    susceptible.push(S);
    if (newI > peakIncidence) {
      peakIncidence = newI;
      peakGeneration = g;
    }
  }

  return {
    generation,
    newCases,
    susceptible,
    totalInfected,
    peakIncidence,
    peakGeneration,
    diedOut,
  };
}

export function run(rawParams: Partial<ReedFrostParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const N = p.population;
  const sim = simulate(p);

  const attackRate = sim.totalInfected / N;
  const herdImmunityThreshold = p.r0 > 1 ? 1 - 1 / p.r0 : 0;
  const analytic = analyticFinalSize(p.r0);

  const metrics: Metric[] = [
    { key: 'basicReproductionNumber', label: 'Basic reproduction number R₀', value: p.r0 },
    {
      key: 'attackRate',
      label: 'Attack rate (fraction ever infected)',
      value: attackRate,
      note: 'total infected / N',
    },
    { key: 'totalInfected', label: 'Total ever infected', value: sim.totalInfected },
    {
      key: 'analyticFinalSize',
      label: 'Analytic final size z',
      value: analytic,
      note: 'z = 1 − e^(−R₀z); the large-N limit',
    },
    { key: 'peakIncidence', label: 'Peak new cases in a generation', value: sim.peakIncidence },
    { key: 'peakGeneration', label: 'Peak generation', value: sim.peakGeneration },
    {
      key: 'epidemicDuration',
      label: 'Generations to die-out',
      value: sim.generation.length - 1,
      note: sim.diedOut ? undefined : 'generation cap reached — outbreak not yet extinct',
    },
    {
      key: 'herdImmunityThreshold',
      label: 'Herd-immunity threshold',
      value: herdImmunityThreshold,
      note: '1 − 1/R₀',
    },
  ];

  const idx = downsampleIndices(sim.generation.length, 2000);
  const series: Series[] = [
    {
      x: idx.map((k) => sim.generation[k] ?? 0),
      y: {
        newCases: idx.map((k) => sim.newCases[k] ?? 0),
        susceptible: idx.map((k) => sim.susceptible[k] ?? 0),
      },
      xLabel: 'generation',
      yLabel: 'individuals',
    },
  ];

  return {
    engine: 'reed-frost',
    summary:
      p.r0 > 1
        ? `Reed–Frost (R₀=${p.r0}): epidemic infects ${(100 * attackRate).toFixed(1)}% over ${sim.generation.length - 1} generations, peaking at generation ${sim.peakGeneration}.`
        : `Reed–Frost (R₀=${p.r0}): sub-critical — the outbreak fizzles, infecting ${(100 * attackRate).toFixed(2)}%.`,
    metrics,
    series,
    detail: {
      attackRate,
      analyticFinalSize: analytic,
      peakIncidence: sim.peakIncidence,
      peakGeneration: sim.peakGeneration,
      herdImmunityThreshold,
    },
    provenance: provenance('reed-frost', '1.0.0', p),
  };
}

export const spec: EngineSpec<ReedFrostParams> = {
  slug: 'reed-frost',
  title: 'Reed–Frost Chain-Binomial Epidemic',
  domain: 'epidemiology',
  version: '1.0.0',
  description:
    'The Reed–Frost chain-binomial epidemic: a discrete-generation model where the expected new cases are I_{t+1}=S_t(1−(1−p)^{I_t}) with p=R₀/(N−1). The discrete, binomial-escape counterpart of the continuous SIR ODE. Reports the attack rate and full incidence curve, the peak generation, epidemic duration, the herd-immunity threshold 1−1/R₀, and the large-N analytic final size z=1−e^(−R₀z) for comparison. Deterministic expectation, all counts clamped to [0,N].',
  references: [
    'Abbey, H. (1952) An examination of the Reed-Frost theory of epidemics. Human Biology 24:201-233.',
    'Bailey, N.T.J. (1975) The Mathematical Theory of Infectious Diseases, 2nd ed. Griffin.',
  ],
  paramsSchema: paramsSchema as z.ZodType<ReedFrostParams>,
  run,
  example: paramsSchema.parse({ population: 1000, r0: 2.5, initialInfectives: 1 }),
  tags: ['epidemiology', 'reed-frost', 'chain-binomial', 'discrete-time', 'final-size'],
};

export default spec;
