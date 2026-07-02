/**
 * One-compartment oral pharmacokinetics — first-order absorption (Bateman function).
 *
 * A drug swallowed (not injected) is absorbed from the gut into the blood at rate ka
 * while it is cleared at rate ke = CL/V. The plasma concentration is the Bateman
 * function — it starts at zero, rises to a peak, then falls:
 *
 *     C(t) = (F·Dose·ka) / (V·(ka − ke)) · (e^(−ke·t) − e^(−ka·t)),
 *
 * with F the bioavailability (fraction absorbed). The peak is at
 * Tmax = ln(ka/ke)/(ka − ke), and the total exposure AUC(0→∞) = F·Dose/CL is
 * independent of the absorption details. When ka = ke the formula is 0/0; the exact
 * removable-singularity limit is C(t) = (F·Dose·ka/V)·t·e^(−ka·t) with Tmax = 1/ka —
 * handled here so the model is well-posed for every input. The terminal decline is
 * governed by the SLOWER of ka and ke (flip-flop kinetics when ka < ke).
 *
 * Deterministic and closed-form. Distinct from the IV-bolus two-compartment engine.
 *
 * References:
 *   - Gibaldi, M. & Perrier, D. (1982) Pharmacokinetics, 2nd ed. Marcel Dekker.
 *   - Rowland, M. & Tozer, T.N. (2011) Clinical Pharmacokinetics and Pharmacodynamics.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Oral dose (mg). */
    dose: z.number().positive().max(1e6).default(100),
    /** Bioavailability F — fraction of the dose that reaches the blood. */
    bioavailability: z.number().min(0.01).max(1).default(1),
    /** First-order absorption rate constant ka (1/h). */
    ka: z.number().min(1e-6).max(1e4).default(1),
    /** Clearance CL (L/h). Elimination rate ke = CL/V. */
    cl: z.number().min(1e-6).max(1e5).default(5),
    /** Volume of distribution V (L). Lower-bounded so ke = CL/V stays finite. */
    v: z.number().min(1e-6).max(1e5).default(20),
    /** Simulated duration (h). */
    tEnd: z.number().positive().max(1e5).default(24),
    /** Points in the plotted concentration curve (>= 2). */
    outputPoints: z.number().int().min(2).max(4000).default(300),
  })
  .strict();

export type PkOralParams = z.infer<typeof paramsSchema>;

/** Are two rate constants equal to within a relative tolerance (the 0/0 case)? */
export function ratesEqual(ka: number, ke: number): boolean {
  return Math.abs(ka - ke) < 1e-9 * Math.max(ka, ke, 1);
}

/**
 * Plasma concentration at time t (Bateman function), using the exact ka=ke limit
 * when the rates coincide so the result is always finite.
 */
export function oralConc(t: number, fDose: number, v: number, ka: number, ke: number): number {
  if (ratesEqual(ka, ke)) {
    return ((fDose * ka) / v) * t * Math.exp(-ka * t);
  }
  return ((fDose * ka) / (v * (ka - ke))) * (Math.exp(-ke * t) - Math.exp(-ka * t));
}

/** Time of the peak concentration Tmax, with the ka=ke limit (1/ka). */
export function timeToMax(ka: number, ke: number): number {
  return ratesEqual(ka, ke) ? 1 / ka : Math.log(ka / ke) / (ka - ke);
}

export function run(rawParams: Partial<PkOralParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const ke = p.cl / p.v;
  const fDose = p.bioavailability * p.dose;

  const conc = (t: number) => oralConc(t, fDose, p.v, p.ka, ke);
  const tmax = timeToMax(p.ka, ke);
  const cmax = conc(tmax);
  const auc = fDose / p.cl; // F·Dose/CL, exact
  // Terminal decline follows the slower rate constant (flip-flop when ka < ke).
  const terminalRate = Math.min(p.ka, ke);
  const terminalHalfLife = Math.LN2 / terminalRate;

  const metrics: Metric[] = [
    { key: 'cmax', label: 'Peak plasma conc Cmax', value: cmax, unit: 'mg/L' },
    {
      key: 'tmax',
      label: 'Time to peak Tmax',
      value: tmax,
      unit: 'h',
      note: ratesEqual(p.ka, ke) ? '1/ka (ka=ke limit)' : 'ln(ka/ke)/(ka−ke)',
    },
    { key: 'auc', label: 'AUC(0→∞)', value: auc, unit: 'mg·h/L', note: 'F·Dose/CL' },
    { key: 'ka', label: 'Absorption rate ka', value: p.ka, unit: '1/h' },
    { key: 'ke', label: 'Elimination rate ke', value: ke, unit: '1/h', note: 'CL/V' },
    {
      key: 'terminalHalfLife',
      label: 'Terminal half-life',
      value: terminalHalfLife,
      unit: 'h',
      note: p.ka < ke ? 'ln2/ka (flip-flop: absorption-limited)' : 'ln2/ke',
    },
    { key: 'bioavailability', label: 'Bioavailability F', value: p.bioavailability },
  ];

  const n = p.outputPoints;
  const times = Array.from({ length: n }, (_, i) => (p.tEnd * i) / (n - 1));
  const series: Series[] = [
    {
      x: times,
      y: { plasma: times.map(conc) },
      xLabel: 'time (h)',
      yLabel: 'plasma concentration (mg/L)',
    },
  ];

  return {
    engine: 'pk-oral-absorption',
    summary: `Oral one-compartment PK: Cmax=${cmax.toFixed(2)} mg/L at Tmax=${tmax.toFixed(2)} h, terminal t½=${terminalHalfLife.toFixed(2)} h; AUC=${auc.toFixed(1)} mg·h/L.`,
    metrics,
    series,
    detail: { cmax, tmax, auc, ke, terminalHalfLife, flipFlop: p.ka < ke },
    provenance: provenance('pk-oral-absorption', '1.0.0', p),
  };
}

export const spec: EngineSpec<PkOralParams> = {
  slug: 'pk-oral-absorption',
  title: 'Oral One-Compartment PK (first-order absorption)',
  domain: 'drug-discovery',
  version: '1.0.0',
  description:
    'One-compartment oral pharmacokinetics with first-order absorption: the Bateman plasma curve C(t)=(F·Dose·ka)/(V(ka−ke))(e^(−ke t)−e^(−ka t)), rising from zero to a peak then declining. Reports Cmax and Tmax=ln(ka/ke)/(ka−ke), AUC(0→∞)=F·Dose/CL, the absorption/elimination rate constants, and the terminal half-life (governed by the slower rate — flip-flop kinetics when ka<ke). The ka=ke removable singularity is handled with its exact limit C=(F·Dose·ka/V)·t·e^(−ka t). Closed-form and deterministic; distinct from the IV-bolus two-compartment model.',
  references: [
    'Gibaldi, M. & Perrier, D. (1982) Pharmacokinetics, 2nd ed. Marcel Dekker.',
    'Rowland, M. & Tozer, T.N. (2011) Clinical Pharmacokinetics and Pharmacodynamics, 4th ed. Lippincott Williams & Wilkins.',
  ],
  paramsSchema: paramsSchema as z.ZodType<PkOralParams>,
  run,
  example: paramsSchema.parse({ dose: 100, bioavailability: 1, ka: 1, cl: 5, v: 20, tEnd: 24 }),
  tags: ['drug-discovery', 'pharmacokinetics', 'oral', 'absorption', 'bateman'],
};

export default spec;
