/**
 * PCR amplification — how a polymerase chain reaction turns a handful of DNA copies into
 * billions, and why efficiency and the plateau matter.
 *
 * Each PCR cycle copies every template that takes part, so the amount of DNA multiplies by
 * (1 + E) per cycle, where E is the amplification efficiency (E = 1 is a perfect doubling; real
 * reactions manage ~0.7–0.95). After c cycles the copy number is N₀·(1+E)^c — exponential
 * growth — until the reaction runs low on primers, nucleotides or polymerase and levels off at a
 * plateau. This engine models that as
 *
 *     N(c) = min( N₀·(1+E)^c , N_plateau ).
 *
 * It reports the final copy number, the fold amplification, the ideal (plateau-free) fold, and
 * the effective number of doublings actually achieved, plus the copies-versus-cycle curve — the
 * exponential rise into a flat plateau you see on every qPCR trace. It explains why a few extra
 * cycles multiply the product enormously, why a small drop in efficiency costs a lot of yield,
 * and why every reaction eventually stops amplifying.
 *
 * Closed-form and deterministic; efficiency and cycle counts are bounded so (1+E)^c and every
 * derived value stay finite.
 *
 * References:
 *   - Mullis, K.B. et al. (1986) Cold Spring Harb. Symp. Quant. Biol. 51:263-273.
 *   - Kubista, M. et al. (2006) The real-time polymerase chain reaction. Mol. Aspects Med. 27:95.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Starting number of template copies, N₀. */
    initialCopies: z.number().min(1).max(1e12).default(1000),
    /** Amplification efficiency E per cycle (0 = no amplification, 1 = perfect doubling). */
    efficiency: z.number().min(0).max(1).default(0.9),
    /** Number of thermal cycles. */
    cycles: z.number().int().min(1).max(60).default(30),
    /** Plateau — the copy number at which the reaction runs out of reagents and levels off. */
    plateau: z.number().min(1).max(1e15).default(1e12),
  })
  .strict();

export type PcrAmplificationParams = z.infer<typeof paramsSchema>;

/** Copies after `cycle` cycles: min(N₀·(1+E)^cycle, plateau). */
export function pcrCopies(
  initialCopies: number,
  efficiency: number,
  cycle: number,
  plateau: number,
): number {
  return Math.min(initialCopies * (1 + efficiency) ** cycle, plateau);
}

export function run(rawParams: Partial<PcrAmplificationParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { initialCopies: n0, efficiency: e, cycles: c, plateau } = p;

  const finalCopies = pcrCopies(n0, e, c, plateau);
  const foldAmplification = finalCopies / n0;
  const theoreticalFold = (1 + e) ** c; // ignoring the plateau
  const effectiveDoublings = Math.log2(foldAmplification);

  const metrics: Metric[] = [
    {
      key: 'finalCopies',
      label: `Copies after ${c} cycles`,
      value: finalCopies,
      note: 'min(N₀·(1+E)^cycles, plateau)',
    },
    {
      key: 'foldAmplification',
      label: 'Fold amplification',
      value: foldAmplification,
      note: 'final copies ÷ starting copies',
    },
    {
      key: 'theoreticalFold',
      label: 'Ideal fold (no plateau)',
      value: theoreticalFold,
      note: '(1+E)^cycles — what perfect reagents would give',
    },
    {
      key: 'effectiveDoublings',
      label: 'Effective doublings',
      value: effectiveDoublings,
      note: 'log₂ of the fold amplification; a perfect cycle = 1 doubling',
    },
  ];

  const cycleAxis = Array.from({ length: c + 1 }, (_, i) => i);
  const copies = cycleAxis.map((i) => pcrCopies(n0, e, i, plateau));
  const series: Series[] = [
    {
      x: cycleAxis,
      y: { copies },
      xLabel: 'cycle',
      yLabel: 'copies',
    },
  ];

  return {
    engine: 'pcr-amplification',
    summary: `PCR: ${n0} copies × (1+${e})^${c} → ${finalCopies.toPrecision(3)} copies (${foldAmplification.toPrecision(3)}-fold, ${effectiveDoublings.toPrecision(3)} effective doublings). Ideal fold would be ${theoreticalFold.toPrecision(3)}${finalCopies >= plateau ? '; the reaction hit its plateau' : ''}.`,
    metrics,
    series,
    detail: { finalCopies, foldAmplification, theoreticalFold, effectiveDoublings },
    provenance: provenance('pcr-amplification', '1.0.0', p),
  };
}

export const spec: EngineSpec<PcrAmplificationParams> = {
  slug: 'pcr-amplification',
  title: 'PCR Amplification',
  domain: 'molecular-biology',
  version: '1.0.0',
  description:
    'How a polymerase chain reaction amplifies DNA: each cycle multiplies the amount by (1+E) for efficiency E, so after c cycles the copy number is N₀·(1+E)^c — exponential growth — until it levels off at a plateau when reagents run low, N(c)=min(N₀·(1+E)^c, plateau). Reports the final copy number, the fold amplification, the ideal (plateau-free) fold, and the effective number of doublings, plus the copies-versus-cycle curve. Explains why a few extra cycles multiply the product enormously, why a small drop in efficiency costs a lot of yield, and why every reaction eventually stops amplifying. Closed-form and deterministic; bounded so every value stays finite.',
  references: [
    'Mullis, K.B. et al. (1986) Cold Spring Harb. Symp. Quant. Biol. 51:263-273.',
    'Kubista, M. et al. (2006) The real-time polymerase chain reaction. Mol. Aspects Med. 27:95-125.',
  ],
  paramsSchema: paramsSchema as z.ZodType<PcrAmplificationParams>,
  run,
  example: paramsSchema.parse({ initialCopies: 1000, efficiency: 0.9, cycles: 30, plateau: 1e12 }),
  tags: ['molecular-biology', 'pcr', 'amplification', 'dna', 'exponential', 'qpcr'],
};

export default spec;
