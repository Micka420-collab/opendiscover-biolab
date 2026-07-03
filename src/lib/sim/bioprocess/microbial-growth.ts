/**
 * Microbial growth curve — logistic (Verhulst) growth to a carrying capacity.
 *
 * A population growing with a fixed per-capita rate would explode exponentially, but real
 * cultures run out of room and nutrients, so growth slows as they fill up. The logistic
 * model captures this with dP/dt = r·P·(1 − P/K): growth rate r when the population P is
 * small, tapering to zero as P approaches the carrying capacity K. The closed-form solution
 * is the classic S-shaped curve
 *
 *     P(t) = K / (1 + A·e^(−r·t)),   A = (K − P₀)/P₀,
 *
 * with an exponential-looking early phase, a steepest point (inflection) at P = K/2, and a
 * stationary plateau at K. Reports the carrying capacity, the early doubling time ln2/r, the
 * inflection time, the time to reach 90% of capacity, the maximum absolute growth rate r·K/4,
 * and the final population, plus the growth curve.
 *
 * Closed-form and deterministic; every field is bounded and the log-based times are guarded
 * so no output can be non-finite even when the seed already exceeds the capacity.
 *
 * References:
 *   - Verhulst, P.-F. (1838) Notice sur la loi que la population suit dans son accroissement.
 *     Corresp. Math. Phys. 10:113-121.
 *   - Zwietering, M.H. et al. (1990) Modeling of the bacterial growth curve. Appl. Environ.
 *     Microbiol. 56:1875-1881.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Carrying capacity K (e.g. OD600 or cells/mL). */
    carryingCapacity: z.number().min(1e-6).max(1e6).default(2),
    /** Maximum per-capita growth rate r (1/h). */
    growthRate: z.number().min(1e-6).max(100).default(0.4),
    /** Initial population P₀ (same units as K). */
    initialPop: z.number().min(1e-9).max(1e6).default(0.01),
    /** Simulated duration (h). */
    tEnd: z.number().min(1e-6).max(1e6).default(48),
    /** Points in the plotted growth curve. */
    outputPoints: z.number().int().min(4).max(4000).default(200),
  })
  .strict();

export type MicrobialGrowthParams = z.infer<typeof paramsSchema>;

/** Logistic population P(t) = K/(1 + A·e^(−r·t)), A = (K−P₀)/P₀. */
export function logisticPop(k: number, r: number, p0: number, t: number): number {
  const a = (k - p0) / p0;
  return k / (1 + a * Math.exp(-r * t));
}

export function run(rawParams: Partial<MicrobialGrowthParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const { carryingCapacity: k, growthRate: r, initialPop: p0 } = p;
  const a = (k - p0) / p0;

  const safeLn = (x: number) => (x > 0 ? Math.log(x) : 0);
  const doublingTime = Math.LN2 / r; // early exponential doubling
  const inflectionTime = Math.max(0, a > 0 ? safeLn(a) / r : 0); // P = K/2
  const timeTo90 = Math.max(0, a > 0 ? safeLn(9 * a) / r : 0); // P = 0.9K
  const maxAbsGrowthRate = (r * k) / 4; // steepest dP/dt, at the inflection
  const finalPop = logisticPop(k, r, p0, p.tEnd);

  const metrics: Metric[] = [
    { key: 'carryingCapacity', label: 'Carrying capacity K', value: k },
    {
      key: 'doublingTime',
      label: 'Early doubling time',
      value: doublingTime,
      unit: 'h',
      note: 'ln2 / r (while the culture is still small)',
    },
    {
      key: 'inflectionTime',
      label: 'Inflection time (P=K/2)',
      value: inflectionTime,
      unit: 'h',
      note: 'steepest growth — half the capacity',
    },
    {
      key: 'timeTo90Pct',
      label: 'Time to 90% of capacity',
      value: timeTo90,
      unit: 'h',
    },
    {
      key: 'maxAbsGrowthRate',
      label: 'Max absolute growth rate',
      value: maxAbsGrowthRate,
      note: 'r·K/4 at the inflection',
    },
    {
      key: 'finalPop',
      label: `Population at ${p.tEnd} h`,
      value: finalPop,
      note: 'absolute population (same units as K)',
    },
  ];

  const n = p.outputPoints;
  const times = Array.from({ length: n }, (_, i) => (p.tEnd * i) / (n - 1));
  const series: Series[] = [
    {
      x: times,
      y: { population: times.map((t) => logisticPop(k, r, p0, t)) },
      xLabel: 'time (h)',
      yLabel: 'population',
    },
  ];

  return {
    engine: 'microbial-growth',
    summary: `Logistic growth: r=${r}/h, K=${k}, seed ${p0} → reaches half capacity at ${inflectionTime.toFixed(1)} h and 90% at ${timeTo90.toFixed(1)} h; population at ${p.tEnd} h is ${finalPop.toFixed(3)} (${((100 * finalPop) / k).toFixed(0)}% of K).`,
    metrics,
    series,
    detail: { carryingCapacity: k, inflectionTime, timeTo90, finalPop },
    provenance: provenance('microbial-growth', '1.0.0', p),
  };
}

export const spec: EngineSpec<MicrobialGrowthParams> = {
  slug: 'microbial-growth',
  title: 'Microbial Growth Curve (logistic)',
  domain: 'bioprocess',
  version: '1.0.0',
  description:
    'The classic S-shaped microbial growth curve from logistic (Verhulst) dynamics dP/dt=r·P·(1−P/K): a population grows at per-capita rate r while small and levels off at the carrying capacity K as space and nutrients run out. The closed-form solution P(t)=K/(1+A·e^(−rt)) with A=(K−P₀)/P₀ gives an exponential-looking early phase, a steepest point at half capacity, and a stationary plateau. Reports the carrying capacity, the early doubling time ln2/r, the inflection time, the time to reach 90% of capacity, the maximum absolute growth rate r·K/4, and the final population, plus the growth curve. Closed-form and deterministic; distinct from the substrate-limited Monod bioreactor engine.',
  references: [
    'Verhulst, P.-F. (1838) Notice sur la loi que la population suit dans son accroissement. Corresp. Math. Phys. 10:113-121.',
    'Zwietering, M.H. et al. (1990) Modeling of the bacterial growth curve. Appl. Environ. Microbiol. 56:1875-1881.',
  ],
  paramsSchema: paramsSchema as z.ZodType<MicrobialGrowthParams>,
  run,
  example: paramsSchema.parse({ carryingCapacity: 2, growthRate: 0.4, initialPop: 0.01, tEnd: 48 }),
  tags: ['bioprocess', 'growth', 'logistic', 'verhulst', 'fermentation', 'microbiology'],
};

export default spec;
