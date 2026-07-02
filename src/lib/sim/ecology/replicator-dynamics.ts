/**
 * Replicator dynamics for a 2-strategy evolutionary game.
 *
 * A large population plays a symmetric game with the 2×2 payoff matrix
 *
 *          A       B
 *     A [ aa      ab ]
 *     B [ ba      bb ]
 *
 * where entry (i,j) is the payoff to a player using strategy i against one using
 * strategy j. Let x be the fraction of the population playing strategy A. The
 * expected payoffs (fitnesses) are
 *
 *     f_A = aa·x + ab·(1−x),      f_B = ba·x + bb·(1−x),
 *
 * and the replicator equation says a strategy grows in proportion to how much it
 * beats the population average:
 *
 *     dx/dt = x·(1−x)·(f_A − f_B).
 *
 * Writing p = aa − ba and q = ab − bb, the bracket is g(x) = p·x + q·(1−x), so the
 * interior rest point (a mixed equilibrium) is x* = q/(q−p) when it lands in (0,1).
 * Its stability, plus the signs of p and q, classify EVERY symmetric 2×2 game:
 *
 *   - dominance   — one strategy always wins (x → 0 or 1), no interior point;
 *   - coexistence — a single stable mixed ESS at x* (e.g. Hawk–Dove / chicken);
 *   - bistable    — two pure ESS with an unstable threshold x* (e.g. Stag Hunt);
 *   - neutral     — the payoffs cancel and every state is a fixed point.
 *
 * Deterministic: a 1-D ODE integrated with the adaptive RK45, x clamped to [0, 1].
 *
 * References:
 *   - Taylor, P.D. & Jonker, L.B. (1978) Evolutionarily stable strategies and game
 *     dynamics. Math. Biosci. 40:145-156.
 *   - Maynard Smith, J. (1982) Evolution and the Theory of Games.
 *   - Hofbauer, J. & Sigmund, K. (1998) Evolutionary Games and Population Dynamics.
 */

import { z } from 'zod';
import { type Derivative, rk45 } from '../core/ode';
import { downsampleIndices } from '../core/series';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Payoff to A against A. */
    aa: z.number().default(-1),
    /** Payoff to A against B. */
    ab: z.number().default(2),
    /** Payoff to B against A. */
    ba: z.number().default(0),
    /** Payoff to B against B. */
    bb: z.number().default(1),
    /** Initial fraction of the population playing strategy A. */
    x0: z.number().gt(0).lt(1).default(0.2),
    /** Integration horizon. */
    tEnd: z.number().positive().max(100_000).default(60),
    /** Adaptive RK45 tolerance. */
    tol: z.number().positive().default(1e-8),
    /** Points kept for the plotted series. */
    outputPoints: z.number().int().positive().max(2000).default(400),
  })
  .strict();

export type ReplicatorDynamicsParams = z.infer<typeof paramsSchema>;

export type GameType = 'dominance-A' | 'dominance-B' | 'coexistence' | 'bistable' | 'neutral';

/** Game codes surfaced as a numeric metric (kept stable for downstream tooling). */
const GAME_CODE: Record<GameType, number> = {
  'dominance-A': 1,
  'dominance-B': 2,
  coexistence: 3,
  bistable: 4,
  neutral: 5,
};

export interface GameClassification {
  type: GameType;
  code: number;
  /** The interior mixed equilibrium x*, if one exists in (0,1); else null. */
  interior: number | null;
  /** Predicted long-run fraction of A given the initial fraction. */
  essFractionA: number;
}

const EPS = 1e-12;

/**
 * Classify a symmetric 2×2 game and predict its outcome from x0. Pure algebra —
 * no integration — so the metrics are exact regardless of the ODE solver.
 */
export function classifyGame(
  aa: number,
  ab: number,
  ba: number,
  bb: number,
  x0: number,
): GameClassification {
  const p = aa - ba; // A's relative advantage when the opponent plays A
  const q = ab - bb; // A's relative advantage when the opponent plays B
  const d = q - p; // slope test: g'(x) = p − q = −d

  // Neutral game: g(x) ≡ 0, every state is a fixed point.
  if (Math.abs(p) < EPS && Math.abs(q) < EPS) {
    return { type: 'neutral', code: GAME_CODE.neutral, interior: null, essFractionA: x0 };
  }

  const interiorRaw = Math.abs(d) < EPS ? null : q / d;
  const hasInterior = interiorRaw !== null && interiorRaw > EPS && interiorRaw < 1 - EPS;

  if (hasInterior && interiorRaw !== null) {
    if (d > 0) {
      // g decreasing through x* → stable mixed ESS: converges there from any interior x0.
      return {
        type: 'coexistence',
        code: GAME_CODE.coexistence,
        interior: interiorRaw,
        essFractionA: interiorRaw,
      };
    }
    // d < 0 → unstable threshold: the basin boundary between the two pure ESS.
    const ess = x0 > interiorRaw ? 1 : x0 < interiorRaw ? 0 : interiorRaw;
    return { type: 'bistable', code: GAME_CODE.bistable, interior: interiorRaw, essFractionA: ess };
  }

  // No interior equilibrium → strict dominance. Sign of g on (0,1) is constant;
  // sample the midpoint g(0.5) = (p + q)/2.
  const gMid = 0.5 * (p + q);
  if (gMid > 0) {
    return { type: 'dominance-A', code: GAME_CODE['dominance-A'], interior: null, essFractionA: 1 };
  }
  return { type: 'dominance-B', code: GAME_CODE['dominance-B'], interior: null, essFractionA: 0 };
}

/** dx/dt = x·(1−x)·(f_A − f_B), as a 1-D ODE (x clamped to [0,1]). */
export function replicatorDerivative(p: ReplicatorDynamicsParams): Derivative {
  return (_t, y) => {
    const x = Math.min(Math.max(y[0] ?? 0, 0), 1);
    const fA = p.aa * x + p.ab * (1 - x);
    const fB = p.ba * x + p.bb * (1 - x);
    return [x * (1 - x) * (fA - fB)];
  };
}

const GAME_LABEL: Record<GameType, string> = {
  'dominance-A': 'dominance (A wins)',
  'dominance-B': 'dominance (B wins)',
  coexistence: 'coexistence (stable mixed ESS)',
  bistable: 'bistable (two pure ESS, unstable threshold)',
  neutral: 'neutral (every state is a fixed point)',
};

export function run(rawParams: Partial<ReplicatorDynamicsParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const game = classifyGame(p.aa, p.ab, p.ba, p.bb, p.x0);

  const traj = rk45(replicatorDerivative(p), [p.x0], 0, p.tEnd, {
    tol: p.tol,
    outputPoints: p.outputPoints,
  });
  const fractionA = traj.y.map((row) => Math.min(Math.max(row[0] ?? 0, 0), 1));
  const finalFraction = fractionA[fractionA.length - 1] ?? p.x0;
  // Horizon-aware: only claim the population "settled" if it actually reached its
  // predicted rest point within the simulated window.
  const settled = Math.abs(finalFraction - game.essFractionA) < 1e-3;

  const metrics: Metric[] = [
    {
      key: 'gameType',
      label: 'Game type',
      value: game.code,
      note: GAME_LABEL[game.type],
    },
    {
      key: 'essFractionA',
      label: 'Predicted long-run fraction of A',
      value: game.essFractionA,
      note:
        game.type === 'bistable'
          ? 'depends on the starting fraction (basin of attraction)'
          : 'evolutionarily stable outcome',
    },
    { key: 'finalFraction', label: 'Fraction of A at t=tEnd', value: finalFraction },
    { key: 'initialFraction', label: 'Initial fraction of A', value: p.x0 },
  ];
  if (game.interior !== null) {
    metrics.push({
      key: 'interiorFixedPoint',
      label: 'Interior equilibrium x*',
      value: game.interior,
      note: game.type === 'coexistence' ? 'stable mixed ESS' : 'unstable invasion threshold',
    });
  }

  const idx = downsampleIndices(traj.t.length, p.outputPoints);
  const series: Series[] = [
    {
      x: idx.map((k) => traj.t[k] ?? 0),
      y: { fractionA: idx.map((k) => fractionA[k] ?? 0) },
      xLabel: 'time',
      yLabel: 'fraction playing strategy A',
    },
  ];

  const outcome =
    game.type === 'coexistence'
      ? `stable coexistence at ${(100 * game.essFractionA).toFixed(0)}% A`
      : game.type === 'bistable'
        ? `bistable — heads toward ${game.essFractionA >= 0.5 ? 'all-A' : 'all-B'} from x₀=${p.x0}`
        : game.type === 'neutral'
          ? 'neutral drift (payoffs cancel)'
          : `strategy ${game.type === 'dominance-A' ? 'A' : 'B'} dominates`;

  return {
    engine: 'replicator-dynamics',
    summary: `Replicator dynamics: ${GAME_LABEL[game.type]} — ${outcome}${settled ? '' : ' (not yet settled at t=tEnd)'}.`,
    metrics,
    series,
    detail: {
      gameType: game.type,
      interiorFixedPoint: game.interior,
      essFractionA: game.essFractionA,
      settled,
    },
    provenance: provenance('replicator-dynamics', '1.0.0', p),
  };
}

export const spec: EngineSpec<ReplicatorDynamicsParams> = {
  slug: 'replicator-dynamics',
  title: 'Replicator Dynamics (evolutionary game)',
  domain: 'ecology',
  version: '1.0.0',
  description:
    'The replicator equation for a symmetric 2×2 game: dx/dt = x(1−x)(f_A − f_B), where x is the fraction playing strategy A and the fitnesses come from a payoff matrix. It classifies any such game — dominance (one strategy wins), coexistence (a stable mixed ESS, as in Hawk–Dove), bistable (two pure ESS with an unstable threshold, as in the Stag Hunt), or neutral — and locates the evolutionarily stable outcome. Adaptive RK45, x clamped to [0,1].',
  references: [
    'Taylor, P.D. & Jonker, L.B. (1978) Evolutionarily stable strategies and game dynamics. Math. Biosci. 40:145-156.',
    'Maynard Smith, J. (1982) Evolution and the Theory of Games. Cambridge University Press.',
    'Hofbauer, J. & Sigmund, K. (1998) Evolutionary Games and Population Dynamics. Cambridge University Press.',
  ],
  paramsSchema: paramsSchema as z.ZodType<ReplicatorDynamicsParams>,
  run,
  // Default payoffs are a Hawk–Dove game (V=2, C=4): a stable mix of 50% each.
  example: paramsSchema.parse({ aa: -1, ab: 2, ba: 0, bb: 1, x0: 0.2 }),
  tags: ['ecology', 'evolution', 'game-theory', 'ESS', 'replicator', 'ode'],
};

export default spec;
