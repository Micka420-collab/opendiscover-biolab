/**
 * Rock–Paper–Scissors replicator dynamics — cyclic dominance on the simplex.
 *
 * Three strategies (Rock, Paper, Scissors) with population frequencies
 * x = (x_R, x_P, x_S), x_R + x_P + x_S = 1. Rock beats Scissors, Paper beats Rock,
 * Scissors beats Paper. With a win payoff `a` and a loss magnitude `b`, the payoff
 * to strategy i against j is +a if i beats j, −b if j beats i, 0 on a tie. The
 * fitness of strategy i is f_i = (A·x)_i, the mean fitness is phi = x·A·x, and the
 * replicator equation is
 *
 *     dx_i/dt = x_i · (f_i − phi).
 *
 * This is not a toy: real cyclic dominance drives side-blotched-lizard mating
 * strategies and E. coli colicin systems. The interior fixed point is the uniform
 * mix (1/3, 1/3, 1/3), and the dynamics split cleanly by a vs b:
 *
 *     a = b (zero-sum):  neutral closed orbits; the product V = x_R·x_P·x_S is
 *                        an exact conserved quantity.
 *     a > b:             the fixed point is asymptotically stable — spirals to the center.
 *     a < b:             it is unstable — heteroclinic cycles spiral out toward the edges.
 *
 * Deterministic: a pure ODE integrated with fixed-step RK4, which preserves the
 * simplex sum exactly (the per-stage increments sum to zero).
 *
 * References:
 *   - Hofbauer, J. & Sigmund, K. (1998) Evolutionary Games and Population Dynamics.
 *   - Nowak, M.A. (2006) Evolutionary Dynamics, ch. 4.
 *   - Sinervo, B. & Lively, C.M. (1996) The rock-paper-scissors game and the
 *     evolution of alternative male strategies. Nature 380:240-243.
 */

import { z } from 'zod';
import { type Derivative, rk4 } from '../core/ode';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Win payoff a (> 0). */
    winPayoff: z.number().positive().default(1),
    /** Loss magnitude b (> 0). a=b zero-sum, a>b stable, a<b unstable. */
    lossPayoff: z.number().positive().default(1),
    /** Initial Rock frequency. */
    rock0: z.number().min(0).max(1).default(0.5),
    /** Initial Paper frequency. */
    paper0: z.number().min(0).max(1).default(0.3),
    // Scissors is 1 − rock0 − paper0.
    /** Integration horizon. */
    tEnd: z.number().positive().max(10_000).default(100),
    /** Fixed RK4 steps. */
    steps: z.number().int().positive().max(200_000).default(4000),
    /** Points kept for the plotted series. */
    outputPoints: z.number().int().positive().max(2000).default(500),
  })
  .strict()
  .refine((p) => p.rock0 + p.paper0 < 1, {
    message: 'rock0 + paper0 must be < 1 (Scissors gets the remainder)',
    path: ['paper0'],
  });

export type RockPaperScissorsParams = z.infer<typeof paramsSchema>;

/** Payoff to strategy i against j (0=Rock, 1=Paper, 2=Scissors). i beats j when j=(i+2)%3. */
export function payoff(i: number, j: number, win: number, loss: number): number {
  if (i === j) return 0;
  return j === (i + 2) % 3 ? win : -loss;
}

/** Replicator derivative for y = [x_R, x_P, x_S]. */
export function rpsDerivative(p: RockPaperScissorsParams): Derivative {
  return (_t, y) => {
    const x = [y[0] ?? 0, y[1] ?? 0, y[2] ?? 0];
    const f = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      let fi = 0;
      for (let j = 0; j < 3; j++) fi += payoff(i, j, p.winPayoff, p.lossPayoff) * x[j];
      f[i] = fi;
    }
    const phi = x[0] * f[0] + x[1] * f[1] + x[2] * f[2];
    return [x[0] * (f[0] - phi), x[1] * (f[1] - phi), x[2] * (f[2] - phi)];
  };
}

function downsampleIndices(len: number, n: number): number[] {
  if (len <= n) return Array.from({ length: len }, (_, i) => i);
  const denom = Math.max(n - 1, 1);
  return Array.from({ length: n }, (_, i) => Math.round((i * (len - 1)) / denom));
}

export function run(rawParams: Partial<RockPaperScissorsParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const s0 = 1 - p.rock0 - p.paper0;
  const traj = rk4(rpsDerivative(p), [p.rock0, p.paper0, s0], 0, p.tEnd, p.steps);

  const rock = traj.y.map((row) => row[0] ?? 0);
  const paper = traj.y.map((row) => row[1] ?? 0);
  const scissors = traj.y.map((row) => row[2] ?? 0);

  // Conserved quantity V = x_R·x_P·x_S (exactly constant for the zero-sum a=b case).
  const v0 = p.rock0 * p.paper0 * s0;
  let maxAbsDev = 0;
  let minFreq = Number.POSITIVE_INFINITY;
  for (let k = 0; k < rock.length; k++) {
    const v = (rock[k] ?? 0) * (paper[k] ?? 0) * (scissors[k] ?? 0);
    if (Math.abs(v - v0) > maxAbsDev) maxAbsDev = Math.abs(v - v0);
    const m = Math.min(rock[k] ?? 0, paper[k] ?? 0, scissors[k] ?? 0);
    if (m < minFreq) minFreq = m;
  }
  const conservedDriftPct = v0 > 0 ? (100 * maxAbsDev) / v0 : maxAbsDev;
  const stabilityIndex = p.winPayoff - p.lossPayoff;

  const metrics: Metric[] = [
    {
      key: 'equilibriumFrequency',
      label: 'Interior equilibrium (each strategy)',
      value: 1 / 3,
      note: 'the uniform mix (1/3, 1/3, 1/3)',
    },
    {
      key: 'stabilityIndex',
      label: 'Stability index (a − b)',
      value: stabilityIndex,
      note: '>0 spirals to center, =0 neutral cycles, <0 spirals to the edges',
    },
    {
      key: 'conservedDriftPct',
      label: 'Conserved-quantity drift',
      value: conservedDriftPct,
      unit: '%',
      note: 'max |V − V0| / V0 of V = x_R·x_P·x_S; ~0 confirms neutral cycles (a=b)',
    },
    {
      key: 'minFrequency',
      label: 'Minimum strategy frequency',
      value: minFreq,
      note: 'how close the orbit gets to a one-strategy edge',
    },
    { key: 'winPayoff', label: 'Win payoff a', value: p.winPayoff },
    { key: 'lossPayoff', label: 'Loss payoff b', value: p.lossPayoff },
  ];

  const idx = downsampleIndices(traj.t.length, p.outputPoints);
  const ts = idx.map((k) => traj.t[k] ?? 0);
  const rS = idx.map((k) => rock[k] ?? 0);
  const pS = idx.map((k) => paper[k] ?? 0);
  const sS = idx.map((k) => scissors[k] ?? 0);
  const series: Series[] = [
    { x: ts, y: { rock: rS, paper: pS, scissors: sS }, xLabel: 'time', yLabel: 'frequency' },
    // Phase portrait on the (rock, paper) face of the simplex.
    { x: rS, y: { paper: pS }, xLabel: 'rock frequency', yLabel: 'paper frequency' },
  ];

  const regime =
    stabilityIndex > 1e-9
      ? 'spirals to the (1/3,1/3,1/3) center'
      : stabilityIndex < -1e-9
        ? 'heteroclinic cycles toward the edges'
        : 'neutral closed orbits (V conserved)';

  return {
    engine: 'rock-paper-scissors',
    summary: `Rock–Paper–Scissors replicator (a=${p.winPayoff}, b=${p.lossPayoff}): ${regime}; conserved-V drift ${conservedDriftPct.toFixed(3)}%.`,
    metrics,
    series,
    detail: { conservedV0: v0, stabilityIndex, minFrequency: minFreq },
    provenance: provenance('rock-paper-scissors', '1.0.0', p),
  };
}

export const spec: EngineSpec<RockPaperScissorsParams> = {
  slug: 'rock-paper-scissors',
  title: 'Rock–Paper–Scissors (replicator dynamics)',
  domain: 'ecology',
  version: '1.0.0',
  description:
    'Evolutionary game theory of cyclic dominance — Rock beats Scissors beats Paper beats Rock — under the replicator equation on the simplex. Real biology (side-blotched lizards, E. coli colicins). The uniform mix (1/3,1/3,1/3) is the interior fixed point; with win payoff a and loss magnitude b the dynamics are neutral closed orbits with an exactly conserved product V = x_R·x_P·x_S when a=b, spiral to the center when a>b, and cycle out toward the edges when a<b.',
  references: [
    'Hofbauer, J. & Sigmund, K. (1998) Evolutionary Games and Population Dynamics.',
    'Nowak, M.A. (2006) Evolutionary Dynamics, ch. 4.',
    'Sinervo, B. & Lively, C.M. (1996) The rock-paper-scissors game and the evolution of alternative male strategies. Nature 380:240-243.',
  ],
  paramsSchema: paramsSchema as z.ZodType<RockPaperScissorsParams>,
  run,
  example: paramsSchema.parse({ winPayoff: 1, lossPayoff: 1, rock0: 0.5, paper0: 0.3 }),
  tags: ['ecology', 'game-theory', 'replicator', 'cyclic-dominance', 'simplex', 'ode'],
};

export default spec;
