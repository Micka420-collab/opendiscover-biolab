/**
 * Enzyme temperature optimum — why every enzyme has a "best" working temperature.
 *
 * Two opposing effects set an enzyme's activity as temperature rises. Chemistry speeds up
 * with heat (the Arrhenius factor), but the enzyme is a folded protein that comes apart
 * (denatures) once it gets too hot, and a denatured enzyme is dead. Multiplying the two
 * gives a bell-shaped activity curve,
 *
 *     activity(T) = e^(−Ea/RT) · fFolded(T),   fFolded(T) = 1 / (1 + e^(−ΔG(T)/RT)),
 *
 * with the two-state stability ΔG(T) = ΔHd·(1 − T/Tm). Activity climbs on the Arrhenius side,
 * peaks at the optimum temperature T_opt — which in the usual biological regime (unfolding
 * enthalpy ΔHd ≳ 2·Ea) sits below the melting temperature Tm, because unfolding starts eating
 * into activity before half the protein has melted — then collapses.
 * Reports T_opt, the melting temperature, the relative activity at a chosen temperature, and
 * the Q10 (how many times faster the underlying chemistry runs per 10 °C), plus the activity
 * curve normalised to its peak.
 *
 * Closed-form and deterministic; the logistic folded-fraction and bounded exponents keep every
 * output finite for all schema-valid inputs.
 *
 * References:
 *   - Arrhenius, S. (1889) Über die Reaktionsgeschwindigkeit… Z. Phys. Chem. 4:226-248.
 *   - Daniel, R.M. & Danson, M.J. (2010) A new understanding of how temperature affects the
 *     catalytic activity of enzymes. Trends Biochem. Sci. 35:584-591.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

const R = 8.314462618;
const K0 = 273.15;

export const paramsSchema = z
  .object({
    /** Activation energy Ea (kJ/mol) — how steeply chemistry speeds up with heat. */
    activationEnergy: z.number().min(1).max(400).default(50),
    /** Denaturation enthalpy ΔHd (kJ/mol) — how sharply the enzyme unfolds near Tm. */
    denaturationEnthalpy: z.number().min(10).max(3000).default(400),
    /** Melting temperature Tm (°C) — where half the enzyme is unfolded. */
    meltingTemp: z.number().min(0).max(120).default(55),
    /** Temperature (°C) at which to report the relative activity. */
    temperatureC: z.number().min(-20).max(150).default(37),
    /** Lowest temperature plotted (°C). */
    tMinC: z.number().min(-20).max(150).default(0),
    /** Highest temperature plotted (°C). */
    tMaxC: z.number().min(-20).max(150).default(90),
    /** Points in the plotted activity curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type EnzymeThermalParams = z.infer<typeof paramsSchema>;

/** Unnormalised activity (Arrhenius rate × folded fraction) at temperature tC. */
export function activity(tC: number, eaKJ: number, dHdKJ: number, tmC: number): number {
  const T = tC + K0; // K (> 0 by schema bound)
  const rate = Math.exp(-(eaKJ * 1000) / (R * T));
  const dG = dHdKJ * 1000 * (1 - T / (tmC + K0)); // J/mol; > 0 below Tm
  const fFolded = 1 / (1 + Math.exp(-dG / (R * T)));
  return rate * fFolded;
}

/** Arrhenius Q10: fold-increase in the underlying rate per 10 °C at tC. */
export function q10(tC: number, eaKJ: number): number {
  const T = tC + K0;
  return Math.exp(((eaKJ * 1000) / R) * (1 / T - 1 / (T + 10)));
}

export function run(rawParams: Partial<EnzymeThermalParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { activationEnergy: ea, denaturationEnthalpy: dHd, meltingTemp: tm } = p;

  const lo = Math.min(p.tMinC, p.tMaxC);
  const hi = Math.max(p.tMinC, p.tMaxC);
  // Optimum temperature: argmax of activity over a fine internal grid (independent of the
  // plot resolution), searched over the plot window WIDENED to include the reporting
  // temperature — so `peak` is a true upper bound and the relative activity never exceeds 1.
  const searchLo = Math.min(lo, p.temperatureC);
  const searchHi = Math.max(hi, p.temperatureC);
  const gridN = 721;
  let optT = searchLo;
  let optA = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < gridN; i++) {
    const t = searchLo + ((searchHi - searchLo) * i) / (gridN - 1);
    const a = activity(t, ea, dHd, tm);
    if (a > optA) {
      optA = a;
      optT = t;
    }
  }
  // Cover the reporting temperature exactly (the grid may straddle it), so relativeAtT ≤ 1.
  const aAtReport = activity(p.temperatureC, ea, dHd, tm);
  if (aAtReport > optA) {
    optA = aAtReport;
    optT = p.temperatureC;
  }
  const peak = optA > 0 ? optA : 1;
  const relativeAtT = aAtReport / peak;
  const margin = tm - optT; // Tm − T_opt; positive in the usual regime, can be ≤ 0 if ΔHd is low

  const metrics: Metric[] = [
    {
      key: 'optimalTemp',
      label: 'Optimal temperature T_opt',
      value: optT,
      unit: '°C',
      note: 'where activity peaks',
    },
    {
      key: 'meltingTemp',
      label: 'Melting temperature Tm',
      value: tm,
      unit: '°C',
      note: 'half the enzyme unfolded',
    },
    {
      key: 'relativeActivityAtT',
      label: `Relative activity at ${p.temperatureC}°C`,
      value: relativeAtT,
      note: 'fraction of peak activity',
    },
    {
      key: 'q10',
      label: 'Q10 (rate per +10°C)',
      value: q10(p.temperatureC, ea),
      note: 'Arrhenius speed-up; ~2-3 for most enzymes',
    },
    {
      key: 'thermalMargin',
      label: 'Tm − T_opt',
      value: margin,
      unit: '°C',
      note: 'positive when unfolding bites before Tm (ΔHd > 2·Ea)',
    },
  ];

  const n = p.outputPoints;
  const temps = Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
  const series: Series[] = [
    {
      x: temps,
      y: { activity: temps.map((t) => activity(t, ea, dHd, tm) / peak) },
      xLabel: 'temperature (°C)',
      yLabel: 'relative activity',
    },
  ];

  return {
    engine: 'enzyme-thermal',
    summary: `Enzyme activity peaks at T_opt=${optT.toFixed(1)}°C (Tm=${tm}°C, so ${Math.abs(margin).toFixed(1)}°C ${margin >= 0 ? 'below' : 'above'} melting); at ${p.temperatureC}°C it runs at ${(100 * relativeAtT).toFixed(0)}% of peak, with Q10≈${q10(p.temperatureC, ea).toFixed(2)}.`,
    metrics,
    series,
    detail: { optimalTemp: optT, meltingTemp: tm, relativeActivityAtT: relativeAtT },
    provenance: provenance('enzyme-thermal', '1.0.0', p),
  };
}

export const spec: EngineSpec<EnzymeThermalParams> = {
  slug: 'enzyme-thermal',
  title: 'Enzyme Temperature Optimum (Arrhenius × denaturation)',
  domain: 'biochemistry',
  version: '1.0.0',
  description:
    "An enzyme's bell-shaped activity-versus-temperature curve, from two opposing effects: chemistry speeds up with heat (Arrhenius, e^(−Ea/RT)) while the enzyme unfolds and dies once it gets too hot (two-state denaturation with folded fraction 1/(1+e^(−ΔG/RT)), ΔG=ΔHd(1−T/Tm)). Their product peaks at the optimal temperature T_opt, which in the usual regime (ΔHd ≳ 2·Ea) sits below the melting temperature Tm because unfolding erodes activity before half the protein has melted. Reports T_opt, Tm, the relative activity at a chosen temperature, the Q10 (fold rate increase per 10°C), and the margin Tm−T_opt, plus the peak-normalised activity curve. Closed-form and deterministic.",
  references: [
    'Arrhenius, S. (1889) Über die Reaktionsgeschwindigkeit bei der Inversion von Rohrzucker durch Säuren. Z. Phys. Chem. 4:226-248.',
    'Daniel, R.M. & Danson, M.J. (2010) A new understanding of how temperature affects enzyme activity. Trends Biochem. Sci. 35:584-591.',
  ],
  paramsSchema: paramsSchema as z.ZodType<EnzymeThermalParams>,
  run,
  example: paramsSchema.parse({ activationEnergy: 50, denaturationEnthalpy: 400, meltingTemp: 55 }),
  tags: ['biochemistry', 'enzyme', 'temperature', 'arrhenius', 'denaturation', 'q10'],
};

export default spec;
