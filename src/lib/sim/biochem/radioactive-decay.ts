/**
 * First-order (exponential) decay & half-life — the clock behind carbon dating, drug
 * clearance, and biomolecule turnover.
 *
 * Anything that disappears at a rate proportional to how much is left follows the same
 * exponential law: a radioactive isotope, a drug being cleared, an mRNA or protein being
 * degraded. The amount remaining is
 *
 *     N(t) = N₀·e^(−λ·t) = N₀·(1/2)^(t/t½),
 *
 * where the decay constant λ = ln2/t½ and the half-life t½ is the time for half to vanish.
 * Because each half-life halves what remains, the fraction left tells you the elapsed time —
 * measure the leftover carbon-14 in a bone and you read off its age (t = −ln(fraction)/λ).
 * Reports the decay constant, mean lifetime 1/λ, the fraction and amount remaining at a
 * chosen time, and the time to fall to 10%, plus the decay curve.
 *
 * Closed-form and deterministic; every field is bounded so the exponent stays finite and
 * the fraction never leaves (0,1].
 *
 * References:
 *   - Rutherford, E. & Soddy, F. (1902) The cause and nature of radioactivity. Phil. Mag.
 *     4:370-396.
 *   - Libby, W.F. (1955) Radiocarbon Dating, 2nd ed. Univ. of Chicago Press.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Half-life t½ — the time for half the amount to decay (any consistent time unit). */
    halfLife: z.number().min(1e-6).max(1e12).default(5730),
    /** Elapsed time t at which to report (same unit as the half-life). */
    time: z.number().min(0).max(1e15).default(5730),
    /** Initial amount N₀ (atoms, molecules, or activity units). */
    initialAmount: z.number().min(1e-9).max(1e15).default(100),
    /** Highest time plotted. */
    tMax: z.number().min(1e-6).max(1e15).default(20000),
    /** Points in the plotted decay curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type RadioactiveDecayParams = z.infer<typeof paramsSchema>;

/** Fraction remaining after time t for half-life t½: (1/2)^(t/t½). */
export function fractionRemaining(halfLife: number, time: number): number {
  return 2 ** (-time / halfLife);
}

export function run(rawParams: Partial<RadioactiveDecayParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);

  const decayConstant = Math.LN2 / p.halfLife; // λ
  const meanLifetime = 1 / decayConstant; // 1/λ = t½/ln2
  const fraction = fractionRemaining(p.halfLife, p.time);
  const remainingAmount = p.initialAmount * fraction;
  // Time to fall to 10% remaining: t = t½·log2(10).
  const timeTo10Pct = p.halfLife * Math.log2(10);
  const halfLivesElapsed = p.time / p.halfLife;

  const metrics: Metric[] = [
    { key: 'halfLife', label: 'Half-life t½', value: p.halfLife, note: 'time to halve' },
    {
      key: 'decayConstant',
      label: 'Decay constant λ',
      value: decayConstant,
      note: 'ln2 / t½ (per unit time)',
    },
    {
      key: 'meanLifetime',
      label: 'Mean lifetime 1/λ',
      value: meanLifetime,
      note: 't½ / ln2',
    },
    {
      key: 'fractionRemaining',
      label: `Fraction remaining at t=${p.time}`,
      value: fraction,
      note: '(1/2)^(t/t½)',
    },
    {
      key: 'remainingAmount',
      label: 'Amount remaining',
      value: remainingAmount,
      note: 'N₀ · fraction',
    },
    {
      key: 'halfLivesElapsed',
      label: 'Half-lives elapsed',
      value: halfLivesElapsed,
      note: 't / t½',
    },
    { key: 'timeTo10Pct', label: 'Time to 10% remaining', value: timeTo10Pct },
  ];

  const n = p.outputPoints;
  const times = Array.from({ length: n }, (_, i) => (p.tMax * i) / (n - 1));
  const series: Series[] = [
    {
      x: times,
      y: { remaining: times.map((t) => p.initialAmount * fractionRemaining(p.halfLife, t)) },
      xLabel: 'time',
      yLabel: 'amount remaining',
    },
  ];

  return {
    engine: 'radioactive-decay',
    summary: `First-order decay: t½=${p.halfLife} → after t=${p.time} (${halfLivesElapsed.toFixed(2)} half-lives) ${(100 * fraction).toFixed(1)}% remains (${remainingAmount.toPrecision(4)} of ${p.initialAmount}); mean lifetime ${meanLifetime.toPrecision(4)}.`,
    metrics,
    series,
    detail: { decayConstant, fractionRemaining: fraction, remainingAmount, halfLivesElapsed },
    provenance: provenance('radioactive-decay', '1.0.0', p),
  };
}

export const spec: EngineSpec<RadioactiveDecayParams> = {
  slug: 'radioactive-decay',
  title: 'First-Order Decay & Half-Life (carbon dating)',
  domain: 'biochemistry',
  version: '1.0.0',
  description:
    'Exponential first-order decay N(t)=N₀·e^(−λt)=N₀·(1/2)^(t/t½): the universal law for anything that vanishes in proportion to how much remains — a radioactive isotope, a drug being cleared, an mRNA or protein turned over. The decay constant is λ=ln2/t½ and each half-life t½ halves what is left, so the leftover fraction reads out elapsed time (radiocarbon dating: age = −ln(fraction)/λ). Reports the decay constant, the mean lifetime 1/λ, the fraction and amount remaining at a chosen time, the number of half-lives elapsed, and the time to fall to 10%, plus the decay curve. Closed-form and deterministic; the fraction never leaves (0,1].',
  references: [
    'Rutherford, E. & Soddy, F. (1902) The cause and nature of radioactivity. Phil. Mag. 4:370-396.',
    'Libby, W.F. (1955) Radiocarbon Dating, 2nd ed. University of Chicago Press.',
  ],
  paramsSchema: paramsSchema as z.ZodType<RadioactiveDecayParams>,
  run,
  example: paramsSchema.parse({ halfLife: 5730, time: 5730, initialAmount: 100 }),
  tags: ['biochemistry', 'decay', 'half-life', 'carbon-dating', 'kinetics', 'turnover'],
};

export default spec;
