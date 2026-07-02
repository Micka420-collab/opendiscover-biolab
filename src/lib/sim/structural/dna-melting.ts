/**
 * DNA duplex melting — two-state hybridization thermodynamics.
 *
 * Two complementary strands associate into a duplex, S1 + S2 ⇌ D, with van't Hoff
 * thermodynamics ΔG°(T) = ΔH° − T·ΔS° and equilibrium constant K = e^(−ΔG°/RT).
 * Heating shifts the balance toward the single strands: the fraction of strands in
 * duplex θ falls sigmoidally through the melting temperature Tm, where θ = ½.
 *
 * For a non-self-complementary duplex at equal total strand concentration C_T, the
 * bound fraction solves θ/(1−θ)² = β with β = K·C_T/2, giving the cancellation-free
 *
 *     θ = 2β / ((2β + 1) + √(4β + 1)),
 *
 * and the classic concentration-dependent melting point
 *
 *     Tm = ΔH° / (ΔS° + R·ln(C_T / x)),   x = 4 (non-self) or 1 (self-complementary).
 *
 * Unlike a nearest-neighbour Tm point estimate, this is the full melting CURVE plus
 * the hallmark of a bimolecular reaction: Tm rises with strand concentration.
 *
 * Deterministic and closed-form; θ stays in [0,1] and never divides by zero.
 *
 * References:
 *   - Marky, L.A. & Breslauer, K.J. (1987) Calculating thermodynamic data for
 *     transitions of any molecularity from equilibrium melting curves. Biopolymers
 *     26:1601-1620.
 *   - SantaLucia, J. (1998) A unified view of oligonucleotide nearest-neighbor
 *     thermodynamics. PNAS 95:1460-1465.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

/** Gas constant in kJ/(mol·K). */
const R = 0.0083145;
const KELVIN = 273.15;

export const paramsSchema = z
  .object({
    /** Association enthalpy ΔH° (kJ/mol) — negative for duplex formation. */
    deltaH: z.number().min(-5000).max(-1).default(-380),
    /** Association entropy ΔS° (kJ/mol/K) — negative (two strands become one). */
    deltaS: z.number().min(-100).max(-0.001).default(-1),
    /** Total strand concentration C_T (mol/L). */
    strandConc: z.number().min(1e-12).max(1).default(1e-5),
    /** Self-complementary strand (x=1) vs two distinct strands (x=4). */
    selfComplementary: z.boolean().default(false),
    /** Low end of the plotted temperature range (°C). */
    tMinCelsius: z.number().min(-20).max(150).default(20),
    /** High end of the plotted temperature range (°C). */
    tMaxCelsius: z.number().min(-10).max(200).default(95),
    /** Points in the plotted melting curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict()
  .refine((p) => p.tMaxCelsius > p.tMinCelsius, {
    message: 'tMaxCelsius must be greater than tMinCelsius',
  });

export type DnaMeltingParams = z.infer<typeof paramsSchema>;

/** Fraction of strands in duplex θ at temperature tK (kelvin). Stays in [0,1]. */
export function fractionDuplex(
  tK: number,
  deltaH: number,
  deltaS: number,
  cT: number,
  selfComplementary: boolean,
): number {
  const dG = deltaH - tK * deltaS; // kJ/mol
  const k = Math.exp(-dG / (R * tK)); // association constant
  const beta = selfComplementary ? 2 * k * cT : (k * cT) / 2;
  if (!Number.isFinite(beta)) return 1; // K overflowed → fully associated
  // θ = 2β / ((2β+1) + √(4β+1)) — the cancellation-free root of θ/(1−θ)² = β.
  return (2 * beta) / (2 * beta + 1 + Math.sqrt(4 * beta + 1));
}

/**
 * Temperature (K) at which θ = target, by bisection (θ is monotone decreasing in T).
 * Starts from the physical window [150,500] K but EXPANDS it — colder until θ(lo) ≥ target,
 * hotter until θ(hi) ≤ target — so the crossing is always bracketed regardless of where Tm
 * lies. Returns NaN when the crossing does not exist (θ never reaches `target` at any
 * physical temperature, i.e. the transition never completes), instead of a boundary-pinned
 * value. The in-range default case leaves [150,500] untouched, so those results are unchanged.
 */
function tempAtTheta(target: number, p: DnaMeltingParams): number {
  const theta = (tK: number) =>
    fractionDuplex(tK, p.deltaH, p.deltaS, p.strandConc, p.selfComplementary);
  let lo = 150;
  let hi = 500;
  // Expand the cold end down until θ(lo) ≥ target (θ → 1 as T → 0).
  for (let i = 0; i < 200 && theta(lo) < target && lo > 1e-9; i++) lo *= 0.5;
  // Expand the hot end up until θ(hi) ≤ target (θ → its high-T limit as T → ∞).
  for (let i = 0; i < 200 && theta(hi) > target && hi < 1e15; i++) hi *= 2;
  // If the interval still does not straddle `target`, the crossing does not exist.
  if (theta(lo) < target || theta(hi) > target) return Number.NaN;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (theta(mid) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function run(rawParams: Partial<DnaMeltingParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const x = p.selfComplementary ? 1 : 4;
  const tmK = p.deltaH / (p.deltaS + R * Math.log(p.strandConc / x));
  const tmCelsius = tmK - KELVIN;

  const theta = (tK: number) =>
    fractionDuplex(tK, p.deltaH, p.deltaS, p.strandConc, p.selfComplementary);

  const t37 = 37 + KELVIN;
  const fractionDuplexAt37 = theta(t37);
  const deltaGAt37 = p.deltaH - t37 * p.deltaS;
  // Sharpness of the melt: the temperature span over which θ falls 0.9 → 0.1. NaN when the
  // transition does not complete over physical temperatures (θ never reaches 0.9 or 0.1).
  const transitionWidth = tempAtTheta(0.1, p) - tempAtTheta(0.9, p);
  const widthDefined = Number.isFinite(transitionWidth);

  const metrics: Metric[] = [
    { key: 'meltingTemp', label: 'Melting temperature Tm', value: tmCelsius, unit: '°C' },
    {
      key: 'fractionDuplexAt37',
      label: 'Fraction duplex at 37°C',
      value: fractionDuplexAt37,
      note: '1 = fully hybridized',
    },
    {
      key: 'deltaGAt37',
      label: 'ΔG° of hybridization at 37°C',
      value: deltaGAt37,
      unit: 'kJ/mol',
      note: 'ΔH° − T·ΔS°',
    },
    {
      key: 'transitionWidth',
      label: 'Melting transition width (θ 0.9→0.1)',
      value: transitionWidth,
      unit: '°C',
      note: widthDefined
        ? 'narrower = sharper melt (larger |ΔH°|)'
        : 'transition does not complete over physical temperatures',
    },
    { key: 'deltaH', label: 'Association enthalpy ΔH°', value: p.deltaH, unit: 'kJ/mol' },
    { key: 'deltaS', label: 'Association entropy ΔS°', value: p.deltaS, unit: 'kJ/mol/K' },
    { key: 'strandConc', label: 'Total strand concentration', value: p.strandConc, unit: 'M' },
  ];

  const n = p.outputPoints;
  const temps = Array.from(
    { length: n },
    (_, i) => p.tMinCelsius + ((p.tMaxCelsius - p.tMinCelsius) * i) / (n - 1),
  );
  const series: Series[] = [
    {
      x: temps,
      y: { fractionDuplex: temps.map((tC) => theta(tC + KELVIN)) },
      xLabel: 'temperature (°C)',
      yLabel: 'fraction duplex',
    },
  ];

  return {
    engine: 'dna-melting',
    summary: `DNA duplex melting: Tm=${tmCelsius.toFixed(1)}°C at ${p.strandConc.toExponential(1)} M strands (${(100 * fractionDuplexAt37).toFixed(0)}% duplex at 37°C); ${widthDefined ? `melt spans ${transitionWidth.toFixed(1)}°C` : 'the transition does not complete over physical temperatures'}.`,
    metrics,
    series,
    detail: { meltingTemp: tmCelsius, fractionDuplexAt37, deltaGAt37, transitionWidth },
    provenance: provenance('dna-melting', '1.0.0', p),
  };
}

export const spec: EngineSpec<DnaMeltingParams> = {
  slug: 'dna-melting',
  title: 'DNA Duplex Melting (two-state hybridization)',
  domain: 'structural',
  version: '1.0.0',
  description:
    "The thermal melting curve of a DNA/RNA duplex from two-state van't Hoff thermodynamics: two strands associate (S1+S2⇌D) with ΔG°(T)=ΔH°−T·ΔS°, and the fraction in duplex θ = 2β/((2β+1)+√(4β+1)) with β=K·C_T/2 falls sigmoidally with temperature. Reports the concentration-dependent melting temperature Tm=ΔH°/(ΔS°+R·ln(C_T/x)) (x=4 non-self, 1 self-complementary), the fraction hybridized at 37°C, ΔG° at 37°C, and the transition width. Unlike a nearest-neighbour Tm point estimate this is the full curve, and it captures the bimolecular hallmark that Tm rises with strand concentration. Closed-form and deterministic.",
  references: [
    'Marky, L.A. & Breslauer, K.J. (1987) Calculating thermodynamic data for transitions of any molecularity from equilibrium melting curves. Biopolymers 26:1601-1620.',
    'SantaLucia, J. (1998) A unified view of oligonucleotide nearest-neighbor thermodynamics. PNAS 95:1460-1465.',
  ],
  paramsSchema: paramsSchema as z.ZodType<DnaMeltingParams>,
  run,
  example: paramsSchema.parse({ deltaH: -380, deltaS: -1, strandConc: 1e-5 }),
  tags: ['structural', 'dna', 'melting', 'hybridization', 'thermodynamics', 'tm'],
};

export default spec;
