/**
 * Osmotic pressure & colligative properties — the van't Hoff law.
 *
 * Dissolved particles lower a solvent's chemical potential regardless of what they are,
 * which is why the effect depends on how MANY particles are present, not their identity.
 * The osmotic pressure a solution would pull water across a membrane with is
 *
 *     Π = i·M·R·T,
 *
 * where i is the van't Hoff factor (particles released per formula unit — 1 for glucose,
 * 2 for NaCl, 3 for CaCl₂), M the molar concentration, R the gas constant and T the
 * absolute temperature. The same particle count sets the osmolarity i·M, the freezing-point
 * depression ΔTf = i·Kf·M, and — comparing a cell's surroundings to its interior — the
 * tonicity that decides whether the cell swells, holds, or shrinks. Running it backwards,
 * measuring Π for a known mass concentration reports a solute's molar mass (osmometry).
 *
 * Closed-form and deterministic; every schema field has a physical lower bound so no
 * denormal input can drive a division non-finite.
 *
 * References:
 *   - van't Hoff, J.H. (1887) Die Rolle des osmotischen Drucks in der Analogie zwischen
 *     Lösungen und Gasen. Z. Phys. Chem. 1:481-508.
 *   - Atkins, P. & de Paula, J. (2014) Physical Chemistry, 10th ed. Oxford (ch. 5).
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

/** Gas constant in L·atm/(mol·K), and unit helpers. */
const R_ATM = 0.082057338;
const ATM_TO_KPA = 101.325;
/** Cryoscopic constant of water (°C·kg/mol). */
const KF_WATER = 1.86;
/** Fractional tolerance within which a solution counts as isotonic. */
const ISO_TOLERANCE = 0.05;

export const paramsSchema = z
  .object({
    /** van't Hoff factor i (particles per formula unit: glucose 1, NaCl 2, CaCl₂ 3). */
    vantHoffFactor: z.number().min(1e-6).max(10).default(2),
    /** Molar concentration M (mol/L). */
    molarity: z.number().min(1e-9).max(100).default(0.154),
    /** Temperature (°C). */
    temperatureC: z.number().min(-20).max(200).default(37),
    /** Reference osmolarity to judge tonicity against (Osm/L; blood plasma ≈ 0.30). */
    referenceOsmolarity: z.number().min(1e-9).max(100).default(0.3),
    /** Solute mass concentration (g/L), for the osmometry molar-mass readout. */
    massConcentration: z.number().min(1e-9).max(1e6).default(9),
    /** Highest molar concentration plotted (mol/L). */
    concentrationMax: z.number().min(1e-9).max(100).default(0.6),
    /** Points in the plotted Π-vs-M curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type OsmoticPressureParams = z.infer<typeof paramsSchema>;

/** Osmotic pressure Π = i·M·R·T in atm, from i, molarity (mol/L) and temperature (°C). */
export function osmoticPressureAtm(i: number, molarity: number, tC: number): number {
  return i * molarity * R_ATM * (tC + 273.15);
}

/** Tonicity of a solution versus a reference osmolarity. */
export function classifyTonicity(osmolarity: number, reference: number): string {
  const ratio = osmolarity / reference;
  if (ratio > 1 + ISO_TOLERANCE) return 'hypertonic';
  if (ratio < 1 - ISO_TOLERANCE) return 'hypotonic';
  return 'isotonic';
}

export function run(rawParams: Partial<OsmoticPressureParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const i = p.vantHoffFactor;

  const piAtm = osmoticPressureAtm(i, p.molarity, p.temperatureC);
  const osmolarity = i * p.molarity;
  const tonicity = classifyTonicity(osmolarity, p.referenceOsmolarity);
  const tonicityRatio = osmolarity / p.referenceOsmolarity;
  const freezingPointDepression = i * KF_WATER * p.molarity;
  const impliedMolarMass = p.massConcentration / p.molarity; // g/mol

  const cellFate =
    tonicity === 'hypertonic'
      ? 'a cell here shrinks (water leaves)'
      : tonicity === 'hypotonic'
        ? 'a cell here swells and may lyse (water enters)'
        : 'a cell here holds its volume';

  const metrics: Metric[] = [
    {
      key: 'osmoticPressure',
      label: 'Osmotic pressure Π',
      value: piAtm,
      unit: 'atm',
      note: 'Π = i·M·R·T',
    },
    {
      key: 'osmoticPressureKPa',
      label: 'Osmotic pressure Π',
      value: piAtm * ATM_TO_KPA,
      unit: 'kPa',
    },
    {
      key: 'osmolarity',
      label: 'Osmolarity',
      value: osmolarity,
      unit: 'Osm/L',
      note: 'i·M: total dissolved-particle concentration',
    },
    {
      key: 'tonicityRatio',
      label: 'Tonicity ratio vs reference',
      value: tonicityRatio,
      note: `${tonicity} — ${cellFate}`,
    },
    {
      key: 'freezingPointDepression',
      label: 'Freezing-point depression ΔTf',
      value: freezingPointDepression,
      unit: '°C',
      note: 'ΔTf = i·Kf·M (Kf water = 1.86)',
    },
    {
      key: 'impliedMolarMass',
      label: 'Implied molar mass',
      value: impliedMolarMass,
      unit: 'g/mol',
      note: 'mass conc / molarity — the osmometry readout',
    },
    { key: 'vantHoffFactor', label: "van't Hoff factor i", value: i },
  ];

  const n = p.outputPoints;
  const molarities = Array.from({ length: n }, (_, idx) => (p.concentrationMax * idx) / (n - 1));
  const series: Series[] = [
    {
      x: molarities,
      y: { osmoticPressure: molarities.map((m) => osmoticPressureAtm(i, m, p.temperatureC)) },
      xLabel: 'molar concentration M (mol/L)',
      yLabel: 'osmotic pressure Π (atm)',
    },
  ];

  return {
    engine: 'osmotic-pressure',
    summary: `Osmotic pressure Π=${piAtm.toFixed(2)} atm (${(piAtm * ATM_TO_KPA).toFixed(0)} kPa) for i=${i}, ${p.molarity} M at ${p.temperatureC}°C → osmolarity ${osmolarity.toFixed(3)} Osm/L, ${tonicity} vs the ${p.referenceOsmolarity} Osm/L reference (${cellFate}).`,
    metrics,
    series,
    detail: {
      osmoticPressure: piAtm,
      osmolarity,
      tonicityRatio,
      freezingPointDepression,
      impliedMolarMass,
    },
    provenance: provenance('osmotic-pressure', '1.0.0', p),
  };
}

export const spec: EngineSpec<OsmoticPressureParams> = {
  slug: 'osmotic-pressure',
  title: "Osmotic Pressure & Colligative Properties (van't Hoff)",
  domain: 'biochemistry',
  version: '1.0.0',
  description:
    "Colligative properties from the van't Hoff law: dissolved particles set the osmotic pressure Π=i·M·R·T, the osmolarity i·M, and the freezing-point depression ΔTf=i·Kf·M — all depending only on the particle count (the van't Hoff factor i times molarity), not the solute identity. Classifies a solution's tonicity (hypo/iso/hypertonic) against a reference osmolarity and states whether a cell swells, holds, or shrinks, and inverts Π to a molar mass (membrane osmometry). Reports Π in atm and kPa, osmolarity, ΔTf, tonicity and the implied molar mass, plus the Π-vs-concentration curve. Closed-form and deterministic.",
  references: [
    "van't Hoff, J.H. (1887) Die Rolle des osmotischen Drucks… Z. Phys. Chem. 1:481-508.",
    'Atkins, P. & de Paula, J. (2014) Physical Chemistry, 10th ed. Oxford University Press.',
  ],
  paramsSchema: paramsSchema as z.ZodType<OsmoticPressureParams>,
  run,
  example: paramsSchema.parse({ vantHoffFactor: 2, molarity: 0.154, temperatureC: 37 }),
  tags: ['biochemistry', 'osmosis', 'osmotic-pressure', 'colligative', 'tonicity', 'vant-hoff'],
};

export default spec;
