/**
 * Oxygen–hemoglobin dissociation — the Hill model of cooperative O₂ binding.
 *
 * Hemoglobin binds oxygen cooperatively: the first O₂ that latches on makes the next
 * easier, so the saturation-versus-pressure curve is a sigmoid, not a hyperbola. The Hill
 * equation captures this with two numbers,
 *
 *     Y(p) = pⁿ / (P₅₀ⁿ + pⁿ),
 *
 * where Y is the fractional saturation, p the oxygen partial pressure, P₅₀ the pressure at
 * half-saturation (~26 mmHg for human blood) and n the Hill coefficient (~2.7 — the degree
 * of cooperativity; n=1 would be non-cooperative myoglobin-like binding). The sigmoid is
 * what lets hemoglobin load almost fully in the lungs (~100 mmHg) yet release a big chunk
 * of that oxygen in the tissues (~40 mmHg): the steep middle of the curve sits right
 * between those two pressures. A right shift (higher P₅₀ — the Bohr effect of exercising,
 * acidic, warm tissue) dumps even more O₂ where it is needed.
 *
 * Closed-form and deterministic; every schema field is bounded so no input can drive a
 * power or division non-finite, and the tissue-extraction ratio is guarded at zero
 * saturation.
 *
 * References:
 *   - Hill, A.V. (1910) The possible effects of the aggregation of the molecules of
 *     haemoglobin on its dissociation curves. J. Physiol. 40:iv-vii.
 *   - Berg, J.M., Tymoczko, J.L. & Stryer, L. (2015) Biochemistry, 8th ed. Freeman (ch. 7).
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Half-saturation pressure P₅₀ (mmHg); human blood ≈ 26. */
    p50: z.number().min(1e-3).max(1000).default(26),
    /** Hill coefficient n (cooperativity); hemoglobin ≈ 2.7, myoglobin = 1. */
    hillCoefficient: z.number().min(1e-3).max(8).default(2.7),
    /** Arterial (lung) oxygen partial pressure (mmHg). */
    arterialPO2: z.number().min(0).max(1000).default(100),
    /** Venous (tissue) oxygen partial pressure (mmHg). */
    venousPO2: z.number().min(0).max(1000).default(40),
    /** Highest pO₂ plotted (mmHg). */
    pO2Max: z.number().min(1e-3).max(1000).default(100),
    /** Points in the plotted dissociation curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type OxygenHemoglobinParams = z.infer<typeof paramsSchema>;

/** Fractional O₂ saturation Y(p) = pⁿ/(P₅₀ⁿ + pⁿ) from the Hill equation. */
export function oxygenSaturation(pO2: number, p50: number, n: number): number {
  if (pO2 <= 0) return 0;
  const num = pO2 ** n;
  if (!Number.isFinite(num)) return 1; // p ≫ P₅₀ ⇒ fully saturated
  const den = p50 ** n + num;
  return den > 0 ? num / den : 0;
}

export function run(rawParams: Partial<OxygenHemoglobinParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { p50, hillCoefficient: n } = p;

  const arterial = oxygenSaturation(p.arterialPO2, p50, n);
  const venous = oxygenSaturation(p.venousPO2, p50, n);
  const delivered = arterial - venous; // fraction of Hb capacity unloaded to tissues
  const extraction = arterial > 0 ? delivered / arterial : 0; // O₂ extraction ratio

  const metrics: Metric[] = [
    {
      key: 'arterialSaturation',
      label: 'Arterial saturation (SaO₂)',
      value: arterial,
      note: `Y at ${p.arterialPO2} mmHg (lungs)`,
    },
    {
      key: 'venousSaturation',
      label: 'Venous saturation (SvO₂)',
      value: venous,
      note: `Y at ${p.venousPO2} mmHg (tissues)`,
    },
    {
      key: 'oxygenDelivered',
      label: 'O₂ unloaded to tissues',
      value: delivered,
      note: 'SaO₂ − SvO₂: fraction of capacity released',
    },
    {
      key: 'extractionRatio',
      label: 'O₂ extraction ratio',
      value: extraction,
      note: '(SaO₂ − SvO₂)/SaO₂',
    },
    { key: 'p50', label: 'Half-saturation P₅₀', value: p50, unit: 'mmHg' },
    {
      key: 'hillCoefficient',
      label: 'Hill coefficient n',
      value: n,
      note: 'cooperativity (1 = none)',
    },
  ];

  const nPts = p.outputPoints;
  const pressures = Array.from({ length: nPts }, (_, i) => (p.pO2Max * i) / (nPts - 1));
  const series: Series[] = [
    {
      x: pressures,
      y: { saturation: pressures.map((pp) => oxygenSaturation(pp, p50, n)) },
      xLabel: 'oxygen partial pressure pO₂ (mmHg)',
      yLabel: 'O₂ saturation Y',
    },
  ];

  return {
    engine: 'oxygen-hemoglobin',
    summary: `O₂–hemoglobin (Hill n=${n}, P₅₀=${p50} mmHg): arterial ${(100 * arterial).toFixed(1)}% at ${p.arterialPO2} mmHg, venous ${(100 * venous).toFixed(1)}% at ${p.venousPO2} mmHg → ${(100 * delivered).toFixed(1)}% of capacity unloaded to tissues (extraction ${(100 * extraction).toFixed(0)}%).`,
    metrics,
    series,
    detail: { arterialSaturation: arterial, venousSaturation: venous, oxygenDelivered: delivered },
    provenance: provenance('oxygen-hemoglobin', '1.0.0', p),
  };
}

export const spec: EngineSpec<OxygenHemoglobinParams> = {
  slug: 'oxygen-hemoglobin',
  title: 'Oxygen–Hemoglobin Dissociation (Hill)',
  domain: 'biochemistry',
  version: '1.0.0',
  description:
    'The oxygen–hemoglobin dissociation curve from the Hill equation Y=pⁿ/(P₅₀ⁿ+pⁿ): cooperative O₂ binding gives a sigmoidal saturation curve set by the half-saturation pressure P₅₀ (~26 mmHg) and the Hill coefficient n (~2.7 for hemoglobin, 1 for non-cooperative myoglobin). The steep middle of the sigmoid between lung (~100 mmHg) and tissue (~40 mmHg) pressures is exactly what lets blood load O₂ in the lungs and release it to tissues; a right shift (higher P₅₀, the Bohr effect) unloads still more. Reports arterial and venous saturation, the fraction of capacity unloaded, the O₂ extraction ratio, and the full dissociation curve. Closed-form and deterministic.',
  references: [
    'Hill, A.V. (1910) The possible effects of the aggregation of the molecules of haemoglobin on its dissociation curves. J. Physiol. 40:iv-vii.',
    'Berg, J.M., Tymoczko, J.L. & Stryer, L. (2015) Biochemistry, 8th ed. W. H. Freeman.',
  ],
  paramsSchema: paramsSchema as z.ZodType<OxygenHemoglobinParams>,
  run,
  example: paramsSchema.parse({ p50: 26, hillCoefficient: 2.7, arterialPO2: 100, venousPO2: 40 }),
  tags: ['biochemistry', 'hemoglobin', 'oxygen', 'hill-equation', 'cooperativity', 'bohr-effect'],
};

export default spec;
