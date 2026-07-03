/**
 * Allometric scaling — Kleiber's law and the hidden arithmetic of body size.
 *
 * Across life, from a mouse to a whale, an animal's whole-body metabolic rate does not grow
 * in step with its mass but as a fractional POWER of it:
 *
 *     B = B₀ · M^b,      Kleiber's exponent b ≈ 3/4.
 *
 * On a log-log plot that is a straight line of slope b, spanning more than twenty doublings of
 * mass. The same exponent ripples through physiology: the metabolic rate PER kilogram falls as
 * M^(b−1), so bigger animals burn slower; heart rate scales the same way (M^(b−1)) while
 * lifespan stretches as M^(1−b) — and the two cancel, so total heartbeats per lifetime is
 * roughly the same (~a billion) for a shrew and an elephant alike. This engine reports the
 * metabolic rate, the mass-specific rate, the heart-rate and lifespan scalings relative to a
 * 1 kg animal, and that heartbeats-per-lifetime invariant, plus the metabolic-rate curve.
 *
 * Closed-form and deterministic; masses are bounded so the powers stay finite.
 *
 * References:
 *   - Kleiber, M. (1932) Body size and metabolism. Hilgardia 6:315-353.
 *   - West, G.B., Brown, J.H. & Enquist, B.J. (1997) A general model for the origin of
 *     allometric scaling laws in biology. Science 276:122-126.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Body mass M (kg). */
    bodyMass: z.number().min(1e-9).max(1e6).default(1),
    /** Scaling exponent b (Kleiber = 0.75). */
    scalingExponent: z.number().min(0.1).max(2).default(0.75),
    /** Metabolic rate B₀ of a 1 kg animal (W). */
    normalization: z.number().min(1e-6).max(1e6).default(3.4),
    /** Lowest mass plotted (kg). */
    massMin: z.number().min(1e-9).max(1e6).default(0.001),
    /** Highest mass plotted (kg). */
    massMax: z.number().min(1e-9).max(1e6).default(10000),
    /** Points in the plotted metabolic-rate curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type AllometricScalingParams = z.infer<typeof paramsSchema>;

/** Whole-body metabolic rate B = B₀·M^b. */
export function metabolicRate(b0: number, exponent: number, mass: number): number {
  return b0 * mass ** exponent;
}

export function run(rawParams: Partial<AllometricScalingParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { bodyMass: m, scalingExponent: b, normalization: b0 } = p;

  const rate = metabolicRate(b0, b, m);
  const massSpecific = rate / m; // W/kg = B₀·M^(b−1)
  const heartRateRel = m ** (b - 1); // relative to a 1 kg animal
  const lifespanRel = m ** (1 - b); // relative to a 1 kg animal
  const heartbeatsRel = heartRateRel * lifespanRel; // = M^0 = 1 (the invariant)

  const metrics: Metric[] = [
    {
      key: 'metabolicRate',
      label: 'Metabolic rate B',
      value: rate,
      unit: 'W',
      note: 'B₀·M^b (whole body)',
    },
    {
      key: 'massSpecificRate',
      label: 'Metabolic rate per kg',
      value: massSpecific,
      unit: 'W/kg',
      note: '∝ M^(b−1): bigger burns slower',
    },
    {
      key: 'heartRateRelative',
      label: 'Heart rate (vs 1 kg)',
      value: heartRateRel,
      note: '∝ M^(b−1)',
    },
    {
      key: 'lifespanRelative',
      label: 'Lifespan (vs 1 kg)',
      value: lifespanRel,
      note: '∝ M^(1−b): bigger lives longer',
    },
    {
      key: 'heartbeatsPerLifeRelative',
      label: 'Heartbeats per lifetime (vs 1 kg)',
      value: heartbeatsRel,
      note: 'M^0 ≈ 1 for all sizes',
    },
    { key: 'scalingExponent', label: 'Scaling exponent b', value: b },
  ];

  const n = p.outputPoints;
  const lo = Math.min(p.massMin, p.massMax);
  const hi = Math.max(p.massMin, p.massMax);
  const logLo = Math.log10(lo);
  const logHi = Math.log10(hi);
  const masses = Array.from(
    { length: n },
    (_, i) => 10 ** (logLo + ((logHi - logLo) * i) / (n - 1)),
  );
  const series: Series[] = [
    {
      x: masses,
      y: { metabolicRate: masses.map((mm) => metabolicRate(b0, b, mm)) },
      xLabel: 'body mass (kg)',
      yLabel: 'metabolic rate (W)',
    },
  ];

  return {
    engine: 'allometric-scaling',
    summary: `Allometric scaling (b=${b}): a ${m} kg animal burns ${rate.toPrecision(4)} W (${massSpecific.toPrecision(4)} W/kg); vs a 1 kg animal its heart runs ${heartRateRel.toPrecision(3)}× as fast and it lives ${lifespanRel.toPrecision(3)}× as long — so ${heartbeatsRel.toPrecision(3)}× the heartbeats per lifetime.`,
    metrics,
    series,
    detail: { metabolicRate: rate, massSpecificRate: massSpecific, lifespanRelative: lifespanRel },
    provenance: provenance('allometric-scaling', '1.0.0', p),
  };
}

export const spec: EngineSpec<AllometricScalingParams> = {
  slug: 'allometric-scaling',
  title: "Allometric Scaling (Kleiber's Law)",
  domain: 'ecology',
  version: '1.0.0',
  description:
    "How body size sets the pace of life. An animal's whole-body metabolic rate scales as a power of its mass, B=B₀·M^b, with Kleiber's exponent b≈3/4 — a straight line of slope b on a log-log plot across the whole tree of life. The metabolic rate PER kilogram falls as M^(b−1) (bigger animals burn slower), heart rate scales the same way, and lifespan stretches as M^(1−b), so heartbeats per lifetime are nearly constant (~a billion) from a shrew to an elephant. Reports the metabolic rate, the mass-specific rate, the heart-rate and lifespan scalings relative to a 1 kg animal, and the heartbeats-per-lifetime invariant, plus the metabolic-rate-vs-mass curve. Closed-form and deterministic.",
  references: [
    'Kleiber, M. (1932) Body size and metabolism. Hilgardia 6:315-353.',
    'West, G.B., Brown, J.H. & Enquist, B.J. (1997) A general model for the origin of allometric scaling laws in biology. Science 276:122-126.',
  ],
  paramsSchema: paramsSchema as z.ZodType<AllometricScalingParams>,
  run,
  example: paramsSchema.parse({ bodyMass: 1, scalingExponent: 0.75, normalization: 3.4 }),
  tags: ['ecology', 'allometry', 'kleiber', 'metabolism', 'scaling', 'body-size'],
};

export default spec;
