/**
 * Worm-like chain (WLC) — the force–extension curve of a stretched polymer.
 *
 * A semi-flexible polymer like double-stranded DNA behaves as an entropic spring:
 * left alone it coils up (more configurations = higher entropy); pull on it and you
 * fight that entropy. The Marko–Siggia (1995) interpolation gives the force f needed
 * to hold a fractional extension x = z/L (z the end-to-end distance, L the contour
 * length):
 *
 *     f·Lp / (k_B·T) = x + 1/(4(1−x)²) − 1/4,
 *
 * with Lp the persistence length (~50 nm for dsDNA). At LOW force this is Hookean,
 * f ≈ (3·k_B·T)/(2·Lp·L)·z, an entropic spring of stiffness 3k_BT/(2·Lp·L); near full
 * extension the 1/(1−x)² term makes the force diverge — the molecule stiffens sharply.
 * This is exactly the curve measured by optical/magnetic tweezers.
 *
 * Deterministic and analytic: the force is closed-form in the fractional extension;
 * the schema caps x below 1 so the (1−x)² term never blows up.
 *
 * References:
 *   - Marko, J.F. & Siggia, E.D. (1995) Stretching DNA. Macromolecules 28:8759-8770.
 *   - Bustamante, C., Marko, J.F., Siggia, E.D. & Smith, S. (1994) Entropic elasticity
 *     of λ-phage DNA. Science 265:1599-1600.
 */

import { z } from 'zod';
import { downsampleIndices } from '../core/series';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

/** Boltzmann constant in pN·nm/K. */
const KB = 0.0138064852;
const KELVIN = 273.15;

export const paramsSchema = z
  .object({
    /** Persistence length Lp (nm) — ~50 nm for dsDNA. */
    persistenceLength: z.number().min(1e-9).max(100_000).default(50),
    /** Contour length L (nm) — full stretched length. */
    contourLength: z.number().min(1e-9).max(10_000_000).default(1000),
    /** Temperature (°C). */
    temperatureCelsius: z.number().min(-50).max(150).default(25),
    /** Highest fractional extension x = z/L to plot (must stay below 1). */
    maxFraction: z.number().min(0.05).max(0.99).default(0.95),
    /** Points in the plotted force–extension curve. */
    outputPoints: z.number().int().min(2).max(4000).default(200),
  })
  .strict();

export type WormLikeChainParams = z.infer<typeof paramsSchema>;

/** Marko–Siggia force (pN) at fractional extension x = z/L, given Lp and k_B·T. */
export function wlcForce(fraction: number, persistenceLength: number, kBT: number): number {
  const x = fraction;
  return (kBT / persistenceLength) * (x + 1 / (4 * (1 - x) ** 2) - 1 / 4);
}

export function run(rawParams: Partial<WormLikeChainParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const kBT = KB * (p.temperatureCelsius + KELVIN); // pN·nm
  const Lp = p.persistenceLength;
  const L = p.contourLength;

  const force = (fraction: number) => wlcForce(fraction, Lp, kBT);
  // Low-force entropic spring constant k = 3·k_B·T / (2·Lp·L) (pN/nm).
  const entropicStiffness = (3 * kBT) / (2 * Lp * L);

  const metrics: Metric[] = [
    { key: 'thermalEnergy', label: 'Thermal energy k_B·T', value: kBT, unit: 'pN·nm' },
    {
      key: 'entropicStiffness',
      label: 'Low-force spring constant',
      value: entropicStiffness,
      unit: 'pN/nm',
      note: '3k_BT/(2·Lp·L)',
    },
    {
      key: 'forceAtHalfExtension',
      label: 'Force at 50% extension',
      value: force(0.5),
      unit: 'pN',
    },
    {
      key: 'forceAtMaxExtension',
      label: `Force at ${(100 * p.maxFraction).toFixed(0)}% extension`,
      value: force(p.maxFraction),
      unit: 'pN',
    },
    { key: 'persistenceLength', label: 'Persistence length Lp', value: Lp, unit: 'nm' },
    { key: 'contourLength', label: 'Contour length L', value: L, unit: 'nm' },
  ];

  const n = p.outputPoints;
  const fractions = Array.from({ length: n }, (_, i) => (p.maxFraction * i) / (n - 1));
  const idx = downsampleIndices(n, 2000);
  const series: Series[] = [
    {
      x: idx.map((k) => (fractions[k] ?? 0) * L),
      y: { force: idx.map((k) => force(fractions[k] ?? 0)) },
      xLabel: 'extension z (nm)',
      yLabel: 'force (pN)',
    },
  ];

  return {
    engine: 'worm-like-chain',
    summary: `Worm-like chain (Lp=${Lp} nm, L=${L} nm): entropic spring of ${entropicStiffness.toExponential(2)} pN/nm at low force, stiffening to ${force(p.maxFraction).toFixed(1)} pN at ${(100 * p.maxFraction).toFixed(0)}% extension.`,
    metrics,
    series,
    detail: {
      thermalEnergy: kBT,
      entropicStiffness,
      forceAtHalfExtension: force(0.5),
      forceAtMaxExtension: force(p.maxFraction),
    },
    provenance: provenance('worm-like-chain', '1.0.0', p),
  };
}

export const spec: EngineSpec<WormLikeChainParams> = {
  slug: 'worm-like-chain',
  title: 'Worm-Like Chain (DNA force–extension)',
  domain: 'structural',
  version: '1.0.0',
  description:
    'The Marko–Siggia worm-like-chain model of polymer elasticity — the force–extension curve of a stretched semi-flexible chain such as dsDNA. Force to hold fractional extension x=z/L is f·Lp/(k_BT)=x+1/(4(1−x)²)−1/4, with persistence length Lp. Reports the thermal energy, the low-force entropic spring constant 3k_BT/(2·Lp·L), and the force at 50% and near-full extension where the chain stiffens sharply. The curve measured in every optical/magnetic-tweezers single-molecule experiment. Closed-form and deterministic; extension is capped below 1 so the force stays finite.',
  references: [
    'Marko, J.F. & Siggia, E.D. (1995) Stretching DNA. Macromolecules 28:8759-8770.',
    'Bustamante, C., Marko, J.F., Siggia, E.D. & Smith, S. (1994) Entropic elasticity of λ-phage DNA. Science 265:1599-1600.',
  ],
  paramsSchema: paramsSchema as z.ZodType<WormLikeChainParams>,
  run,
  example: paramsSchema.parse({
    persistenceLength: 50,
    contourLength: 1000,
    temperatureCelsius: 25,
  }),
  tags: [
    'structural',
    'dna',
    'polymer',
    'single-molecule',
    'force-extension',
    'entropic-elasticity',
  ],
};

export default spec;
