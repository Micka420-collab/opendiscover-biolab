/**
 * Brownian motion & the Stokes–Einstein relation — how fast molecules wander.
 *
 * A molecule jostled by thermal collisions performs a random walk whose mean-squared
 * displacement grows linearly with time, ⟨x²⟩ = 2·d·D·t in d dimensions, so the typical
 * distance travelled scales only as the SQUARE ROOT of time. The diffusion coefficient of
 * a sphere of hydrodynamic radius r in a fluid of viscosity η at temperature T is set by
 * the Stokes–Einstein relation
 *
 *     D = kB·T / (6π·η·r),
 *
 * the balance of thermal energy kBT against viscous drag. Run it forward to predict how far
 * a protein roams per second; invert it, r = kB·T/(6π·η·D), and a measured D (from dynamic
 * light scattering or single-particle tracking) reports the molecule's size.
 *
 * Closed-form and deterministic; every denominator (6π·η·r) is strictly positive.
 *
 * References:
 *   - Einstein, A. (1905) Über die von der molekularkinetischen Theorie der Wärme
 *     geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen. Ann. Phys.
 *     322:549-560.
 *   - Berg, H.C. (1993) Random Walks in Biology. Princeton University Press.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

/** Boltzmann constant (J/K). */
const KB = 1.380649e-23;
/** A characteristic cell diameter (µm) for the "time to cross a cell" readout. */
const CELL_DIAMETER_UM = 10;

export const paramsSchema = z
  .object({
    /** Hydrodynamic radius of the particle (nm). Lower bound (1 pm) keeps 6π·η·r from
     * underflowing to 0 after the nm→m conversion. */
    radius: z.number().min(1e-3).max(1e6).default(5),
    /** Solvent viscosity η (mPa·s; water ≈ 1). Lower bound keeps the denominator finite. */
    viscosity: z.number().min(1e-6).max(1e6).default(1),
    /** Temperature (°C). */
    temperatureC: z.number().min(-20).max(200).default(20),
    /** Spatial dimensions for the mean-squared displacement (1, 2, or 3). */
    dimensions: z.number().int().min(1).max(3).default(3),
    /** Observation time at which to report the RMS displacement (s). */
    observationTime: z.number().positive().max(1e9).default(1),
    /** Time span of the plotted displacement curve (s). */
    timeMax: z.number().positive().max(1e12).default(2),
    /** Points in the plotted curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type DiffusionParams = z.infer<typeof paramsSchema>;

/** Stokes–Einstein diffusion coefficient in µm²/s from radius (nm), viscosity (mPa·s), T (°C). */
export function diffusionCoefficient(radiusNm: number, viscosityMPa: number, tC: number): number {
  const rM = radiusNm * 1e-9;
  const etaPa = viscosityMPa * 1e-3;
  const dSi = (KB * (tC + 273.15)) / (6 * Math.PI * etaPa * rM); // m²/s
  return dSi * 1e12; // → µm²/s
}

/** RMS displacement (µm) after time t (s): √(2·d·D·t). */
export function rmsDisplacement(dUm2s: number, dims: number, t: number): number {
  return Math.sqrt(2 * dims * dUm2s * t);
}

export function run(rawParams: Partial<DiffusionParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const d = diffusionCoefficient(p.radius, p.viscosity, p.temperatureC);
  const dims = p.dimensions;

  const rmsAtObs = rmsDisplacement(d, dims, p.observationTime);
  // Time for the MSD to reach a cell-diameter-squared: L² = 2·d·D·t.
  const timeToCrossCell = CELL_DIAMETER_UM ** 2 / (2 * dims * d);
  const kTpNnm = KB * (p.temperatureC + 273.15) * 1e21; // J → pN·nm

  const metrics: Metric[] = [
    {
      key: 'diffusionCoefficient',
      label: 'Diffusion coefficient D',
      value: d,
      unit: 'µm²/s',
      note: 'kB·T / (6π·η·r)',
    },
    {
      key: 'rmsDisplacement',
      label: `RMS displacement at ${p.observationTime} s`,
      value: rmsAtObs,
      unit: 'µm',
      note: `√(2·${dims}·D·t) in ${dims}D`,
    },
    {
      key: 'timeToCrossCell',
      label: 'Time to diffuse across a 10 µm cell',
      value: timeToCrossCell,
      unit: 's',
      note: 'L² / (2·d·D)',
    },
    {
      key: 'hydrodynamicRadius',
      label: 'Hydrodynamic radius r',
      value: p.radius,
      unit: 'nm',
      note: 'invert D to size an unknown particle',
    },
    { key: 'viscosity', label: 'Solvent viscosity η', value: p.viscosity, unit: 'mPa·s' },
    {
      key: 'thermalEnergy',
      label: 'Thermal energy kB·T',
      value: kTpNnm,
      unit: 'pN·nm',
      note: 'the drive behind Brownian motion',
    },
  ];

  const n = p.outputPoints;
  const times = Array.from({ length: n }, (_, i) => (p.timeMax * i) / (n - 1));
  const series: Series[] = [
    {
      x: times,
      y: {
        rmsDisplacement: times.map((t) => rmsDisplacement(d, dims, t)),
        msd: times.map((t) => 2 * dims * d * t),
      },
      xLabel: 'time (s)',
      yLabel: 'RMS displacement (µm) / MSD (µm²)',
    },
  ];

  return {
    engine: 'diffusion',
    summary: `Stokes–Einstein: a ${p.radius} nm particle in η=${p.viscosity} mPa·s at ${p.temperatureC}°C has D=${d.toFixed(2)} µm²/s, wandering ${rmsAtObs.toFixed(2)} µm in ${p.observationTime} s (${dims}D) and crossing a 10 µm cell in ${timeToCrossCell.toFixed(2)} s.`,
    metrics,
    series,
    detail: { diffusionCoefficient: d, rmsDisplacement: rmsAtObs, timeToCrossCell },
    provenance: provenance('diffusion', '1.0.0', p),
  };
}

export const spec: EngineSpec<DiffusionParams> = {
  slug: 'diffusion',
  title: 'Brownian Motion & Stokes–Einstein Diffusion',
  domain: 'biochemistry',
  version: '1.0.0',
  description:
    'How fast molecules wander by thermal motion: the Stokes–Einstein relation D=kB·T/(6π·η·r) gives the diffusion coefficient of a sphere of hydrodynamic radius r in a fluid of viscosity η, and the random walk gives a mean-squared displacement ⟨x²⟩=2·d·D·t so distance grows as √t. Reports D, the RMS displacement at a chosen time, the time to diffuse across a 10 µm cell, the thermal energy kBT, and inverts to hydrodynamic radius — the physics behind dynamic light scattering, FRAP and single-particle tracking. Closed-form and deterministic.',
  references: [
    'Einstein, A. (1905) Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung… Ann. Phys. 322:549-560.',
    'Berg, H.C. (1993) Random Walks in Biology. Princeton University Press.',
  ],
  paramsSchema: paramsSchema as z.ZodType<DiffusionParams>,
  run,
  example: paramsSchema.parse({ radius: 5, viscosity: 1, temperatureC: 20 }),
  tags: [
    'biochemistry',
    'diffusion',
    'brownian-motion',
    'stokes-einstein',
    'biophysics',
    'hydrodynamic-radius',
  ],
};

export default spec;
