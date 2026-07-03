/**
 * Photosynthesis light response — how a leaf's carbon uptake depends on light, and the light
 * level at which a plant just breaks even (the compensation point).
 *
 * As light brightens, photosynthesis rises steeply, then saturates once the machinery is
 * running flat out. The gross rate follows a rectangular hyperbola (the same saturating shape
 * as Michaelis–Menten enzyme kinetics):
 *
 *     P_gross(I) = P_max · I / (I + K_m),
 *
 * where P_max is the light-saturated maximum and K_m the light for half of it. But a plant also
 * burns carbon in the dark by respiring, at rate R_d, so what it actually gains is the NET
 * rate P_net = P_gross − R_d. Net photosynthesis is negative in the dark (the plant loses
 * carbon), crosses zero at the LIGHT COMPENSATION POINT I_c = R_d·K_m/(P_max − R_d), and
 * plateaus at P_max − R_d in bright light. The compensation point is why a plant in deep shade
 * slowly starves: below it, respiration outruns photosynthesis.
 *
 * This engine reports the gross and net rate at a chosen light, the light-saturated net rate,
 * the compensation point, and the initial quantum yield (light-use efficiency), plus the gross
 * and net light-response curves. Closed-form and deterministic; the compensation point is
 * guarded to stay finite (0 when the plant can never break even, P_max ≤ R_d).
 *
 * References:
 *   - Thornley, J.H.M. (1976) Mathematical Models in Plant Physiology.
 *   - Lambers, H., Chapin, F.S. & Pons, T.L. (2008) Plant Physiological Ecology, 2nd ed.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Light-saturated maximum gross rate P_max (µmol CO₂ m⁻² s⁻¹). */
    maxRate: z.number().min(1e-6).max(1e6).default(20),
    /** Half-saturation light K_m (µmol photons m⁻² s⁻¹). */
    halfSatLight: z.number().min(1e-6).max(1e9).default(200),
    /** Dark respiration R_d — carbon burnt regardless of light (µmol CO₂ m⁻² s⁻¹). */
    respiration: z.number().min(0).max(1e6).default(2),
    /** The light level to report the rate at (µmol photons m⁻² s⁻¹). */
    light: z.number().min(0).max(1e9).default(400),
    /** Upper light for the plotted response curve. */
    lightMax: z.number().min(1e-6).max(1e9).default(1000),
    /** Points in the plotted curves. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type PhotosynthesisParams = z.infer<typeof paramsSchema>;

/** Gross photosynthesis at light I: P_max·I/(I+K_m). */
export function grossRate(light: number, maxRate: number, halfSatLight: number): number {
  return (maxRate * light) / (light + halfSatLight);
}

export function run(rawParams: Partial<PhotosynthesisParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { maxRate: pmax, halfSatLight: km, respiration: rd } = p;

  const grossAtLight = grossRate(p.light, pmax, km);
  const netAtLight = grossAtLight - rd;
  const lightSaturatedNet = pmax - rd; // net rate as light → ∞
  const quantumYield = pmax / km; // initial slope dP/dI at I=0 (light-use efficiency)

  // Light compensation point: net photosynthesis crosses zero here. Only defined when the
  // plant can out-earn its respiration (P_max > R_d); otherwise it never breaks even → 0.
  const denom = pmax - rd;
  const rawCompensation = (rd * km) / denom;
  const compensationPoint = denom > 0 && Number.isFinite(rawCompensation) ? rawCompensation : 0;
  const canBreakEven = denom > 0;

  const metrics: Metric[] = [
    {
      key: 'grossRateAtLight',
      label: `Gross rate at ${p.light} light`,
      value: grossAtLight,
      unit: 'µmol/m²/s',
      note: 'P_max·I/(I+K_m) — before respiration',
    },
    {
      key: 'netRateAtLight',
      label: `Net rate at ${p.light} light`,
      value: netAtLight,
      unit: 'µmol/m²/s',
      note: 'gross − respiration; negative means the plant is losing carbon',
    },
    {
      key: 'lightSaturatedNet',
      label: 'Light-saturated net rate',
      value: lightSaturatedNet,
      unit: 'µmol/m²/s',
      note: 'P_max − R_d — the ceiling in bright light',
    },
    {
      key: 'lightCompensationPoint',
      label: 'Light compensation point',
      value: compensationPoint,
      unit: 'µmol/m²/s',
      note: canBreakEven
        ? 'R_d·K_m/(P_max−R_d) — the light where the plant breaks even'
        : 'never breaks even: respiration exceeds the most it can photosynthesise',
    },
    {
      key: 'initialQuantumYield',
      label: 'Initial quantum yield',
      value: quantumYield,
      note: 'P_max/K_m — slope of the response at low light (light-use efficiency)',
    },
    {
      key: 'canBreakEven',
      label: 'Can break even',
      value: canBreakEven ? 1 : 0,
      note: canBreakEven
        ? 'gains carbon above the compensation light'
        : 'respires more than it can ever fix',
    },
  ];

  const n = p.outputPoints;
  const lights = Array.from({ length: n }, (_, i) => (p.lightMax * i) / (n - 1));
  const gross = lights.map((I) => grossRate(I, pmax, km));
  const net = gross.map((g) => g - rd);
  const series: Series[] = [
    {
      x: lights,
      y: { gross, net },
      xLabel: 'light (µmol photons/m²/s)',
      yLabel: 'photosynthesis (µmol CO₂/m²/s)',
    },
  ];

  return {
    engine: 'photosynthesis-light',
    summary: `Photosynthesis light response: net ${netAtLight.toPrecision(3)} µmol/m²/s at light ${p.light} (gross ${grossAtLight.toPrecision(3)} − respiration ${rd}). ${canBreakEven ? `Breaks even at ${compensationPoint.toPrecision(3)} light` : 'Never breaks even'}; the bright-light ceiling is ${lightSaturatedNet.toPrecision(3)}.`,
    metrics,
    series,
    detail: {
      grossAtLight,
      netAtLight,
      compensationPoint,
      lightSaturatedNet,
      quantumYield,
      canBreakEven,
    },
    provenance: provenance('photosynthesis-light', '1.0.0', p),
  };
}

export const spec: EngineSpec<PhotosynthesisParams> = {
  slug: 'photosynthesis-light',
  title: 'Photosynthesis Light Response',
  domain: 'ecology',
  version: '1.0.0',
  description:
    "How a leaf's carbon uptake depends on light. Gross photosynthesis follows a saturating rectangular hyperbola P=P_max·I/(I+K_m); subtracting the plant's dark respiration R_d gives the NET rate, which is negative in the dark, crosses zero at the light compensation point I_c=R_d·K_m/(P_max−R_d), and plateaus at P_max−R_d in bright light. Reports the gross and net rate at a chosen light, the light-saturated net rate, the compensation point (guarded to 0 when the plant can never break even), and the initial quantum yield, plus the gross and net light-response curves. This is the basis of net primary productivity — how ecosystems capture carbon. Closed-form and deterministic.",
  references: [
    'Thornley, J.H.M. (1976) Mathematical Models in Plant Physiology.',
    'Lambers, H., Chapin, F.S. & Pons, T.L. (2008) Plant Physiological Ecology, 2nd ed.',
  ],
  paramsSchema: paramsSchema as z.ZodType<PhotosynthesisParams>,
  run,
  example: paramsSchema.parse({ maxRate: 20, halfSatLight: 200, respiration: 2, light: 400 }),
  tags: ['ecology', 'photosynthesis', 'primary-production', 'carbon', 'plant', 'light-response'],
};

export default spec;
