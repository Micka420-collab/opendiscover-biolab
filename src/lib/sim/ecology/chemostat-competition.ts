/**
 * Two-species chemostat competition — the competitive exclusion principle.
 *
 * Two microbial species compete for a single limiting substrate S in a chemostat
 * (dilution rate D, sterile feed Sin), each growing by Monod kinetics:
 *
 *     mu_i(S) = muMax_i · S / (Ks_i + S)
 *     dS/dt   = D·(Sin − S) − mu_1(S)·X_1/Y_1 − mu_2(S)·X_2/Y_2
 *     dX_i/dt = (mu_i(S) − D)·X_i
 *
 * Tilman's R* rule: the break-even substrate concentration at which a species
 * exactly balances dilution is
 *
 *     R*_i = Ks_i · D / (muMax_i − D)      (or ∞ if muMax_i ≤ D).
 *
 * The species with the LOWER R* wins: it draws S down to its own R*, below the
 * competitor's break-even, so the competitor's growth can't keep up with washout
 * and it is excluded. Two species cannot coexist on one resource — Gause's
 * competitive exclusion principle, made mechanistic. (If the lower R* still exceeds
 * Sin, both wash out.)
 *
 * Deterministic: adaptive RK45 with the state clamped to be non-negative.
 *
 * References:
 *   - Hardin, G. (1960) The competitive exclusion principle. Science 131:1292-1297.
 *   - Tilman, D. (1982) Resource Competition and Community Structure.
 *   - Smith, H.L. & Waltman, P. (1995) The Theory of the Chemostat.
 */

import { z } from 'zod';
import { type Derivative, rk45 } from '../core/ode';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Species 1 max growth rate. */
    muMax1: z.number().positive().default(0.5),
    /** Species 1 half-saturation Ks. */
    ks1: z.number().positive().default(1),
    /** Species 1 yield. */
    y1: z.number().positive().default(0.5),
    /** Species 2 max growth rate. */
    muMax2: z.number().positive().default(0.5),
    /** Species 2 half-saturation Ks. */
    ks2: z.number().positive().default(3),
    /** Species 2 yield. */
    y2: z.number().positive().default(0.5),
    /** Dilution rate D. */
    d: z.number().positive().default(0.2),
    /** Feed substrate concentration Sin. */
    sin: z.number().positive().default(10),
    /** Initial substrate. */
    s0: z.number().min(0).default(10),
    /** Initial species-1 biomass. */
    x1_0: z.number().min(0).default(0.1),
    /** Initial species-2 biomass. */
    x2_0: z.number().min(0).default(0.1),
    /** Integration horizon. */
    tEnd: z.number().positive().max(100_000).default(300),
    /** Adaptive RK45 tolerance. */
    tol: z.number().positive().default(1e-8),
    /** Points kept for the plotted series. */
    outputPoints: z.number().int().positive().max(2000).default(500),
  })
  .strict();

export type ChemostatCompetitionParams = z.infer<typeof paramsSchema>;

/** Break-even substrate R*_i = Ks·D/(muMax−D), or +Infinity if muMax ≤ D. */
export function breakEvenSubstrate(muMax: number, ks: number, d: number): number {
  return muMax > d ? (ks * d) / (muMax - d) : Number.POSITIVE_INFINITY;
}

function monod(muMax: number, ks: number, s: number): number {
  const S = Math.max(s, 0);
  return (muMax * S) / (ks + S);
}

export function chemostatCompetitionDerivative(p: ChemostatCompetitionParams): Derivative {
  return (_t, y) => {
    const s = Math.max(y[0] ?? 0, 0);
    const x1 = Math.max(y[1] ?? 0, 0);
    const x2 = Math.max(y[2] ?? 0, 0);
    const mu1 = monod(p.muMax1, p.ks1, s);
    const mu2 = monod(p.muMax2, p.ks2, s);
    return [
      p.d * (p.sin - s) - (mu1 * x1) / p.y1 - (mu2 * x2) / p.y2,
      (mu1 - p.d) * x1,
      (mu2 - p.d) * x2,
    ];
  };
}

const clampNonNeg = (v: number) => (v > 0 ? v : 0);

function downsampleIndices(len: number, n: number): number[] {
  if (len <= n) return Array.from({ length: len }, (_, i) => i);
  const denom = Math.max(n - 1, 1);
  return Array.from({ length: n }, (_, i) => Math.round((i * (len - 1)) / denom));
}

export function run(rawParams: Partial<ChemostatCompetitionParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const rStar1 = breakEvenSubstrate(p.muMax1, p.ks1, p.d);
  const rStar2 = breakEvenSubstrate(p.muMax2, p.ks2, p.d);

  // Analytic winner: among species ACTUALLY SEEDED (x_i0 > 0) that can persist
  // (R* < feed), the lower R* excludes the other. An exact R* tie is neutral
  // coexistence (code 3); a species seeded at zero can't win.
  const canPersist1 = p.x1_0 > 0 && rStar1 < p.sin;
  const canPersist2 = p.x2_0 > 0 && rStar2 < p.sin;
  let winner = 0;
  if (canPersist1 && canPersist2) {
    winner = Math.abs(rStar1 - rStar2) < 1e-12 ? 3 : rStar1 < rStar2 ? 1 : 2;
  } else if (canPersist1) {
    winner = 1;
  } else if (canPersist2) {
    winner = 2;
  }

  const traj = rk45(chemostatCompetitionDerivative(p), [p.s0, p.x1_0, p.x2_0], 0, p.tEnd, {
    tol: p.tol,
    outputPoints: p.outputPoints,
  });
  const substrate = traj.y.map((row) => clampNonNeg(row[0] ?? 0));
  const x1 = traj.y.map((row) => clampNonNeg(row[1] ?? 0));
  const x2 = traj.y.map((row) => clampNonNeg(row[2] ?? 0));

  const finalS = substrate[substrate.length - 1] ?? 0;
  const finalX1 = x1[x1.length - 1] ?? 0;
  const finalX2 = x2[x2.length - 1] ?? 0;

  // R*_i shown finite: a break-even ≥ Sin (incl. ∞) means "cannot persist".
  const displayRStar = (r: number) => Math.min(r, p.sin * 100);

  const metrics: Metric[] = [
    {
      key: 'rStar1',
      label: 'Species 1 break-even R*₁',
      value: displayRStar(rStar1),
      note: 'Ks₁·D/(µmax₁−D); lower wins',
    },
    {
      key: 'rStar2',
      label: 'Species 2 break-even R*₂',
      value: displayRStar(rStar2),
      note: 'Ks₂·D/(µmax₂−D); lower wins',
    },
    {
      key: 'winner',
      label: 'Surviving species',
      value: winner,
      note: '1 or 2 (the lower R*), 3 = tie/coexistence, 0 = neither persists',
    },
    { key: 'finalSubstrate', label: 'Final substrate', value: finalS, unit: 'g/L' },
    { key: 'finalBiomass1', label: 'Final species-1 biomass', value: finalX1, unit: 'g/L' },
    { key: 'finalBiomass2', label: 'Final species-2 biomass', value: finalX2, unit: 'g/L' },
  ];

  const idx = downsampleIndices(traj.t.length, p.outputPoints);
  const ts = idx.map((k) => traj.t[k] ?? 0);
  const series: Series[] = [
    {
      x: ts,
      y: {
        substrate: idx.map((k) => substrate[k] ?? 0),
        species1: idx.map((k) => x1[k] ?? 0),
        species2: idx.map((k) => x2[k] ?? 0),
      },
      xLabel: 'time',
      yLabel: 'concentration (g/L)',
    },
  ];

  return {
    engine: 'chemostat-competition',
    summary:
      winner === 0
        ? `Chemostat competition: no species persists (washout at D=${p.d}).`
        : winner === 3
          ? `Chemostat competition: an exact R*=${displayRStar(rStar1).toFixed(3)} tie — neutral coexistence, neither species is excluded.`
          : `Chemostat competition: species ${winner} wins (R*=${displayRStar(winner === 1 ? rStar1 : rStar2).toFixed(3)}); the competitor is excluded to ${(winner === 1 ? finalX2 : finalX1).toExponential(1)} g/L.`,
    metrics,
    series,
    detail: { rStar1, rStar2, winner, finalSubstrate: finalS },
    provenance: provenance('chemostat-competition', '1.0.0', p),
  };
}

export const spec: EngineSpec<ChemostatCompetitionParams> = {
  slug: 'chemostat-competition',
  title: 'Chemostat Competition (competitive exclusion)',
  domain: 'ecology',
  version: '1.0.0',
  description:
    "Two species competing for one limiting substrate in a chemostat. Tilman's R* rule: each species has a break-even substrate concentration R* = Ks·D/(µmax−D), and the one with the LOWER R* draws the substrate below its competitor's break-even and excludes it — Gause's competitive exclusion principle, mechanistically. Two species cannot coexist on a single resource (unless the lower R* exceeds the feed, in which case both wash out).",
  references: [
    'Hardin, G. (1960) The competitive exclusion principle. Science 131:1292-1297.',
    'Tilman, D. (1982) Resource Competition and Community Structure. Princeton.',
    'Smith, H.L. & Waltman, P. (1995) The Theory of the Chemostat.',
  ],
  paramsSchema: paramsSchema as z.ZodType<ChemostatCompetitionParams>,
  run,
  example: paramsSchema.parse({ muMax1: 0.5, ks1: 1, muMax2: 0.5, ks2: 3, d: 0.2, sin: 10 }),
  tags: ['ecology', 'competition', 'competitive-exclusion', 'chemostat', 'monod', 'ode'],
};

export default spec;
