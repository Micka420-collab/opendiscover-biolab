/**
 * Arrhenius reaction rate — how fast a chemical reaction runs as a function of temperature, and
 * the straight line that reveals its energy barrier.
 *
 * Almost every reaction speeds up when heated, because more molecules carry enough energy to
 * clear the activation barrier E_a. The Arrhenius law captures it:
 *
 *     k(T) = A · exp( −E_a / (R·T) ),
 *
 * where A is the attempt frequency (pre-exponential factor), R the gas constant and T the
 * absolute temperature. Taking logs linearises it — ln k = ln A − (E_a/R)·(1/T) — so a plot of
 * ln k against 1/T is a straight line whose slope, −E_a/R, reads off the barrier directly. A
 * handy rule of thumb is Q₁₀, the factor by which the rate rises per 10 °C; for many biological
 * reactions Q₁₀ ≈ 2, which corresponds to a barrier near 50 kJ/mol.
 *
 * This engine reports the rate constant at a chosen temperature, its Q₁₀, the fold-change in rate
 * across the plotted range, and the Arrhenius slope, plus two curves: the rate versus temperature
 * and the classic straight-line Arrhenius plot (ln k versus 1000/T). It is why the fridge slows
 * spoilage, why a fever speeds the body's chemistry, and why enzymes from hot springs power PCR.
 *
 * Closed-form and deterministic; temperatures are bounded above −273 °C so T > 0 and every value
 * stays finite (k ≤ A, exponents bounded).
 *
 * References:
 *   - Arrhenius, S. (1889) Z. Phys. Chem. 4:226-248.
 *   - Laidler, K.J. (1984) The development of the Arrhenius equation. J. Chem. Educ. 61:494.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

/** Gas constant R, J/(mol·K). */
const R = 8.314;

export const paramsSchema = z
  .object({
    /** Pre-exponential factor A (1/s) — the attempt frequency. */
    preExponential: z.number().min(1).max(1e18).default(1e13),
    /** Activation energy E_a (kJ/mol) — the barrier height. */
    activationEnergy: z.number().min(1).max(500).default(50),
    /** Temperature to report the rate at (°C). */
    temperatureC: z.number().min(-50).max(300).default(25),
    /** Lower temperature for the plotted curves (°C). */
    tMinC: z.number().min(-50).max(300).default(-10),
    /** Upper temperature for the plotted curves (°C). */
    tMaxC: z.number().min(-50).max(300).default(100),
    /** Points in the plotted curves. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type ArrheniusParams = z.infer<typeof paramsSchema>;

/** Rate constant k = A·exp(−E_a/(R·T)); E_a in kJ/mol, temperature in °C → T in K. */
export function rateConstant(
  preExponential: number,
  activationEnergyKJ: number,
  tempC: number,
): number {
  const T = tempC + 273.15;
  return preExponential * Math.exp(-(activationEnergyKJ * 1000) / (R * T));
}

export function run(rawParams: Partial<ArrheniusParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { preExponential: A, activationEnergy: Ea } = p;

  const k = rateConstant(A, Ea, p.temperatureC);
  const T = p.temperatureC + 273.15;
  const q10 = Math.exp(((Ea * 1000) / R) * (1 / T - 1 / (T + 10)));
  const foldChange = rateConstant(A, Ea, p.tMaxC) / rateConstant(A, Ea, p.tMinC);
  const slope = -(Ea * 1000) / R; // slope of ln k vs 1/T

  const metrics: Metric[] = [
    {
      key: 'rateConstant',
      label: `Rate constant at ${p.temperatureC} °C`,
      value: k,
      unit: '1/s',
      note: 'k = A·exp(−E_a/RT)',
    },
    {
      key: 'q10',
      label: 'Q₁₀ (rate factor per +10 °C)',
      value: q10,
      note: 'how many times faster the reaction runs for a 10 °C rise',
    },
    {
      key: 'foldChangeOverRange',
      label: `Fold change, ${p.tMinC} → ${p.tMaxC} °C`,
      value: foldChange,
      note: 'how many times faster at the top of the range than the bottom',
    },
    {
      key: 'arrheniusSlope',
      label: 'Arrhenius slope (−E_a/R)',
      value: slope,
      unit: 'K',
      note: 'slope of the straight line ln k vs 1/T',
    },
  ];

  const n = p.outputPoints;
  const temps = Array.from({ length: n }, (_, i) => p.tMinC + ((p.tMaxC - p.tMinC) * i) / (n - 1));
  const rates = temps.map((c) => rateConstant(A, Ea, c));
  const invT = temps.map((c) => 1000 / (c + 273.15)); // 1000/T (1/K)
  const lnRate = rates.map((r) => Math.log(r));
  const series: Series[] = [
    {
      x: temps,
      y: { rate: rates },
      xLabel: 'temperature (°C)',
      yLabel: 'rate constant k (1/s)',
    },
    {
      x: invT,
      y: { lnRate },
      xLabel: '1000 / T (1/K)',
      yLabel: 'ln k  (Arrhenius plot)',
    },
  ];

  return {
    engine: 'arrhenius-rate',
    summary: `Arrhenius: k=${k.toPrecision(3)} /s at ${p.temperatureC} °C for a ${Ea} kJ/mol barrier. Q₁₀=${q10.toPrecision(3)} (rate ×${q10.toPrecision(3)} per 10 °C); across ${p.tMinC}→${p.tMaxC} °C the rate changes ${foldChange.toPrecision(3)}×. ln k vs 1/T is a straight line of slope ${slope.toPrecision(4)} K.`,
    metrics,
    series,
    detail: { rateConstant: k, q10, foldChangeOverRange: foldChange, arrheniusSlope: slope },
    provenance: provenance('arrhenius-rate', '1.0.0', p),
  };
}

export const spec: EngineSpec<ArrheniusParams> = {
  slug: 'arrhenius-rate',
  title: 'Arrhenius Reaction Rate',
  domain: 'biochemistry',
  version: '1.0.0',
  description:
    "How fast a reaction runs versus temperature, from the Arrhenius law k=A·exp(−E_a/RT). Heating speeds a reaction because more molecules clear the activation barrier E_a; taking logs linearises it, so a plot of ln k against 1/T is a straight line whose slope −E_a/R reveals the barrier. Reports the rate constant at a chosen temperature, the Q₁₀ (rate factor per 10 °C — near 2 for a ~50 kJ/mol barrier), the fold-change in rate across the plotted range, and the Arrhenius slope, plus the rate-vs-temperature curve and the classic straight-line Arrhenius plot. Explains why the fridge slows spoilage, why a fever speeds the body's chemistry, and why hot-spring enzymes power PCR. Closed-form and deterministic; temperatures are bounded so T>0 and every value stays finite.",
  references: [
    'Arrhenius, S. (1889) Z. Phys. Chem. 4:226-248.',
    'Laidler, K.J. (1984) The development of the Arrhenius equation. J. Chem. Educ. 61:494.',
  ],
  paramsSchema: paramsSchema as z.ZodType<ArrheniusParams>,
  run,
  example: paramsSchema.parse({ preExponential: 1e13, activationEnergy: 50, temperatureC: 25 }),
  tags: ['biochemistry', 'kinetics', 'arrhenius', 'temperature', 'q10', 'activation-energy'],
};

export default spec;
