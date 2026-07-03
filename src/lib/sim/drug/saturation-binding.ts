/**
 * Saturation (receptor–ligand) binding — the equilibrium that underlies pharmacology.
 *
 * A ligand L binds a receptor R reversibly (R + L ⇌ RL) with dissociation constant Kd.
 * At equilibrium the specifically bound amount follows a rectangular hyperbola in the free
 * ligand concentration,
 *
 *     B = Bmax·[L] / (Kd + [L]),
 *
 * where Bmax is the total number of sites and Kd is the concentration giving half-maximal
 * binding (so smaller Kd = tighter binding). The fractional occupancy is θ = [L]/(Kd+[L]).
 * A real assay also has non-saturable non-specific binding, taken here as linear in [L]
 * (NS = ns·[L]); the total is B + NS. The classic Scatchard linearisation is
 * B/[L] = (Bmax − B)/Kd, whose slope is −1/Kd.
 *
 * Closed-form and deterministic; every schema field is bounded so the Kd+[L] denominator is
 * strictly positive and no output can be non-finite.
 *
 * References:
 *   - Scatchard, G. (1949) The attractions of proteins for small molecules and ions.
 *     Ann. N.Y. Acad. Sci. 51:660-672.
 *   - Hulme, E.C. & Trevethick, M.A. (2010) Ligand binding assays at equilibrium. Br. J.
 *     Pharmacol. 161:1219-1237.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Dissociation constant Kd (nM); smaller = tighter binding. */
    kd: z.number().min(1e-6).max(1e6).default(5),
    /** Total binding-site capacity Bmax (same units as bound). */
    bmax: z.number().min(1e-6).max(1e9).default(100),
    /** Free ligand concentration [L] (nM) at which to report. */
    ligand: z.number().min(0).max(1e9).default(10),
    /** Non-specific binding slope (bound per unit ligand); 0 = none. */
    nonspecific: z.number().min(0).max(1e3).default(0),
    /** Highest ligand concentration plotted (nM). */
    ligandMax: z.number().min(1e-6).max(1e9).default(50),
    /** Points in the plotted binding isotherm. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type SaturationBindingParams = z.infer<typeof paramsSchema>;

/** Specifically bound ligand B = Bmax·[L]/(Kd+[L]). */
export function specificBound(bmax: number, kd: number, ligand: number): number {
  return (bmax * ligand) / (kd + ligand);
}

/** Fractional occupancy θ = [L]/(Kd+[L]) in [0,1). */
export function occupancy(kd: number, ligand: number): number {
  return ligand / (kd + ligand);
}

export function run(rawParams: Partial<SaturationBindingParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);

  const bound = specificBound(p.bmax, p.kd, p.ligand);
  const theta = occupancy(p.kd, p.ligand);
  const nonspecificBound = p.nonspecific * p.ligand;
  const totalBound = bound + nonspecificBound;

  const metrics: Metric[] = [
    {
      key: 'boundSpecific',
      label: 'Specifically bound',
      value: bound,
      note: 'B = Bmax·[L]/(Kd+[L])',
    },
    {
      key: 'occupancy',
      label: 'Fractional occupancy',
      value: theta,
      note: '[L]/(Kd+[L]) — share of sites filled',
    },
    {
      key: 'kd',
      label: 'Dissociation constant Kd',
      value: p.kd,
      unit: 'nM',
      note: 'concentration for half-occupancy; smaller = tighter',
    },
    {
      key: 'ligandForHalf',
      label: 'Ligand for 50% occupancy',
      value: p.kd,
      unit: 'nM',
      note: 'equals Kd',
    },
    {
      key: 'nonspecificBound',
      label: 'Non-specific bound',
      value: nonspecificBound,
      note: 'ns·[L] (non-saturable)',
    },
    { key: 'totalBound', label: 'Total bound', value: totalBound, note: 'specific + non-specific' },
  ];

  const n = p.outputPoints;
  const ligands = Array.from({ length: n }, (_, i) => (p.ligandMax * i) / (n - 1));
  const series: Series[] = [
    {
      x: ligands,
      y: {
        specific: ligands.map((l) => specificBound(p.bmax, p.kd, l)),
        total: ligands.map((l) => specificBound(p.bmax, p.kd, l) + p.nonspecific * l),
      },
      xLabel: 'free ligand [L] (nM)',
      yLabel: 'bound',
    },
  ];

  return {
    engine: 'saturation-binding',
    summary: `Saturation binding: Kd=${p.kd} nM, Bmax=${p.bmax} → at [L]=${p.ligand} nM, ${(100 * theta).toFixed(1)}% of sites filled (B=${bound.toFixed(2)}); half-occupancy at [L]=Kd=${p.kd} nM.`,
    metrics,
    series,
    detail: { boundSpecific: bound, occupancy: theta, kd: p.kd, totalBound },
    provenance: provenance('saturation-binding', '1.0.0', p),
  };
}

export const spec: EngineSpec<SaturationBindingParams> = {
  slug: 'saturation-binding',
  title: 'Saturation (Receptor–Ligand) Binding',
  domain: 'drug-discovery',
  version: '1.0.0',
  description:
    'The equilibrium binding of a ligand to a receptor, the measurement at the heart of pharmacology: specific binding follows the rectangular hyperbola B=Bmax·[L]/(Kd+[L]), where Bmax is the site capacity and the dissociation constant Kd is the concentration for half-maximal binding (smaller Kd = tighter). Reports the specifically bound amount and fractional occupancy [L]/(Kd+[L]) at a chosen concentration, the ligand needed for 50% occupancy (=Kd), the linear non-specific binding, and the total, plus the specific/total binding isotherms. The classic Scatchard linearisation B/[L]=(Bmax−B)/Kd has slope −1/Kd. Closed-form and deterministic.',
  references: [
    'Scatchard, G. (1949) The attractions of proteins for small molecules and ions. Ann. N.Y. Acad. Sci. 51:660-672.',
    'Hulme, E.C. & Trevethick, M.A. (2010) Ligand binding assays at equilibrium. Br. J. Pharmacol. 161:1219-1237.',
  ],
  paramsSchema: paramsSchema as z.ZodType<SaturationBindingParams>,
  run,
  example: paramsSchema.parse({ kd: 5, bmax: 100, ligand: 10 }),
  tags: ['drug-discovery', 'pharmacology', 'binding', 'receptor', 'kd', 'scatchard'],
};

export default spec;
