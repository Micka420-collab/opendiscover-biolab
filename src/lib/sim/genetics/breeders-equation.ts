/**
 * The breeder's equation — how fast a trait shifts under selection, generation by generation.
 *
 * Selective breeding (of crops, livestock, dogs, lab strains) rests on one deceptively simple
 * law. Each generation you pick as parents the individuals whose trait sits above the population
 * mean by an amount S (the selection differential), and the population responds by shifting its
 * mean by
 *
 *     R = h² · S,
 *
 * where h² is the narrow-sense heritability — the fraction of the trait's variation that is
 * passed on additively from parent to offspring. Only the heritable fraction of your selection
 * carries over, so R is always ≤ S. Repeat with a constant S each generation and the mean climbs
 * steadily: after t generations M(t) = M₀ + t·h²·S.
 *
 * This engine reports the response per generation, the total response over the run, the final
 * mean, and the realized heritability, plus the trait-mean trajectory. It explains why a highly
 * heritable trait (like body size) responds fast to selection while a barely-heritable one (like
 * many fitness traits) crawls, and why choosing more extreme parents (a bigger S) speeds
 * everything up.
 *
 * Closed-form, linear and deterministic; every field is a product of bounded inputs, so all
 * outputs stay finite.
 *
 * References:
 *   - Lush, J.L. (1937) Animal Breeding Plans.
 *   - Falconer, D.S. & Mackay, T.F.C. (1996) Introduction to Quantitative Genetics, 4th ed.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Starting population mean of the trait, M₀ (trait units). */
    initialMean: z.number().min(-1e9).max(1e9).default(100),
    /** Narrow-sense heritability h² — the additively-heritable fraction (0–1). */
    heritability: z.number().min(0).max(1).default(0.5),
    /** Selection differential S — how far the chosen parents' mean sits above the population's. */
    selectionDifferential: z.number().min(0).max(1e6).default(2),
    /** Number of generations of selection. */
    generations: z.number().int().min(1).max(1e6).default(10),
    /** Points in the plotted trait-mean trajectory. */
    outputPoints: z.number().int().min(4).max(4000).default(100),
  })
  .strict();

export type BreedersParams = z.infer<typeof paramsSchema>;

/** Response to selection per generation: R = h²·S. */
export function responseToSelection(heritability: number, selectionDifferential: number): number {
  return heritability * selectionDifferential;
}

export function run(rawParams: Partial<BreedersParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { initialMean: m0, heritability: h2, selectionDifferential: s, generations: g } = p;

  const responsePerGeneration = responseToSelection(h2, s);
  const totalResponse = g * responsePerGeneration;
  const finalMean = m0 + totalResponse;

  const metrics: Metric[] = [
    {
      key: 'responsePerGeneration',
      label: 'Response per generation',
      value: responsePerGeneration,
      note: 'R = h²·S — the shift in the mean each generation',
    },
    {
      key: 'totalResponse',
      label: `Total response over ${g} generations`,
      value: totalResponse,
      note: 'generations × h²·S',
    },
    {
      key: 'finalMean',
      label: 'Final trait mean',
      value: finalMean,
      note: 'M₀ + total response',
    },
    {
      key: 'realizedHeritability',
      label: 'Heritability h²',
      value: h2,
      note: 'the fraction of each selection differential that carries over',
    },
  ];

  const n = p.outputPoints;
  const gens = Array.from({ length: n }, (_, i) => (g * i) / (n - 1));
  const mean = gens.map((t) => m0 + t * responsePerGeneration);
  const series: Series[] = [
    {
      x: gens,
      y: { mean },
      xLabel: 'generation',
      yLabel: 'trait mean',
    },
  ];

  return {
    engine: 'breeders-equation',
    summary: `Breeder's equation: with h²=${h2} and a selection differential of ${s}, the mean shifts ${responsePerGeneration.toPrecision(3)} per generation. Over ${g} generations it climbs from ${m0} to ${finalMean.toPrecision(4)} (total response ${totalResponse.toPrecision(3)}).`,
    metrics,
    series,
    detail: { responsePerGeneration, totalResponse, finalMean, heritability: h2 },
    provenance: provenance('breeders-equation', '1.0.0', p),
  };
}

export const spec: EngineSpec<BreedersParams> = {
  slug: 'breeders-equation',
  title: "Breeder's Equation (Response to Selection)",
  domain: 'population-genetics',
  version: '1.0.0',
  description:
    "How fast a trait shifts under selective breeding, from the breeder's equation R=h²·S. Each generation the selected parents exceed the population mean by the selection differential S, and the mean responds by R=h²·S, where the narrow-sense heritability h² is the additively-heritable fraction that actually carries over (so R≤S). With constant selection the mean climbs linearly, M(t)=M₀+t·h²·S. Reports the response per generation, the total response, the final mean and the realized heritability, plus the trait-mean trajectory. Shows why highly heritable traits respond fast to selection while barely-heritable ones crawl. Closed-form, linear and deterministic.",
  references: [
    'Lush, J.L. (1937) Animal Breeding Plans.',
    'Falconer, D.S. & Mackay, T.F.C. (1996) Introduction to Quantitative Genetics, 4th ed.',
  ],
  paramsSchema: paramsSchema as z.ZodType<BreedersParams>,
  run,
  example: paramsSchema.parse({
    initialMean: 100,
    heritability: 0.5,
    selectionDifferential: 2,
    generations: 10,
  }),
  tags: ['population-genetics', 'quantitative-genetics', 'heritability', 'selection', 'breeding'],
};

export default spec;
