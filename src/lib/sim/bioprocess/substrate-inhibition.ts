/**
 * Haldane substrate-inhibition kinetics — when more food is worse.
 *
 * Monod growth saturates: µ(S) = µmax·S/(Ks+S) climbs and plateaus. But many real
 * substrates (phenol, methanol, ammonia, many pollutants) become TOXIC at high
 * concentration, so the specific growth rate rises, peaks, then falls. The Haldane /
 * Andrews model captures this with one extra self-inhibition term:
 *
 *     µ(S) = µmax·S / (Ks + S + S²/Ki).
 *
 * Setting dµ/dS = 0 gives the whole design in closed form: the growth rate peaks at the
 * geometric-mean substrate concentration
 *
 *     S_opt = √(Ks·Ki),      µ_opt = µmax / (1 + 2·√(Ks/Ki)),
 *
 * and µ = ½·µ_opt at two substrate levels S_low < S_opt < S_high whose product is exactly
 * S_low·S_high = Ks·Ki (the useful operating window). As Ki → ∞ the inhibition term
 * vanishes and the model collapses back to plain Monod.
 *
 * Everything here is closed-form (the half-µ levels are the two roots of a quadratic,
 * computed cancellation-free) and deterministic.
 *
 * References:
 *   - Andrews, J.F. (1968) A mathematical model for the continuous culture of
 *     microorganisms utilizing inhibitory substrates. Biotechnol. Bioeng. 10:707-723.
 *   - Haldane, J.B.S. (1930) Enzymes. Longmans, Green & Co.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Maximum specific growth rate µmax (1/h) — the Monod ceiling. */
    muMax: z.number().positive().max(1e3).default(0.8),
    /** Half-saturation constant Ks (g/L): substrate for half of µmax without inhibition. */
    ks: z.number().positive().max(1e6).default(1),
    /** Inhibition constant Ki (g/L): larger = weaker self-inhibition (Ki→∞ is Monod). */
    ki: z.number().positive().max(1e9).default(100),
    /** Highest substrate concentration plotted (g/L). */
    substrateMax: z.number().positive().max(1e9).default(200),
    /** Points in the plotted µ-vs-S curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type SubstrateInhibitionParams = z.infer<typeof paramsSchema>;

/** Haldane specific growth rate µ(S) = µmax·S/(Ks+S+S²/Ki). */
export function growthRate(s: number, muMax: number, ks: number, ki: number): number {
  if (s <= 0) return 0;
  return (muMax * s) / (ks + s + (s * s) / ki);
}

/** Monod reference µ(S) = µmax·S/(Ks+S) — the no-inhibition curve. */
export function monodRate(s: number, muMax: number, ks: number): number {
  if (s <= 0) return 0;
  return (muMax * s) / (ks + s);
}

export interface HalfMuLevels {
  low: number;
  high: number;
}

/**
 * The two substrate concentrations where µ = ½·µ_opt, as the roots of the quadratic
 * (c/Ki)·S² + (c−1)·S + c·Ks = 0 with c = µ_opt/(2·µmax). Solved cancellation-free via
 * the stable form (q = ½(|b|+√Δ); roots q/a and c0/q); their product is Ks·Ki. `high`
 * is +∞ in the Monod limit (Ki→∞), where µ never falls back to ½·µ_opt.
 */
export function halfMuLevels(muMax: number, muOpt: number, ks: number, ki: number): HalfMuLevels {
  const c = muOpt / (2 * muMax);
  const a = c / ki;
  const b = c - 1; // < 0 since c < ½
  const c0 = c * ks;
  const disc = Math.sqrt(Math.max(b * b - 4 * a * c0, 0));
  const q = 0.5 * (disc - b); // −b = |b| > 0, so q > 0 with no cancellation
  const root1 = q / a; // large root
  const root2 = c0 / q; // small root
  return { low: Math.min(root1, root2), high: Math.max(root1, root2) };
}

export function run(rawParams: Partial<SubstrateInhibitionParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { muMax, ks, ki } = p;

  const sOpt = Math.sqrt(ks * ki);
  const muOpt = muMax / (1 + 2 * Math.sqrt(ks / ki));
  const peakEfficiency = muOpt / muMax; // fraction of the Monod ceiling actually reachable
  const { low: windowLow, high: windowHigh } = halfMuLevels(muMax, muOpt, ks, ki);

  const metrics: Metric[] = [
    {
      key: 'optimalSubstrate',
      label: 'Optimal substrate S_opt',
      value: sOpt,
      unit: 'g/L',
      note: '√(Ks·Ki): where growth peaks',
    },
    {
      key: 'maxGrowthRate',
      label: 'Peak growth rate µ_opt',
      value: muOpt,
      unit: '1/h',
      note: 'µmax/(1+2√(Ks/Ki))',
    },
    { key: 'muMax', label: 'Monod ceiling µmax', value: muMax, unit: '1/h' },
    {
      key: 'peakEfficiency',
      label: 'Peak efficiency µ_opt/µmax',
      value: peakEfficiency,
      note: 'fraction of the Monod ceiling inhibition still allows',
    },
    {
      key: 'windowLow',
      label: 'Operating window (low)',
      value: windowLow,
      unit: 'g/L',
      note: 'lower substrate at half of peak growth',
    },
    {
      key: 'windowHigh',
      label: 'Operating window (high)',
      value: windowHigh,
      unit: 'g/L',
      note: Number.isFinite(windowHigh)
        ? 'upper substrate at half of peak growth'
        : 'no upper limit (weak inhibition)',
    },
    { key: 'ki', label: 'Inhibition constant Ki', value: ki, unit: 'g/L' },
  ];

  const n = p.outputPoints;
  const substrate = Array.from({ length: n }, (_, i) => (p.substrateMax * i) / (n - 1));
  const series: Series[] = [
    {
      x: substrate,
      y: {
        growthRate: substrate.map((s) => growthRate(s, muMax, ks, ki)),
        monodReference: substrate.map((s) => monodRate(s, muMax, ks)),
      },
      xLabel: 'substrate S (g/L)',
      yLabel: 'specific growth rate µ (1/h)',
    },
  ];

  return {
    engine: 'substrate-inhibition',
    summary: `Haldane substrate inhibition: growth peaks at S_opt=${sOpt.toFixed(2)} g/L with µ_opt=${muOpt.toFixed(3)} 1/h (${(100 * peakEfficiency).toFixed(0)}% of the µmax ceiling); half-peak window ${windowLow.toFixed(2)}–${Number.isFinite(windowHigh) ? `${windowHigh.toFixed(2)} g/L` : '∞ (weak inhibition)'}.`,
    metrics,
    series,
    detail: { optimalSubstrate: sOpt, maxGrowthRate: muOpt, peakEfficiency, windowLow, windowHigh },
    provenance: provenance('substrate-inhibition', '1.0.0', p),
  };
}

export const spec: EngineSpec<SubstrateInhibitionParams> = {
  slug: 'substrate-inhibition',
  title: 'Haldane Substrate-Inhibition Kinetics',
  domain: 'bioprocess',
  version: '1.0.0',
  description:
    'Microbial growth on an inhibitory substrate (Haldane/Andrews model): µ(S)=µmax·S/(Ks+S+S²/Ki) rises, peaks, then FALLS as the substrate itself turns toxic — unlike monotone Monod. Reports the closed-form optimum S_opt=√(Ks·Ki), the achievable peak µ_opt=µmax/(1+2√(Ks/Ki)), the peak efficiency µ_opt/µmax, and the half-peak operating window (the two substrate levels whose product is Ks·Ki). Plots the µ-vs-S curve against a Monod reference so the inhibition down-turn is visible. Ki→∞ recovers Monod. Closed-form and deterministic.',
  references: [
    'Andrews, J.F. (1968) A mathematical model for the continuous culture of microorganisms utilizing inhibitory substrates. Biotechnol. Bioeng. 10:707-723.',
    'Haldane, J.B.S. (1930) Enzymes. Longmans, Green & Co.',
  ],
  paramsSchema: paramsSchema as z.ZodType<SubstrateInhibitionParams>,
  run,
  example: paramsSchema.parse({ muMax: 0.8, ks: 1, ki: 100 }),
  tags: ['bioprocess', 'haldane', 'substrate-inhibition', 'kinetics', 'growth-rate', 'monod'],
};

export default spec;
