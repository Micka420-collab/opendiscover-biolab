/**
 * Passive cable equation — how far an electrical signal spreads down a dendrite or axon before
 * it fades, and why long neurons cannot rely on passive spread alone.
 *
 * Treat a slender neural process as a leaky cable. A steady voltage injected at one point does
 * not travel undiminished: current leaks out through the membrane as it flows along, so the
 * voltage decays exponentially with distance,
 *
 *     V(x) = V₀ · e^(−x/λ),      length constant  λ = √( d · R_m / (4 · R_i) ),
 *
 * where d is the fibre diameter, R_m the specific membrane resistance (how well the membrane
 * holds charge in) and R_i the axial resistivity (how much the cytoplasm resists lengthwise
 * flow). The length constant λ is the distance over which the signal falls to 1/e (≈37%) of its
 * start. Fatter, better-insulated fibres have a longer λ and carry a passive signal further —
 * but because the decay is exponential, even a big λ cannot move a signal across a whole neuron,
 * which is exactly why axons fire regenerating action potentials and why myelin exists.
 *
 * This engine reports the length constant, the surviving voltage fraction at a chosen distance,
 * the half-decay distance (λ·ln2) and the effective reach (the distance to fall to 1%), plus
 * the voltage-vs-distance decay curve. Diameter is entered in µm and converted to cm internally.
 *
 * Closed-form and deterministic; every parameter is strictly positive so λ and the decay stay
 * finite.
 *
 * References:
 *   - Rall, W. (1959) Branching dendritic trees and motoneuron membrane resistivity. Exp.
 *     Neurol. 1:491-527.
 *   - Dayan, P. & Abbott, L.F. (2001) Theoretical Neuroscience, ch. 6 (cable theory).
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Fibre diameter d (µm). */
    diameter: z.number().min(0.1).max(1000).default(2),
    /** Specific membrane resistance R_m (Ω·cm²) — higher = better insulated. */
    membraneResistance: z.number().min(1).max(1e6).default(10000),
    /** Axial resistivity R_i (Ω·cm) — higher = cytoplasm resists lengthwise flow more. */
    axialResistivity: z.number().min(1).max(1e5).default(100),
    /** Distance from the injection site to report the surviving voltage at (µm). */
    distance: z.number().min(0).max(1e7).default(500),
    /** Upper distance for the plotted decay curve (µm). */
    distanceMax: z.number().min(1e-3).max(1e7).default(3000),
    /** Points in the plotted decay curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type CableParams = z.infer<typeof paramsSchema>;

/** Length constant λ in µm: √(d·R_m/(4·R_i)), with d converted from µm to cm. */
export function lengthConstant(
  diameterUm: number,
  membraneResistance: number,
  axialResistivity: number,
): number {
  const dCm = diameterUm * 1e-4;
  const lambdaCm = Math.sqrt((dCm * membraneResistance) / (4 * axialResistivity));
  return lambdaCm * 1e4; // cm → µm
}

export function run(rawParams: Partial<CableParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);

  const lambda = lengthConstant(p.diameter, p.membraneResistance, p.axialResistivity); // µm
  const fractionAtDistance = Math.exp(-p.distance / lambda);
  const halfDecayDistance = lambda * Math.LN2; // distance to fall to 50%
  const effectiveReach = lambda * Math.log(100); // distance to fall to 1% (≈ practical limit)

  const metrics: Metric[] = [
    {
      key: 'lengthConstant',
      label: 'Length constant λ',
      value: lambda,
      unit: 'µm',
      note: '√(d·R_m/(4·R_i)) — distance to fall to 37% (1/e)',
    },
    {
      key: 'voltageFractionAtDistance',
      label: `Voltage remaining at ${p.distance} µm`,
      value: fractionAtDistance,
      note: 'e^(−x/λ) — fraction of the injected voltage still present',
    },
    {
      key: 'halfDecayDistance',
      label: 'Half-decay distance',
      value: halfDecayDistance,
      unit: 'µm',
      note: 'λ·ln2 — distance over which the signal halves',
    },
    {
      key: 'effectiveReach',
      label: 'Effective reach (to 1%)',
      value: effectiveReach,
      unit: 'µm',
      note: 'λ·ln100 — beyond here the passive signal is essentially gone',
    },
  ];

  const n = p.outputPoints;
  const xs = Array.from({ length: n }, (_, i) => (p.distanceMax * i) / (n - 1));
  const voltage = xs.map((x) => Math.exp(-x / lambda));
  const series: Series[] = [
    {
      x: xs,
      y: { voltage },
      xLabel: 'distance (µm)',
      yLabel: 'voltage fraction V/V₀',
    },
  ];

  return {
    engine: 'cable-length-constant',
    summary: `Passive cable: λ=${lambda.toPrecision(3)} µm for a ${p.diameter} µm fibre. Voltage falls to ${(fractionAtDistance * 100).toPrecision(3)}% by ${p.distance} µm, halves every ${halfDecayDistance.toPrecision(3)} µm, and is essentially gone (1%) beyond ${effectiveReach.toPrecision(3)} µm.`,
    metrics,
    series,
    detail: { lengthConstant: lambda, fractionAtDistance, halfDecayDistance, effectiveReach },
    provenance: provenance('cable-length-constant', '1.0.0', p),
  };
}

export const spec: EngineSpec<CableParams> = {
  slug: 'cable-length-constant',
  title: 'Neural Cable (Length Constant)',
  domain: 'neuroscience',
  version: '1.0.0',
  description:
    'How far a steady electrical signal spreads down a passive neural fibre before it fades. Treating a dendrite or axon as a leaky cable, an injected voltage decays exponentially V(x)=V₀·e^(−x/λ) with length constant λ=√(d·R_m/(4·R_i)): fatter, better-insulated fibres (larger diameter d or membrane resistance R_m, smaller axial resistivity R_i) carry the signal further. Reports the length constant, the voltage fraction surviving at a chosen distance, the half-decay distance (λ·ln2) and the effective reach (distance to 1%), plus the voltage-vs-distance decay curve. Shows why long neurons need active, regenerating action potentials and myelin rather than passive spread. Diameter in µm, converted internally. Closed-form and deterministic.',
  references: [
    'Rall, W. (1959) Branching dendritic trees and motoneuron membrane resistivity. Exp. Neurol. 1:491-527.',
    'Dayan, P. & Abbott, L.F. (2001) Theoretical Neuroscience, ch. 6.',
  ],
  paramsSchema: paramsSchema as z.ZodType<CableParams>,
  run,
  example: paramsSchema.parse({
    diameter: 2,
    membraneResistance: 10000,
    axialResistivity: 100,
    distance: 500,
  }),
  tags: ['neuroscience', 'cable', 'dendrite', 'axon', 'length-constant', 'passive', 'rall'],
};

export default spec;
