/**
 * Nicholson–Bailey host–parasitoid model.
 *
 * The classic discrete-generation model of a host attacked by a parasitoid that
 * lays eggs in it. With a random (Poisson) search, the fraction of hosts escaping
 * parasitism is exp(-a*P), giving the map
 *
 *     H_{t+1} = R * H_t * exp(-a * P_t)
 *     P_{t+1} = c * H_t * (1 - exp(-a * P_t))
 *
 * where R is the host reproductive rate, a the parasitoid search efficiency, and
 * c the parasitoids emerging per parasitized host. Its coexistence equilibrium
 * (for R > 1) is exact:
 *
 *     P* = ln(R) / a
 *     H* = R * ln(R) / (a * c * (R - 1))
 *
 * The famous result (Nicholson & Bailey 1935): this equilibrium is ALWAYS unstable
 * — any perturbation grows into oscillations of ever-increasing amplitude (the host
 * escapes to a huge outbreak, the parasitoid catches up, both crash, repeat bigger)
 * until one goes extinct. Spatial structure or host self-limitation is needed for
 * persistence.
 *
 * Deterministic: a pure discrete map (no randomness), with populations clamped to
 * a finite range to keep the runaway outbreak from overflowing.
 *
 * References:
 *   - Nicholson, A.J. & Bailey, V.A. (1935) The balance of animal populations.
 *     Proc. Zool. Soc. Lond. 105:551-598.
 *   - Hassell, M.P. (1978) The Dynamics of Arthropod Predator-Prey Systems.
 *   - Murray, J.D. (2002) Mathematical Biology I, ch. 5.
 */

import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

const MAX_POP = 1e12;

export const paramsSchema = z
  .object({
    /** Host reproductive rate R (> 1 for a coexistence equilibrium to exist). */
    reproduction: z.number().min(1e-9).default(2),
    /** Parasitoid search efficiency a. */
    searchEfficiency: z.number().min(1e-9).default(0.05),
    /** Parasitoids emerging per parasitized host c. */
    parasitoidsPerHost: z.number().min(1e-9).default(1),
    /** Initial host population. */
    host0: z.number().min(0).default(24),
    /** Initial parasitoid population. */
    parasitoid0: z.number().min(0).default(12),
    /** Generations to simulate. */
    generations: z.number().int().positive().max(100_000).default(40),
  })
  .strict();

export type NicholsonBaileyParams = z.infer<typeof paramsSchema>;

/** Coexistence equilibrium (H*, P*), or null if R <= 1 (no positive equilibrium). */
export function nicholsonBaileyEquilibrium(
  r: number,
  a: number,
  c: number,
): { host: number; parasitoid: number } | null {
  if (r <= 1) return null;
  const lnR = Math.log(r);
  // H* = R·lnR/(a·c·(R−1)) = lnR/(a·c·(1−1/R)); the second form avoids forming the
  // R·lnR product, which would overflow to Infinity for astronomically large R even
  // though the true H* is finite.
  return { parasitoid: lnR / a, host: lnR / (a * c * (1 - 1 / r)) };
}

export function run(rawParams: Partial<NicholsonBaileyParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const eq = nicholsonBaileyEquilibrium(p.reproduction, p.searchEfficiency, p.parasitoidsPerHost);

  const hosts: number[] = [p.host0];
  const parasitoids: number[] = [p.parasitoid0];
  let h = p.host0;
  let pop = p.parasitoid0;
  for (let t = 0; t < p.generations; t++) {
    const escaping = Math.exp(-p.searchEfficiency * pop);
    const hNext = p.reproduction * h * escaping;
    const pNext = p.parasitoidsPerHost * h * (1 - escaping);
    // On overflow to non-finite, clamp to the MAX_POP ceiling (a runaway outbreak),
    // not 0 — clamping to 0 would falsely report extinction at the divergence peak.
    h = Number.isFinite(hNext) ? Math.min(Math.max(hNext, 0), MAX_POP) : MAX_POP;
    pop = Number.isFinite(pNext) ? Math.min(Math.max(pNext, 0), MAX_POP) : MAX_POP;
    hosts.push(h);
    parasitoids.push(pop);
  }

  let peakHost = 0;
  let minHost = Number.POSITIVE_INFINITY;
  let peakParasitoid = 0;
  for (let k = 0; k < hosts.length; k++) {
    const hk = hosts[k] ?? 0;
    if (hk > peakHost) peakHost = hk;
    if (hk < minHost) minHost = hk;
    const pk = parasitoids[k] ?? 0;
    if (pk > peakParasitoid) peakParasitoid = pk;
  }
  // Divergent oscillation signature: the outbreak peak dwarfs the equilibrium.
  const outbreakRatio = eq && eq.host > 0 ? peakHost / eq.host : Number.NaN;

  const metrics: Metric[] = [
    {
      key: 'hostEquilibrium',
      label: 'Host equilibrium H*',
      value: eq ? eq.host : Number.NaN,
      note: 'R·lnR / (a·c·(R−1))',
    },
    {
      key: 'parasitoidEquilibrium',
      label: 'Parasitoid equilibrium P*',
      value: eq ? eq.parasitoid : Number.NaN,
      note: 'lnR / a',
    },
    { key: 'peakHost', label: 'Peak host outbreak', value: peakHost },
    { key: 'minHost', label: 'Minimum host', value: Number.isFinite(minHost) ? minHost : 0 },
    { key: 'peakParasitoid', label: 'Peak parasitoid', value: peakParasitoid },
    {
      key: 'outbreakRatio',
      label: 'Outbreak / equilibrium ratio',
      value: outbreakRatio,
      note: '≫1 signals the always-unstable divergent oscillation',
    },
  ];

  const gen = hosts.map((_, k) => k);
  const series: Series[] = [
    {
      x: gen,
      y: { host: hosts, parasitoid: parasitoids },
      xLabel: 'generation',
      yLabel: 'population',
    },
  ];

  return {
    engine: 'nicholson-bailey',
    summary: eq
      ? `Nicholson–Bailey (R=${p.reproduction}): unstable equilibrium (H*=${eq.host.toFixed(1)}), host outbreak peaks at ${peakHost.toFixed(0)} (${outbreakRatio.toFixed(1)}× equilibrium).`
      : `Nicholson–Bailey with R=${p.reproduction} ≤ 1: no coexistence equilibrium, host declines.`,
    metrics,
    series,
    detail: { equilibrium: eq, peakHost, minHost, outbreakRatio },
    provenance: provenance('nicholson-bailey', '1.0.0', p),
  };
}

export const spec: EngineSpec<NicholsonBaileyParams> = {
  slug: 'nicholson-bailey',
  title: 'Nicholson–Bailey Host–Parasitoid',
  domain: 'ecology',
  version: '1.0.0',
  description:
    'The classic discrete host–parasitoid map: hosts reproduce at rate R and escape a randomly-searching parasitoid with probability exp(−a·P). Its coexistence equilibrium P* = lnR/a, H* = R·lnR/(a·c·(R−1)) is ALWAYS unstable — any perturbation grows into diverging boom-and-bust oscillations until one species goes extinct, the foundational result showing that simple host–parasitoid coupling cannot persist without extra stabilizing structure.',
  references: [
    'Nicholson, A.J. & Bailey, V.A. (1935) The balance of animal populations. Proc. Zool. Soc. Lond. 105:551-598.',
    'Hassell, M.P. (1978) The Dynamics of Arthropod Predator-Prey Systems.',
    'Murray, J.D. (2002) Mathematical Biology I: An Introduction, 3rd ed., ch. 5.',
  ],
  paramsSchema: paramsSchema as z.ZodType<NicholsonBaileyParams>,
  run,
  example: paramsSchema.parse({
    reproduction: 2,
    searchEfficiency: 0.05,
    parasitoidsPerHost: 1,
    host0: 24,
    parasitoid0: 12,
    generations: 40,
  }),
  tags: ['ecology', 'host-parasitoid', 'discrete-map', 'instability', 'oscillation'],
};

export default spec;
