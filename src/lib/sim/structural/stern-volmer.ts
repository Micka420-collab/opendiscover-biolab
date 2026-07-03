/**
 * Stern–Volmer fluorescence quenching — how a quencher dims a fluorophore's glow.
 *
 * A fluorescent molecule loses brightness when a "quencher" molecule collides with its
 * excited state and drains the energy before it can emit light. In dynamic (collisional)
 * quenching the loss of brightness is linear in the quencher concentration [Q]:
 *
 *     F₀ / F = 1 + K_SV·[Q],
 *
 * where F₀ is the unquenched fluorescence, F the quenched fluorescence, and the
 * Stern–Volmer constant K_SV = k_q·τ₀ combines how often collisions happen with how long
 * the excited state lives. The fraction of glow remaining is F/F₀ = 1/(1+K_SV·[Q]) and the
 * quenching efficiency is K_SV·[Q]/(1+K_SV·[Q]). Plotting F₀/F against [Q] gives the famous
 * straight line whose slope is K_SV — a workhorse for measuring how accessible a
 * fluorophore (say a tryptophan buried in a protein) is to the outside world.
 *
 * Closed-form and deterministic; every field is bounded so 1+K_SV·[Q] ≥ 1 and no output can
 * be non-finite.
 *
 * References:
 *   - Stern, O. & Volmer, M. (1919) Über die Abklingzeit der Fluoreszenz. Phys. Z. 20:183-188.
 *   - Lakowicz, J.R. (2006) Principles of Fluorescence Spectroscopy, 3rd ed. Springer (ch. 8).
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Stern–Volmer constant K_SV (1/mM); slope of the F₀/F line. */
    ksv: z.number().min(1e-6).max(1e6).default(10),
    /** Quencher concentration [Q] (mM) at which to report. */
    quencher: z.number().min(0).max(1e6).default(0.1),
    /** Unquenched fluorescence F₀ (arbitrary units). */
    f0: z.number().min(1e-6).max(1e9).default(100),
    /** Highest quencher concentration plotted (mM). */
    quencherMax: z.number().min(1e-6).max(1e6).default(0.5),
    /** Points in the plotted curves. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type SternVolmerParams = z.infer<typeof paramsSchema>;

/** Stern–Volmer ratio F₀/F = 1 + K_SV·[Q]. */
export function sternVolmerRatio(ksv: number, quencher: number): number {
  return 1 + ksv * quencher;
}

export function run(rawParams: Partial<SternVolmerParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);

  const ratio = sternVolmerRatio(p.ksv, p.quencher);
  const fluorescence = p.f0 / ratio;
  const fractionRemaining = 1 / ratio;
  const efficiency = 1 - fractionRemaining;
  const quencherForHalf = 1 / p.ksv; // [Q] where half the glow is quenched (F₀/F = 2)

  const metrics: Metric[] = [
    {
      key: 'fluorescence',
      label: 'Quenched fluorescence F',
      value: fluorescence,
      note: 'F = F₀/(1+K_SV·[Q])',
    },
    {
      key: 'fractionRemaining',
      label: 'Fraction of glow remaining',
      value: fractionRemaining,
      note: 'F/F₀ = 1/(1+K_SV·[Q])',
    },
    {
      key: 'quenchingEfficiency',
      label: 'Quenching efficiency',
      value: efficiency,
      note: 'share of brightness lost',
    },
    {
      key: 'sternVolmerRatio',
      label: 'Stern–Volmer ratio F₀/F',
      value: ratio,
      note: '1 + K_SV·[Q]',
    },
    { key: 'ksv', label: 'Stern–Volmer constant K_SV', value: p.ksv, unit: '1/mM' },
    {
      key: 'quencherForHalf',
      label: 'Quencher for 50% quenching',
      value: quencherForHalf,
      unit: 'mM',
      note: '1/K_SV',
    },
  ];

  const n = p.outputPoints;
  const quenchers = Array.from({ length: n }, (_, i) => (p.quencherMax * i) / (n - 1));
  const series: Series[] = [
    {
      x: quenchers,
      y: {
        ratio: quenchers.map((q) => sternVolmerRatio(p.ksv, q)),
        fluorescence: quenchers.map((q) => p.f0 / sternVolmerRatio(p.ksv, q)),
      },
      xLabel: 'quencher [Q] (mM)',
      yLabel: 'F₀/F  and  F',
    },
  ];

  return {
    engine: 'stern-volmer',
    summary: `Stern–Volmer: K_SV=${p.ksv}/mM → at [Q]=${p.quencher} mM the glow drops to ${(100 * fractionRemaining).toFixed(1)}% (F₀/F=${ratio.toFixed(2)}, ${(100 * efficiency).toFixed(0)}% quenched); half-quenched at [Q]=1/K_SV=${quencherForHalf.toPrecision(3)} mM.`,
    metrics,
    series,
    detail: { fluorescence, fractionRemaining, efficiency, sternVolmerRatio: ratio },
    provenance: provenance('stern-volmer', '1.0.0', p),
  };
}

export const spec: EngineSpec<SternVolmerParams> = {
  slug: 'stern-volmer',
  title: 'Stern–Volmer Fluorescence Quenching',
  domain: 'structural',
  version: '1.0.0',
  description:
    "Dynamic (collisional) fluorescence quenching by the Stern–Volmer law F₀/F=1+K_SV·[Q]: a quencher colliding with an excited fluorophore drains its energy, so brightness falls linearly with quencher concentration. The Stern–Volmer constant K_SV=k_q·τ₀ (collision rate × excited-state lifetime) is the slope of the F₀/F-vs-[Q] straight line. Reports the quenched fluorescence F, the fraction of glow remaining F/F₀=1/(1+K_SV·[Q]), the quenching efficiency, the Stern–Volmer ratio, and the quencher needed for 50% quenching (1/K_SV), plus the Stern–Volmer and fluorescence curves. The standard readout for how accessible a fluorophore — like a protein's tryptophan — is to the solvent. Closed-form and deterministic.",
  references: [
    'Stern, O. & Volmer, M. (1919) Über die Abklingzeit der Fluoreszenz. Phys. Z. 20:183-188.',
    'Lakowicz, J.R. (2006) Principles of Fluorescence Spectroscopy, 3rd ed. Springer.',
  ],
  paramsSchema: paramsSchema as z.ZodType<SternVolmerParams>,
  run,
  example: paramsSchema.parse({ ksv: 10, quencher: 0.1, f0: 100 }),
  tags: ['structural', 'fluorescence', 'quenching', 'stern-volmer', 'spectroscopy'],
};

export default spec;
