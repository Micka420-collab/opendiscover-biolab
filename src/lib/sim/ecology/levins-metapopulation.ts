/**
 * Levins metapopulation with habitat destruction.
 *
 * A species living in a network of habitat patches. Let p be the fraction of
 * patches occupied, c the colonization rate, e the local extinction rate, and h
 * the fraction of patches that are habitable (h = 1 − destroyed):
 *
 *     dp/dt = c·p·(h − p) − e·p
 *
 * (Levins 1969; the habitat term is Tilman et al. 1994.) The regional equilibrium
 * occupancy is
 *
 *     p* = h − e/c      if  h > e/c,   else 0 (regional extinction).
 *
 * The striking consequence is an EXTINCTION THRESHOLD: the metapopulation persists
 * only while the habitable fraction stays above e/c, so destroying more than a
 * critical fraction (1 − e/c) of habitat drives the whole species extinct — even
 * though occupied patches still remain at the moment of collapse (the "extinction
 * debt").
 *
 * Deterministic: a 1-D ODE integrated with the adaptive RK45, p clamped to [0, h].
 *
 * References:
 *   - Levins, R. (1969) Some demographic and genetic consequences of environmental
 *     heterogeneity for biological control. Bull. Entomol. Soc. Am. 15:237-240.
 *   - Tilman, D. et al. (1994) Habitat destruction and the extinction debt.
 *     Nature 371:65-66.
 *   - Hanski, I. (1999) Metapopulation Ecology.
 */

import { z } from 'zod';
import { type Derivative, rk45 } from '../core/ode';
import { downsampleIndices } from '../core/series';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Colonization rate c. */
    colonization: z.number().positive().default(0.5),
    /** Local extinction rate e. */
    extinction: z.number().positive().default(0.1),
    /** Fraction of habitat destroyed (0 = pristine, 1 = all destroyed). */
    destroyed: z.number().min(0).lt(1).default(0),
    /** Initial fraction of patches occupied. */
    p0: z.number().gt(0).lt(1).default(0.5),
    /** Integration horizon. */
    tEnd: z.number().positive().max(100_000).default(120),
    /** Adaptive RK45 tolerance. */
    tol: z.number().positive().default(1e-8),
    /** Points kept for the plotted series. */
    outputPoints: z.number().int().positive().max(2000).default(400),
  })
  .strict();

export type LevinsMetapopulationParams = z.infer<typeof paramsSchema>;

/** Equilibrium occupancy p* = h − e/c (h = 1 − destroyed), or 0 below the threshold. */
export function equilibriumOccupancy(c: number, e: number, destroyed: number): number {
  const h = 1 - destroyed;
  const pStar = h - e / c;
  return pStar > 0 ? pStar : 0;
}

/** dp/dt = c·p·(h − p) − e·p, as a 1-D ODE (p clamped ≥ 0). */
export function levinsDerivative(p: LevinsMetapopulationParams): Derivative {
  const h = 1 - p.destroyed;
  return (_t, y) => {
    const occ = Math.max(y[0] ?? 0, 0);
    return [p.colonization * occ * (h - occ) - p.extinction * occ];
  };
}

export function run(rawParams: Partial<LevinsMetapopulationParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const h = 1 - p.destroyed;
  const pStar = equilibriumOccupancy(p.colonization, p.extinction, p.destroyed);
  const persists = pStar > 0;
  // Max destroyable fraction before regional extinction: 1 − e/c (≥ 0).
  const extinctionThreshold = Math.max(0, 1 - p.extinction / p.colonization);

  const traj = rk45(levinsDerivative(p), [p.p0], 0, p.tEnd, {
    tol: p.tol,
    outputPoints: p.outputPoints,
  });
  const occupancy = traj.y.map((row) => Math.min(Math.max(row[0] ?? 0, 0), 1));
  const finalOccupancy = occupancy[occupancy.length - 1] ?? 0;

  const metrics: Metric[] = [
    {
      key: 'equilibriumOccupancy',
      label: 'Equilibrium occupancy p*',
      value: pStar,
      note: persists ? 'h − e/c' : 'regional extinction (h ≤ e/c)',
    },
    { key: 'habitableFraction', label: 'Habitable fraction h', value: h, note: '1 − destroyed' },
    {
      key: 'extinctionThreshold',
      label: 'Max destroyable fraction',
      value: extinctionThreshold,
      note: '1 − e/c; destroy more than this and the species goes regionally extinct',
    },
    { key: 'finalOccupancy', label: 'Final occupancy (t=tEnd)', value: finalOccupancy },
    {
      key: 'persists',
      label: 'Metapopulation persists',
      value: persists ? 1 : 0,
      note: '1 = a positive occupancy equilibrium exists',
    },
    { key: 'colonization', label: 'Colonization rate c', value: p.colonization },
    { key: 'extinction', label: 'Extinction rate e', value: p.extinction },
  ];

  const idx = downsampleIndices(traj.t.length, p.outputPoints);
  const series: Series[] = [
    {
      x: idx.map((k) => traj.t[k] ?? 0),
      y: { occupied: idx.map((k) => occupancy[k] ?? 0) },
      xLabel: 'time',
      yLabel: 'fraction of patches occupied',
    },
  ];

  return {
    engine: 'levins-metapopulation',
    summary: persists
      ? `Levins metapopulation: persists at p*=${pStar.toFixed(3)} of patches (${(100 * p.destroyed).toFixed(0)}% habitat destroyed; up to ${(100 * extinctionThreshold).toFixed(0)}% is survivable).`
      : `Levins metapopulation: regional extinction — habitable fraction h=${h.toFixed(2)} is below the threshold e/c=${(p.extinction / p.colonization).toFixed(2)}.`,
    metrics,
    series,
    detail: { equilibriumOccupancy: pStar, extinctionThreshold, habitableFraction: h, persists },
    provenance: provenance('levins-metapopulation', '1.0.0', p),
  };
}

export const spec: EngineSpec<LevinsMetapopulationParams> = {
  slug: 'levins-metapopulation',
  title: 'Levins Metapopulation (habitat destruction)',
  domain: 'ecology',
  version: '1.0.0',
  description:
    'A species occupying a network of habitat patches, colonizing empty ones and going locally extinct. With colonization c, extinction e, and habitable fraction h = 1 − destroyed, the regional occupancy settles at p* = h − e/c when h > e/c, else the species is regionally extinct. The consequence is an extinction threshold: destroying more than 1 − e/c of the habitat wipes out the whole metapopulation — often after a delay while occupied patches remain (the extinction debt).',
  references: [
    'Levins, R. (1969) Some demographic and genetic consequences of environmental heterogeneity for biological control. Bull. Entomol. Soc. Am. 15:237-240.',
    'Tilman, D., May, R.M., Lehman, C.L. & Nowak, M.A. (1994) Habitat destruction and the extinction debt. Nature 371:65-66.',
    'Hanski, I. (1999) Metapopulation Ecology. Oxford University Press.',
  ],
  paramsSchema: paramsSchema as z.ZodType<LevinsMetapopulationParams>,
  run,
  example: paramsSchema.parse({ colonization: 0.5, extinction: 0.1, destroyed: 0, p0: 0.5 }),
  tags: ['ecology', 'metapopulation', 'conservation', 'extinction-threshold', 'ode'],
};

export default spec;
