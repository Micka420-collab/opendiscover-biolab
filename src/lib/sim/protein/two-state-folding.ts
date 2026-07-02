/**
 * Two-state protein folding thermodynamics — the stability curve.
 *
 * A small protein sits in equilibrium between a folded (F) and unfolded (U) state.
 * The free energy of unfolding follows the Gibbs–Helmholtz relation with a heat-
 * capacity change ΔCp (Becktel & Schellman 1987):
 *
 *     ΔG(T) = ΔHm·(1 − T/Tm) − ΔCp·[(Tm − T) + T·ln(T/Tm)]
 *
 * (temperatures in kelvin; ΔHm the van't Hoff enthalpy at the melting point Tm,
 * where ΔG = 0). The equilibrium constant is K = e^(−ΔG/RT) and the fraction folded
 * is f_F = 1/(1 + K). Because ΔCp > 0, ΔG is a downward-curving "stability curve":
 * the protein unfolds at HIGH temperature (the familiar melt) AND at LOW temperature
 * (cold denaturation), with a stability maximum in between at
 *
 *     T_maxstab = Tm·exp(−ΔHm / (Tm·ΔCp)).
 *
 * Deterministic and analytic — every quantity is closed-form. f_F = 1/(1+e^x) stays
 * in [0,1] for all inputs (a huge exponent just saturates it to 0 or 1, never NaN).
 *
 * References:
 *   - Becktel, W.J. & Schellman, J.A. (1987) Protein stability curves. Biopolymers
 *     26:1859-1877.
 *   - Privalov, P.L. (1990) Cold denaturation of proteins. Crit. Rev. Biochem. Mol.
 *     Biol. 25:281-305.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

/** Gas constant in kJ/(mol·K). */
const R = 0.0083145;
const KELVIN = 273.15;

export const paramsSchema = z
  .object({
    /** van't Hoff enthalpy of unfolding at Tm (kJ/mol). */
    deltaHm: z.number().positive().max(5000).default(250),
    /** Melting temperature Tm (°C), where ΔG = 0 and f_F = 0.5. */
    tmCelsius: z.number().min(-20).max(150).default(60),
    /** Heat-capacity change of unfolding ΔCp (kJ/mol/K) — positive for real proteins. */
    deltaCp: z.number().positive().max(100).default(8),
    /** Low end of the plotted temperature range (°C). */
    tMinCelsius: z.number().min(-50).max(150).default(-20),
    /** High end of the plotted temperature range (°C). */
    tMaxCelsius: z.number().min(-40).max(200).default(100),
    /** Points in the plotted curves. */
    outputPoints: z.number().int().min(2).max(4000).default(240),
  })
  .strict()
  .refine((p) => p.tMaxCelsius > p.tMinCelsius, {
    message: 'tMaxCelsius must be greater than tMinCelsius',
  });

export type TwoStateFoldingParams = z.infer<typeof paramsSchema>;

/** Free energy of unfolding ΔG(T) (kJ/mol); T, Tm in kelvin. */
export function deltaGUnfold(tK: number, deltaHm: number, tmK: number, deltaCp: number): number {
  // T·ln(T/Tm) → 0 as T → 0+; guard the 0·(−∞) = NaN case so the T→0 limit is the
  // finite ΔHm − ΔCp·Tm (reached when maxStabK underflows to exactly 0).
  const lnTerm = tK > 0 ? tK * Math.log(tK / tmK) : 0;
  return deltaHm * (1 - tK / tmK) - deltaCp * (tmK - tK + lnTerm);
}

/** Fraction folded f_F = 1/(1 + e^(−ΔG/RT)); stays in [0,1] for any ΔG. */
export function fractionFolded(deltaG: number, tK: number): number {
  return 1 / (1 + Math.exp(-deltaG / (R * tK)));
}

export function run(rawParams: Partial<TwoStateFoldingParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const tmK = p.tmCelsius + KELVIN;

  const dG = (tK: number) => deltaGUnfold(tK, p.deltaHm, tmK, p.deltaCp);

  const t25 = 25 + KELVIN;
  const deltaG25 = dG(t25);
  const fF25 = fractionFolded(deltaG25, t25);

  // Temperature of maximum stability (closed form) and the stability there.
  const maxStabK = tmK * Math.exp(-p.deltaHm / (tmK * p.deltaCp));
  const deltaGmax = dG(maxStabK);

  const metrics: Metric[] = [
    { key: 'meltingTemp', label: 'Melting temperature Tm', value: p.tmCelsius, unit: '°C' },
    { key: 'deltaG25', label: 'ΔG unfolding at 25°C', value: deltaG25, unit: 'kJ/mol' },
    {
      key: 'fractionFolded25',
      label: 'Fraction folded at 25°C',
      value: fF25,
      note: '1 = fully folded',
    },
    {
      key: 'maxStabilityTemp',
      label: 'Temperature of maximum stability',
      value: maxStabK - KELVIN,
      unit: '°C',
      note: 'Tm·exp(−ΔHm/(Tm·ΔCp))',
    },
    { key: 'deltaGmax', label: 'Maximum ΔG (peak stability)', value: deltaGmax, unit: 'kJ/mol' },
    { key: 'deltaHm', label: 'van’t Hoff enthalpy ΔHm', value: p.deltaHm, unit: 'kJ/mol' },
  ];

  const n = p.outputPoints;
  const temps = Array.from(
    { length: n },
    (_, i) => p.tMinCelsius + ((p.tMaxCelsius - p.tMinCelsius) * i) / (n - 1),
  );
  const gVals = temps.map((tC) => dG(tC + KELVIN));
  const fVals = temps.map((tC, i) => fractionFolded(gVals[i] as number, tC + KELVIN));

  const series: Series[] = [
    {
      x: temps,
      y: { fractionFolded: fVals, deltaG: gVals },
      xLabel: 'temperature (°C)',
      yLabel: 'fraction folded / ΔG (kJ/mol)',
    },
  ];

  return {
    engine: 'two-state-folding',
    summary: `Two-state folding: Tm=${p.tmCelsius}°C, ΔG(25°C)=${deltaG25.toFixed(1)} kJ/mol (${(100 * fF25).toFixed(1)}% folded), peak stability ${deltaGmax.toFixed(1)} kJ/mol at ${(maxStabK - KELVIN).toFixed(1)}°C.`,
    metrics,
    series,
    detail: {
      deltaG25,
      fractionFolded25: fF25,
      maxStabilityTemp: maxStabK - KELVIN,
      deltaGmax,
    },
    provenance: provenance('two-state-folding', '1.0.0', p),
  };
}

export const spec: EngineSpec<TwoStateFoldingParams> = {
  slug: 'two-state-folding',
  title: 'Two-State Protein Folding (thermal stability)',
  domain: 'protein',
  version: '1.0.0',
  description:
    'The thermodynamic two-state model of protein folding: ΔG(T) = ΔHm(1−T/Tm) − ΔCp[(Tm−T)+T·ln(T/Tm)] (Gibbs–Helmholtz), giving the fraction folded f_F = 1/(1+e^(−ΔG/RT)). Reports the melting temperature Tm, the free energy and fraction folded at 25°C, and — because ΔCp>0 — the stability maximum T_maxstab = Tm·exp(−ΔHm/(Tm·ΔCp)) with its peak ΔG. The ΔG(T) stability curve captures both heat and cold denaturation. Closed-form and deterministic; f_F never leaves [0,1].',
  references: [
    'Becktel, W.J. & Schellman, J.A. (1987) Protein stability curves. Biopolymers 26:1859-1877.',
    'Privalov, P.L. (1990) Cold denaturation of proteins. Crit. Rev. Biochem. Mol. Biol. 25:281-305.',
  ],
  paramsSchema: paramsSchema as z.ZodType<TwoStateFoldingParams>,
  run,
  example: paramsSchema.parse({ deltaHm: 250, tmCelsius: 60, deltaCp: 8 }),
  tags: ['protein', 'folding', 'thermodynamics', 'stability', 'denaturation'],
};

export default spec;
