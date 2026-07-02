/**
 * Gibbs free energy & chemical equilibrium — which way a reaction goes, and why heat flips it.
 *
 * A reaction's direction is set by the Gibbs free-energy change. The standard change combines
 * enthalpy and entropy,
 *
 *     ΔG° = ΔH° − T·ΔS°,
 *
 * and fixes the equilibrium constant through ΔG° = −R·T·ln K. Away from standard conditions the
 * *actual* driving force also depends on how far from balance the mixture is, via the reaction
 * quotient Q:
 *
 *     ΔG = ΔG° + R·T·ln Q.
 *
 * ΔG < 0 means the reaction runs forward as written; ΔG > 0 means it runs backward; ΔG = 0 is
 * equilibrium. Because ΔH° and ΔS° enter with opposite temperature weighting, heating can flip a
 * reaction's spontaneity — the crossover sits at T = ΔH°/ΔS°. The temperature dependence of K is
 * the van't Hoff relation ln K = −ΔH°/(R·T) + ΔS°/R, a straight line in 1/T whose slope reads out
 * ΔH°. For a simple A ⇌ B the equilibrium product fraction is the logistic 1/(1 + e^{ΔG°/RT}).
 *
 * Closed-form and deterministic. K is reported as log₁₀K (and the product fraction via the
 * logistic form) so that even astronomically favourable reactions never overflow to a non-finite
 * output; every schema field is bounded and T is held strictly positive.
 *
 * References:
 *   - van't Hoff, J.H. (1884) Études de dynamique chimique. Muller, Amsterdam.
 *   - Atkins, P. & de Paula, J. (2014) Physical Chemistry, 10th ed. Oxford (ch. 6).
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

/** Molar gas constant, J/(mol·K). */
const R = 8.314462618;
const LN10 = Math.LN10;
const ABS_ZERO_C = -273.15;

export const paramsSchema = z
  .object({
    /** Standard reaction enthalpy ΔH° (kJ/mol); negative = exothermic. */
    deltaH: z.number().min(-1000).max(1000).default(-40),
    /** Standard reaction entropy ΔS° (J/mol/K). */
    deltaS: z.number().min(-10000).max(10000).default(-100),
    /** Temperature (°C); held above absolute zero by the lower bound. */
    temperatureC: z.number().min(-250).max(1000).default(25),
    /** Reaction quotient Q (dimensionless); 1 = standard conditions. */
    reactionQuotient: z.number().min(1e-12).max(1e12).default(1),
    /** Lowest temperature plotted for the K-vs-T curve (°C). */
    tempPlotMinC: z.number().min(-250).max(1000).default(-20),
    /** Highest temperature plotted for the K-vs-T curve (°C). */
    tempPlotMaxC: z.number().min(-250).max(1000).default(200),
    /** Points in the plotted curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type GibbsEquilibriumParams = z.infer<typeof paramsSchema>;

/** Natural log of the equilibrium constant: ln K = −ΔH°/(R·T) + ΔS°/R (ΔH° in kJ/mol). */
export function lnEquilibriumConstant(deltaHkJ: number, deltaSJ: number, tK: number): number {
  return -(deltaHkJ * 1000) / (R * tK) + deltaSJ / R;
}

export function run(rawParams: Partial<GibbsEquilibriumParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const tK = p.temperatureC - ABS_ZERO_C; // °C → K; > 0 by the schema bound

  const deltaG0 = p.deltaH - (tK * p.deltaS) / 1000; // kJ/mol
  const lnK = lnEquilibriumConstant(p.deltaH, p.deltaS, tK);
  const log10K = lnK / LN10;
  const deltaG = deltaG0 + (R * tK * Math.log(p.reactionQuotient)) / 1000; // kJ/mol
  // A ⇌ B product fraction via the logistic form — finite for any exponent.
  const productFraction = 1 / (1 + Math.exp((deltaG0 * 1000) / (R * tK)));
  // Enthalpy/entropy crossover temperature ΔH°/ΔS° (where ΔG° changes sign). Only a
  // finite, positive-Kelvin root is a real crossover; otherwise there is none (null keeps
  // every reported number finite even when ΔS° → 0 overflows the ratio).
  const crossoverK = p.deltaS !== 0 ? (p.deltaH * 1000) / p.deltaS : Number.POSITIVE_INFINITY;
  const hasCrossover = Number.isFinite(crossoverK) && crossoverK > 0;
  const crossoverC = hasCrossover ? crossoverK + ABS_ZERO_C : null;

  const direction =
    deltaG < -1e-9
      ? 'forward (spontaneous as written)'
      : deltaG > 1e-9
        ? 'reverse'
        : 'at equilibrium';

  const metrics: Metric[] = [
    {
      key: 'deltaG0',
      label: 'Standard free energy ΔG°',
      value: deltaG0,
      unit: 'kJ/mol',
      note: 'ΔH° − T·ΔS°',
    },
    {
      key: 'deltaG',
      label: 'Actual free energy ΔG',
      value: deltaG,
      unit: 'kJ/mol',
      note: `ΔG° + RT·lnQ → runs ${direction}`,
    },
    {
      key: 'log10K',
      label: 'log₁₀ equilibrium constant',
      value: log10K,
      note: 'ΔG° = −RT·lnK; >0 favours products',
    },
    {
      key: 'productFraction',
      label: 'Equilibrium product fraction (A⇌B)',
      value: productFraction,
      note: '1/(1 + e^{ΔG°/RT})',
    },
    {
      key: 'crossoverTemperature',
      label: 'Spontaneity crossover T',
      value: crossoverC ?? 0,
      unit: '°C',
      note: hasCrossover ? 'ΔH°/ΔS° — where ΔG° changes sign' : 'no finite crossover',
    },
  ];

  const n = p.outputPoints;
  const temps = Array.from(
    { length: n },
    (_, i) => p.tempPlotMinC + ((p.tempPlotMaxC - p.tempPlotMinC) * i) / (n - 1),
  );
  const series: Series[] = [
    {
      x: temps,
      y: { lnK: temps.map((tc) => lnEquilibriumConstant(p.deltaH, p.deltaS, tc - ABS_ZERO_C)) },
      xLabel: 'temperature (°C)',
      yLabel: 'ln K',
    },
  ];

  return {
    engine: 'gibbs-equilibrium',
    summary: `Gibbs equilibrium at ${p.temperatureC}°C: ΔG°=${deltaG0.toFixed(1)} kJ/mol, log₁₀K=${log10K.toFixed(2)} → equilibrium is ${(100 * productFraction).toFixed(1)}% product; at Q=${p.reactionQuotient} the actual ΔG=${deltaG.toFixed(1)} kJ/mol so the reaction runs ${direction}.`,
    metrics,
    series,
    detail: { deltaG0, deltaG, log10K, productFraction, crossoverC },
    provenance: provenance('gibbs-equilibrium', '1.0.0', p),
  };
}

export const spec: EngineSpec<GibbsEquilibriumParams> = {
  slug: 'gibbs-equilibrium',
  title: 'Gibbs Free Energy & Chemical Equilibrium',
  domain: 'biochemistry',
  version: '1.0.0',
  description:
    "Which way a reaction goes, from thermodynamics. The standard free energy ΔG°=ΔH°−T·ΔS° sets the equilibrium constant via ΔG°=−RT·lnK, and the actual driving force ΔG=ΔG°+RT·lnQ adds how far the mixture sits from balance: ΔG<0 runs forward, ΔG>0 runs backward, ΔG=0 is equilibrium. Because enthalpy and entropy carry opposite temperature weighting, heating can flip spontaneity at the crossover T=ΔH°/ΔS°, and K follows the van't Hoff line lnK=−ΔH°/(RT)+ΔS°/R. Reports ΔG°, actual ΔG and its direction, log₁₀K, the A⇌B equilibrium product fraction, the crossover temperature, and the ln K-vs-temperature curve. Closed-form, deterministic, and overflow-safe (log₁₀K + logistic fraction).",
  references: [
    "van't Hoff, J.H. (1884) Études de dynamique chimique. Frederik Muller, Amsterdam.",
    'Atkins, P. & de Paula, J. (2014) Physical Chemistry, 10th ed. Oxford University Press.',
  ],
  paramsSchema: paramsSchema as z.ZodType<GibbsEquilibriumParams>,
  run,
  example: paramsSchema.parse({ deltaH: -40, deltaS: -100, temperatureC: 25, reactionQuotient: 1 }),
  tags: ['biochemistry', 'thermodynamics', 'gibbs', 'equilibrium', 'vant-hoff', 'spontaneity'],
};

export default spec;
