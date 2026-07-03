/**
 * Hagen–Poiseuille flow — how fast a fluid moves through a tube (a blood vessel, a pipette,
 * a microfluidic channel).
 *
 * For steady, laminar flow of a Newtonian fluid through a straight cylindrical tube, the
 * volumetric flow rate is
 *
 *     Q = π · ΔP · r⁴ / (8 · η · L),
 *
 * where ΔP is the pressure difference driving the flow, r the tube radius, η the fluid
 * viscosity and L the tube length. The striking feature is the FOURTH power of the radius:
 * halving r cuts the flow sixteen-fold — which is why a small arterial narrowing chokes blood
 * flow so dramatically, and why capillaries need a beating heart behind them. The velocity
 * across the tube is a parabola, zero at the wall and fastest (twice the mean) at the centre.
 *
 * This engine reports the flow rate, the hydraulic resistance, the mean and peak velocity, the
 * wall shear stress, and the Reynolds number (a check on whether the laminar assumption still
 * holds), plus the parabolic velocity profile. Inputs are given in friendly units (radius in
 * mm, length in cm) and converted to SI internally.
 *
 * Closed-form and deterministic; every field is bounded so flow, resistance and velocity stay
 * finite.
 *
 * References:
 *   - Hagen, G. (1839); Poiseuille, J.L.M. (1840–41), independent derivations.
 *   - Sutera, S.P. & Skalak, R. (1993) The history of Poiseuille's law. Annu. Rev. Fluid Mech.
 *     25:1-19.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

/** Reynolds number above which pipe flow starts to become turbulent (laminar assumption fails). */
export const TURBULENT_RE = 2300;

export const paramsSchema = z
  .object({
    /** Tube (vessel) radius, in millimetres. */
    radius: z.number().min(1e-3).max(100).default(2),
    /** Tube length, in centimetres. */
    length: z.number().min(1e-3).max(1e6).default(5),
    /** Pressure difference driving the flow (Pa); ~3.75 mmHg over the default segment. */
    pressureDrop: z.number().min(1e-6).max(1e12).default(500),
    /** Fluid viscosity η (Pa·s); water ≈ 1e-3, blood ≈ 3.5e-3. */
    viscosity: z.number().min(1e-9).max(1e6).default(3.5e-3),
    /** Fluid density ρ (kg/m³), used only for the Reynolds number; blood ≈ 1060. */
    density: z.number().min(1e-3).max(1e6).default(1060),
    /** Points in the plotted velocity profile. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type PoiseuilleParams = z.infer<typeof paramsSchema>;

/** Volumetric flow rate Q = π·ΔP·r⁴/(8·η·L), all arguments in SI (m, Pa, Pa·s) → m³/s. */
export function flowRate(
  pressureDrop: number,
  radius_m: number,
  viscosity: number,
  length_m: number,
): number {
  return (Math.PI * pressureDrop * radius_m ** 4) / (8 * viscosity * length_m);
}

export function run(rawParams: Partial<PoiseuilleParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);

  const r = p.radius * 1e-3; // mm → m
  const L = p.length * 1e-2; // cm → m

  const q = flowRate(p.pressureDrop, r, p.viscosity, L); // m³/s
  const resistance = (8 * p.viscosity * L) / (Math.PI * r ** 4); // Pa·s/m³  (Q = ΔP / R)
  const area = Math.PI * r * r; // m²
  const meanVelocity = q / area; // m/s
  const maxVelocity = 2 * meanVelocity; // centreline (parabolic profile)
  const wallShear = (p.pressureDrop * r) / (2 * L); // Pa  ( = 4ηQ/πr³ )
  const reynolds = (p.density * meanVelocity * (2 * r)) / p.viscosity; // dimensionless
  const laminar = reynolds < TURBULENT_RE;

  const flowMlS = q * 1e6; // m³/s → mL/s

  const metrics: Metric[] = [
    {
      key: 'flowRate',
      label: 'Flow rate Q',
      value: flowMlS,
      unit: 'mL/s',
      note: 'π·ΔP·r⁴ / (8·η·L) — rises as the fourth power of radius',
    },
    {
      key: 'resistance',
      label: 'Hydraulic resistance',
      value: resistance,
      unit: 'Pa·s/m³',
      note: '8·η·L / (π·r⁴); Q = ΔP / R',
    },
    {
      key: 'meanVelocity',
      label: 'Mean velocity',
      value: meanVelocity * 100,
      unit: 'cm/s',
      note: 'Q / area',
    },
    {
      key: 'maxVelocity',
      label: 'Peak (centreline) velocity',
      value: maxVelocity * 100,
      unit: 'cm/s',
      note: 'twice the mean — the parabola peaks at the centre',
    },
    {
      key: 'wallShearStress',
      label: 'Wall shear stress',
      value: wallShear,
      unit: 'Pa',
      note: 'ΔP·r / (2·L); the drag the flow exerts on the wall',
    },
    {
      key: 'reynoldsNumber',
      label: 'Reynolds number',
      value: reynolds,
      note: `laminar (Poiseuille valid) while below ~${TURBULENT_RE}`,
    },
    {
      key: 'laminar',
      label: 'Flow is laminar',
      value: laminar ? 1 : 0,
      note: laminar
        ? 'smooth layered flow — the formula holds'
        : 'turbulent onset — the formula understates losses',
    },
  ];

  const n = p.outputPoints;
  // Radial position across the diameter, −r … +r (mm); velocity profile v(y)=v_max·(1−(y/r)²).
  const xs = Array.from({ length: n }, (_, i) => -p.radius + (2 * p.radius * i) / (n - 1));
  const velocity = xs.map((xMm) => {
    const frac = xMm / p.radius; // −1 … +1
    return maxVelocity * (1 - frac * frac) * 100; // cm/s
  });
  const series: Series[] = [
    {
      x: xs,
      y: { velocity },
      xLabel: 'position across tube (mm)',
      yLabel: 'velocity (cm/s)',
    },
  ];

  return {
    engine: 'poiseuille-flow',
    summary: `Poiseuille flow: Q=${flowMlS.toPrecision(3)} mL/s through a ${p.radius} mm × ${p.length} cm tube (Q ∝ r⁴). Peak velocity ${(maxVelocity * 100).toPrecision(3)} cm/s at the centre; Reynolds ${reynolds.toPrecision(3)} → ${laminar ? 'laminar' : 'turbulent onset'}.`,
    metrics,
    series,
    detail: { flowRate_m3s: q, resistance, meanVelocity, wallShear, reynolds, laminar },
    provenance: provenance('poiseuille-flow', '1.0.0', p),
  };
}

export const spec: EngineSpec<PoiseuilleParams> = {
  slug: 'poiseuille-flow',
  title: 'Blood Flow (Hagen–Poiseuille)',
  domain: 'biochemistry',
  version: '1.0.0',
  description:
    'How fast a fluid flows through a tube — a blood vessel, pipette or microchannel — from the Hagen–Poiseuille law Q=π·ΔP·r⁴/(8·η·L). Flow rises with the fourth power of radius, so a small narrowing chokes it dramatically (halving the radius cuts flow 16×); the velocity across the tube is a parabola, zero at the wall and twice the mean at the centre. Reports flow rate, hydraulic resistance, mean and peak velocity, wall shear stress, and the Reynolds number (a check that the flow is still laminar so the law applies), plus the parabolic velocity profile. Inputs use friendly units (radius mm, length cm), converted to SI internally. Closed-form and deterministic.',
  references: [
    'Sutera, S.P. & Skalak, R. (1993) The history of Poiseuille’s law. Annu. Rev. Fluid Mech. 25:1-19.',
  ],
  paramsSchema: paramsSchema as z.ZodType<PoiseuilleParams>,
  run,
  example: paramsSchema.parse({ radius: 2, length: 5, pressureDrop: 500, viscosity: 3.5e-3 }),
  tags: ['biochemistry', 'physiology', 'fluid', 'flow', 'poiseuille', 'blood', 'transport'],
};

export default spec;
