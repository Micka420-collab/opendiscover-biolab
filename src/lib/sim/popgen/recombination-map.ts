/**
 * Genetic recombination & linkage mapping — how far apart two genes sit on a chromosome.
 *
 * Two genes on the same chromosome are inherited together unless a crossover falls between
 * them, and the further apart they are, the more often that happens. The recombination
 * frequency r (fraction of offspring that are recombinant) is therefore a ruler for genetic
 * distance — 1% recombination ≈ 1 centimorgan (cM). But for distant genes a second crossover
 * undoes the first, so r saturates toward ½ and UNDER-reports the true distance. A mapping
 * function corrects for that:
 *
 *   Morgan  (naive):   r = d              (only valid for small d)
 *   Haldane (no interference): r = ½(1 − e^(−2d))
 *   Kosambi (interference):    r = ½·tanh(2d)
 *
 * with d the map distance in Morgans (d = cM/100). This engine takes a true map distance and
 * reports the recombination frequency each function predicts, the naive-vs-corrected gap, and
 * the r-versus-distance curve that flattens at ½.
 *
 * Closed-form and deterministic; r stays bounded in [0, ½] (it reaches ½ only for effectively
 * unlinked genes), so nothing ever diverges.
 *
 * References:
 *   - Sturtevant, A.H. (1913) The linear arrangement of six sex-linked factors in Drosophila.
 *     J. Exp. Zool. 14:43-59.
 *   - Haldane, J.B.S. (1919); Kosambi, D.D. (1943) The estimation of map distances from
 *     recombination values. Ann. Eugen. 12:172-175.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** True map distance between the two genes (centimorgans). */
    mapDistanceCm: z.number().min(0).max(1000).default(20),
    /** Mapping function relating distance to recombination frequency. */
    mapFunction: z.enum(['morgan', 'haldane', 'kosambi']).default('haldane'),
    /** Highest map distance plotted (cM). */
    distanceMaxCm: z.number().min(1e-6).max(1000).default(100),
    /** Points in the plotted r-vs-distance curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type RecombinationMapParams = z.infer<typeof paramsSchema>;

/** Recombination frequency r for a map distance (cM) under the given mapping function. */
export function recombinationFrequency(
  distanceCm: number,
  fn: 'morgan' | 'haldane' | 'kosambi',
): number {
  const d = distanceCm / 100; // Morgans
  if (fn === 'morgan') return Math.min(0.5, d);
  if (fn === 'haldane') return 0.5 * (1 - Math.exp(-2 * d));
  return 0.5 * Math.tanh(2 * d); // kosambi
}

export function run(rawParams: Partial<RecombinationMapParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);

  const r = recombinationFrequency(p.mapDistanceCm, p.mapFunction);
  const naiveR = p.mapDistanceCm / 100; // Morgan/additive expectation
  const geneticDistanceMorgans = p.mapDistanceCm / 100;
  const linked = r < 0.5 - 1e-9; // r → ½ means effectively unlinked (independent assortment)
  const underReport = Math.max(0, naiveR - r); // how much r hides the true distance

  const metrics: Metric[] = [
    {
      key: 'recombinationFrequency',
      label: 'Recombination frequency r',
      value: r,
      note: `${p.mapFunction} mapping; ½ = unlinked`,
    },
    {
      key: 'mapDistanceCm',
      label: 'Map distance',
      value: p.mapDistanceCm,
      unit: 'cM',
      note: '1 cM ≈ 1% recombination for close genes',
    },
    {
      key: 'geneticDistanceMorgans',
      label: 'Genetic distance',
      value: geneticDistanceMorgans,
      unit: 'Morgans',
    },
    {
      key: 'naiveRecombination',
      label: 'Naive (additive) r',
      value: Math.min(0.5, naiveR),
      note: 'what r would be with no double crossovers',
    },
    {
      key: 'underReport',
      label: 'Distance hidden by crossovers',
      value: underReport,
      note: 'naive r − observed r',
    },
    { key: 'linked', label: 'Linked?', value: linked ? 1 : 0, note: '1 = linked, 0 = unlinked' },
  ];

  const n = p.outputPoints;
  const distances = Array.from({ length: n }, (_, i) => (p.distanceMaxCm * i) / (n - 1));
  const series: Series[] = [
    {
      x: distances,
      y: { recombination: distances.map((d) => recombinationFrequency(d, p.mapFunction)) },
      xLabel: 'map distance (cM)',
      yLabel: 'recombination frequency r',
    },
  ];

  return {
    engine: 'recombination-map',
    summary: `Recombination (${p.mapFunction}): ${p.mapDistanceCm} cM apart → r=${r.toFixed(4)} (${(100 * r).toFixed(1)}% recombinant); the naive ${(100 * Math.min(0.5, naiveR)).toFixed(1)}% over-reads by ${(100 * underReport).toFixed(1)} points as crossovers cancel. ${linked ? 'Still linked.' : 'Effectively unlinked.'}`,
    metrics,
    series,
    detail: { recombinationFrequency: r, mapDistanceCm: p.mapDistanceCm, underReport, linked },
    provenance: provenance('recombination-map', '1.0.0', p),
  };
}

export const spec: EngineSpec<RecombinationMapParams> = {
  slug: 'recombination-map',
  title: 'Genetic Recombination & Linkage Mapping',
  domain: 'population-genetics',
  version: '1.0.0',
  description:
    'How genetic distance turns into recombination frequency — the basis of every genetic map. Two genes recombine when a crossover falls between them, so the recombination frequency r measures distance (1% ≈ 1 centimorgan), but for distant genes double crossovers cancel and r saturates toward ½, under-reporting the true distance. Reports r under the Morgan (naive r=d), Haldane (r=½(1−e^(−2d))) and Kosambi (r=½·tanh(2d)) mapping functions, the naive-vs-corrected gap, whether the genes are still linked, and the r-versus-distance curve that flattens at ½. Closed-form and deterministic; r stays in [0, ½].',
  references: [
    'Sturtevant, A.H. (1913) The linear arrangement of six sex-linked factors in Drosophila. J. Exp. Zool. 14:43-59.',
    'Kosambi, D.D. (1943) The estimation of map distances from recombination values. Ann. Eugen. 12:172-175.',
  ],
  paramsSchema: paramsSchema as z.ZodType<RecombinationMapParams>,
  run,
  example: paramsSchema.parse({ mapDistanceCm: 20, mapFunction: 'haldane' }),
  tags: ['population-genetics', 'recombination', 'linkage', 'mapping', 'centimorgan', 'crossover'],
};

export default spec;
