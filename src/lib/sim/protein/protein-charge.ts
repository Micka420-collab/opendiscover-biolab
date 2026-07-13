/**
 * Protein charge & isoelectric point — how a protein's net electric charge changes with the pH
 * around it, and the special pH (its isoelectric point, pI) where the charge is exactly zero.
 *
 * A protein carries charged chemical groups: acidic side chains (aspartate, glutamate, the
 * cysteine thiol and the tyrosine phenol) and the C-terminus give up a proton and go negative as
 * pH rises, while basic side chains (histidine, lysine, arginine) and the N-terminus hold a proton
 * and stay positive until pH climbs past their pKa. Each group's charge follows
 * Henderson–Hasselbalch; summing them gives the net charge as a function of pH:
 *
 *     Z(pH) = Σ_basic  n/(1 + 10^(pH − pKa))  −  Σ_acidic  n/(1 + 10^(pKa − pH)).
 *
 * Z falls smoothly as pH rises and crosses zero at the isoelectric point pI. At its pI a protein
 * carries no net charge, so it stops moving in an electric field and is at its least soluble —
 * the basis of isoelectric focusing, ion-exchange chromatography, and why proteins precipitate
 * (curdling milk, cheese-making) when the pH hits their pI.
 *
 * This engine reports the net charge at a chosen pH, the isoelectric point (found by
 * deterministic bisection), and the charge at physiological pH 7, plus the charge-vs-pH
 * titration curve. Closed-form Henderson–Hasselbalch per group; every term is finite (the
 * exponent is bounded and each denominator is ≥ 1), and the pI bracket [−10, 25] always contains
 * the (monotone) zero crossing because the fixed termini guarantee one acid and one base.
 *
 * References:
 *   - Henderson, L.J. (1908); Hasselbalch, K.A. (1917).
 *   - Kozlowski, L.P. (2016) IPC — isoelectric point calculator. Biol. Direct 11:55.
 *   - Nelson & Cox, Lehninger Principles of Biochemistry — side-chain pKa table.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

/** Basic groups carry +1 when protonated (below their pKa). Termini counts are fixed at 1. */
const POS_GROUPS = [
  { key: 'nterm', pKa: 8.0, fixed: 1 },
  { key: 'his', pKa: 6.5 },
  { key: 'lys', pKa: 10.5 },
  { key: 'arg', pKa: 12.5 },
] as const;

/**
 * Acidic groups carry −1 when deprotonated (above their pKa). Includes the two
 * side chains that ionize only at high pH — the cysteine thiol (~8.3) and the
 * tyrosine phenol (~10.1) — which any complete pI/titration model needs (they are
 * present in the cited IPC calculator); omitting them overestimates the pI of
 * cysteine/tyrosine-rich proteins. pKa values are representative textbook figures.
 */
const NEG_GROUPS = [
  { key: 'cterm', pKa: 3.55, fixed: 1 },
  { key: 'asp', pKa: 3.9 },
  { key: 'glu', pKa: 4.07 },
  { key: 'cys', pKa: 8.3 },
  { key: 'tyr', pKa: 10.1 },
] as const;

export const paramsSchema = z
  .object({
    /** Aspartate residues (acidic). */
    asp: z.number().int().min(0).max(100000).default(5),
    /** Glutamate residues (acidic). */
    glu: z.number().int().min(0).max(100000).default(5),
    /** Cysteine residues (weakly acidic thiol, pKa ≈ 8.3). */
    cys: z.number().int().min(0).max(100000).default(1),
    /** Tyrosine residues (weakly acidic phenol, pKa ≈ 10.1). */
    tyr: z.number().int().min(0).max(100000).default(3),
    /** Histidine residues (weakly basic). */
    his: z.number().int().min(0).max(100000).default(2),
    /** Lysine residues (basic). */
    lys: z.number().int().min(0).max(100000).default(4),
    /** Arginine residues (strongly basic). */
    arg: z.number().int().min(0).max(100000).default(3),
    /** The pH to report the net charge at. */
    reportPH: z.number().min(0).max(14).default(7),
    /** Points in the plotted titration curve (pH 0–14). */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type ProteinChargeParams = z.infer<typeof paramsSchema>;
type Counts = Pick<ProteinChargeParams, 'asp' | 'glu' | 'cys' | 'tyr' | 'his' | 'lys' | 'arg'>;

/** Net charge Z(pH) = Σ basic protonated − Σ acidic deprotonated (Henderson–Hasselbalch). */
export function netCharge(pH: number, c: Counts): number {
  let z = 0;
  for (const g of POS_GROUPS) {
    const n = 'fixed' in g ? g.fixed : (c[g.key as keyof Counts] ?? 0);
    z += n / (1 + 10 ** (pH - g.pKa));
  }
  for (const g of NEG_GROUPS) {
    const n = 'fixed' in g ? g.fixed : (c[g.key as keyof Counts] ?? 0);
    z -= n / (1 + 10 ** (g.pKa - pH));
  }
  return z;
}

/**
 * Isoelectric point — the pH where net charge is zero — by bisection. Z is monotone decreasing,
 * and the fixed N-/C-termini guarantee a sign change inside [−10, 25], so a root always exists.
 */
export function isoelectricPoint(c: Counts): number {
  let lo = -10;
  let hi = 25;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (netCharge(mid, c) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function run(rawParams: Partial<ProteinChargeParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const counts: Counts = {
    asp: p.asp,
    glu: p.glu,
    cys: p.cys,
    tyr: p.tyr,
    his: p.his,
    lys: p.lys,
    arg: p.arg,
  };

  const chargeAtPH = netCharge(p.reportPH, counts);
  const pI = isoelectricPoint(counts);
  const chargeAt7 = netCharge(7, counts);
  const acidicGroups = p.asp + p.glu + p.cys + p.tyr + 1; // + C-terminus
  const basicGroups = p.his + p.lys + p.arg + 1; // + N-terminus

  const metrics: Metric[] = [
    {
      key: 'netChargeAtPH',
      label: `Net charge at pH ${p.reportPH}`,
      value: chargeAtPH,
      note: 'Σ basic(+) − Σ acidic(−); zero at the isoelectric point',
    },
    {
      key: 'isoelectricPoint',
      label: 'Isoelectric point (pI)',
      value: pI,
      note: 'the pH of zero net charge — least soluble, does not migrate in a field',
    },
    {
      key: 'chargeAtPH7',
      label: 'Net charge at pH 7',
      value: chargeAt7,
      note: 'charge at physiological pH; sign tells acidic (−) vs basic (+) protein',
    },
    {
      key: 'acidicGroups',
      label: 'Acidic groups',
      value: acidicGroups,
      note: 'Asp + Glu + Cys + Tyr + C-terminus',
    },
    {
      key: 'basicGroups',
      label: 'Basic groups',
      value: basicGroups,
      note: 'His + Lys + Arg + N-terminus',
    },
  ];

  const n = p.outputPoints;
  const phs = Array.from({ length: n }, (_, i) => (14 * i) / (n - 1));
  const charge = phs.map((pH) => netCharge(pH, counts));
  const series: Series[] = [
    {
      x: phs,
      y: { charge },
      xLabel: 'pH',
      yLabel: 'net charge',
    },
  ];

  return {
    engine: 'protein-charge',
    summary: `Net charge ${chargeAtPH.toPrecision(3)} at pH ${p.reportPH}; the protein is neutral at its isoelectric point pI ${pI.toPrecision(3)} (${pI < 7 ? 'acidic' : 'basic'} protein). At physiological pH 7 it carries ${chargeAt7.toPrecision(3)}.`,
    metrics,
    series,
    detail: {
      netChargeAtPH: chargeAtPH,
      isoelectricPoint: pI,
      chargeAtPH7: chargeAt7,
      acidicGroups,
      basicGroups,
    },
    provenance: provenance('protein-charge', '1.0.0', p),
  };
}

export const spec: EngineSpec<ProteinChargeParams> = {
  slug: 'protein-charge',
  title: 'Protein Charge & Isoelectric Point',
  domain: 'protein',
  version: '1.0.0',
  description:
    "How a protein's net electric charge varies with pH, and the isoelectric point (pI) where it is exactly zero. Each ionizable group — acidic Asp/Glu, the cysteine thiol and the tyrosine phenol, and the C-terminus; basic His/Lys/Arg and the N-terminus — contributes a Henderson–Hasselbalch charge, and their sum Z(pH)=Σ_basic n/(1+10^(pH−pKa)) − Σ_acidic n/(1+10^(pKa−pH)) falls smoothly with pH, crossing zero at the pI. At its pI a protein carries no net charge, so it stops moving in an electric field and is least soluble — the basis of isoelectric focusing, ion-exchange chromatography, and protein precipitation. Reports the net charge at a chosen pH, the pI (by deterministic bisection), the charge at pH 7, and the charge-vs-pH titration curve. Closed-form and deterministic; every term is finite. pKa values are representative textbook figures, so absolute pI matches a reference calculator to a few tenths of a pH unit — trends and comparisons are exact.",
  references: [
    'Kozlowski, L.P. (2016) IPC — isoelectric point calculator. Biol. Direct 11:55.',
    'Nelson & Cox, Lehninger Principles of Biochemistry — side-chain pKa table (Cys ≈ 8.3, Tyr ≈ 10.1).',
  ],
  paramsSchema: paramsSchema as z.ZodType<ProteinChargeParams>,
  run,
  example: paramsSchema.parse({
    asp: 5,
    glu: 5,
    cys: 2,
    tyr: 4,
    his: 2,
    lys: 4,
    arg: 3,
    reportPH: 7,
  }),
  tags: ['protein', 'charge', 'isoelectric-point', 'pI', 'titration', 'henderson-hasselbalch'],
};

export default spec;
