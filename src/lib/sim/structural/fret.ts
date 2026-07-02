/**
 * FRET — Förster resonance energy transfer, the molecular ruler.
 *
 * When an excited donor fluorophore sits a few nanometres from an acceptor, it can hand
 * off its energy without emitting a photon, at an efficiency that falls off with the SIXTH
 * power of the donor–acceptor distance r:
 *
 *     E(r) = 1 / (1 + (r/R0)^6),
 *
 * where the Förster radius R0 is the distance at which transfer is exactly 50% efficient.
 * That steep sixth-power law is what makes FRET a ruler: efficiency swings from ~90% to
 * ~10% over less than a threefold change in distance, so a measured E pins r to within a
 * few ångström over the ~1–10 nm range that spans protein domains and nucleic-acid helices.
 * Inverting the law, r = R0·((1−E)/E)^(1/6), turns a fluorescence reading into a distance.
 *
 * Closed-form and deterministic; the denominator 1+(r/R0)^6 ≥ 1 so there is no singularity,
 * and E is always in (0,1].
 *
 * References:
 *   - Förster, T. (1948) Zwischenmolekulare Energiewanderung und Fluoreszenz. Ann. Phys.
 *     437:55-75.
 *   - Lakowicz, J.R. (2006) Principles of Fluorescence Spectroscopy, 3rd ed. Springer
 *     (ch. 13, energy transfer).
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Donor–acceptor distance r (nm). */
    distance: z.number().positive().max(1000).default(5),
    /** Förster radius R0 (nm) — the distance of 50% transfer efficiency. */
    forsterRadius: z.number().positive().max(1000).default(5),
    /** Points in the plotted E-vs-r curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type FretParams = z.infer<typeof paramsSchema>;

/** FRET efficiency E(r) = 1/(1 + (r/R0)^6). Always in (0,1]. */
export function efficiency(r: number, r0: number): number {
  const x = r / r0;
  return 1 / (1 + x ** 6);
}

/** Magnitude of the distance sensitivity |dE/dr| (per nm): 6·(r/R0)^5 / (R0·(1+(r/R0)^6)^2). */
export function sensitivity(r: number, r0: number): number {
  const x = r / r0;
  const denom = 1 + x ** 6;
  return (6 * x ** 5) / (r0 * denom * denom);
}

/** Recover the distance from a measured efficiency: r = R0·((1−E)/E)^(1/6). */
export function distanceFromEfficiency(e: number, r0: number): number {
  return r0 * ((1 - e) / e) ** (1 / 6);
}

export function run(rawParams: Partial<FretParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const r0 = p.forsterRadius;

  const e = efficiency(p.distance, r0);
  // Distances where E = 90% and 10%: (r/R0)^6 = 1/9 and 9 respectively.
  const workingRangeLow = r0 * (1 / 9) ** (1 / 6);
  const workingRangeHigh = r0 * 9 ** (1 / 6);
  const dEdr = sensitivity(p.distance, r0);
  const inRange = p.distance >= workingRangeLow && p.distance <= workingRangeHigh;

  const metrics: Metric[] = [
    {
      key: 'efficiency',
      label: 'Transfer efficiency E',
      value: e,
      note: '1/(1+(r/R0)⁶)',
    },
    {
      key: 'forsterRadius',
      label: 'Förster radius R0',
      value: r0,
      unit: 'nm',
      note: 'distance of 50% transfer',
    },
    {
      key: 'workingRangeLow',
      label: 'Ruler range (E=90%)',
      value: workingRangeLow,
      unit: 'nm',
      note: 'closer than this, E saturates near 1',
    },
    {
      key: 'workingRangeHigh',
      label: 'Ruler range (E=10%)',
      value: workingRangeHigh,
      unit: 'nm',
      note: 'farther than this, E is too small to read',
    },
    {
      key: 'sensitivity',
      label: 'Distance sensitivity |dE/dr|',
      value: dEdr,
      unit: '/nm',
      note: inRange ? 'steep — good ruler here' : 'shallow — poor ruler at this distance',
    },
    {
      key: 'dynamicRange',
      label: 'Ruler dynamic range',
      value: workingRangeHigh - workingRangeLow,
      unit: 'nm',
      note: 'span of distances FRET resolves well',
    },
  ];

  const n = p.outputPoints;
  const rMax = Math.max(3 * r0, 1.5 * p.distance);
  const distances = Array.from({ length: n }, (_, i) => (rMax * i) / (n - 1));
  const series: Series[] = [
    {
      x: distances,
      y: {
        efficiency: distances.map((r) => efficiency(r, r0)),
        sensitivity: distances.map((r) => sensitivity(r, r0)),
      },
      xLabel: 'donor–acceptor distance r (nm)',
      yLabel: 'efficiency E / sensitivity |dE/dr|',
    },
  ];

  return {
    engine: 'fret',
    summary: `FRET at r=${p.distance} nm with R0=${r0} nm: efficiency E=${(100 * e).toFixed(1)}% (${inRange ? 'inside' : 'outside'} the ${workingRangeLow.toFixed(1)}–${workingRangeHigh.toFixed(1)} nm ruler range); the sixth-power law makes this a nanometre ruler.`,
    metrics,
    series,
    detail: {
      efficiency: e,
      forsterRadius: r0,
      workingRangeLow,
      workingRangeHigh,
      sensitivity: dEdr,
    },
    provenance: provenance('fret', '1.0.0', p),
  };
}

export const spec: EngineSpec<FretParams> = {
  slug: 'fret',
  title: 'FRET — Förster Resonance Energy Transfer (molecular ruler)',
  domain: 'structural',
  version: '1.0.0',
  description:
    'The molecular ruler of fluorescence microscopy: the energy-transfer efficiency between a donor and acceptor fluorophore is E=1/(1+(r/R0)⁶), where R0 (the Förster radius) is the distance of 50% transfer. The sixth-power distance dependence makes E swing from ~90% to ~10% over less than a threefold change in r, so FRET reads out donor–acceptor separations across the ~1–10 nm range of protein domains and nucleic-acid helices, and r=R0·((1−E)/E)^(1/6) inverts a fluorescence measurement into a distance. Reports E, the 90%/10% ruler bounds, the distance sensitivity |dE/dr|, and the dynamic range, plus the E-vs-r curve. Closed-form and deterministic.',
  references: [
    'Förster, T. (1948) Zwischenmolekulare Energiewanderung und Fluoreszenz. Ann. Phys. 437:55-75.',
    'Lakowicz, J.R. (2006) Principles of Fluorescence Spectroscopy, 3rd ed. Springer.',
  ],
  paramsSchema: paramsSchema as z.ZodType<FretParams>,
  run,
  example: paramsSchema.parse({ distance: 5, forsterRadius: 5 }),
  tags: ['structural', 'fret', 'forster', 'fluorescence', 'molecular-ruler', 'distance'],
};

export default spec;
