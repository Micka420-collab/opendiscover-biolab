/**
 * Score a player's hypothesis against the solved truth.
 *
 * The hypothesis is deliberately beginner-shaped: pick which look will be MOST
 * common (a multiple choice), and — for extra depth — optionally bet what share
 * of the litter that look will be. Getting the pick right is the win; nailing
 * the percentage is the bonus that rewards understanding the ratio underneath.
 *
 * Pure and deterministic.
 */

import type { SolvedCross } from './solve';

export interface Hypothesis {
  /** The phenotype label the player thinks will be most common. */
  pick: string;
  /** Optional bet on that look's share of the litter, 0..100. `null` = skipped. */
  pct: number | null;
}

export interface Score {
  pickCorrect: boolean;
  /** The true probability (0..1) of the picked phenotype. */
  actualProbability: number;
  /** 100 for a correct most-common pick, else 0. */
  base: number;
  /** 0..50, scaled by how close the % bet was (0 if skipped). */
  bonus: number;
  total: number;
}

/** Points awarded for a correct most-common pick. */
export const PICK_POINTS = 100;
/** Maximum points for an exact percentage bet. */
export const BONUS_POINTS = 50;
/** A % bet earns nothing once it is this many percentage points off. */
export const BONUS_TOLERANCE = 25;

export function scoreHypothesis(solved: SolvedCross, h: Hypothesis): Score {
  const pickCorrect = solved.mostCommon.includes(h.pick);
  const share = solved.options.find((o) => o.label === h.pick)?.probability ?? 0;
  const actualPct = share * 100;

  const base = pickCorrect ? PICK_POINTS : 0;

  let bonus = 0;
  if (h.pct != null) {
    const errorPp = Math.abs(h.pct - actualPct);
    const closeness = Math.max(0, 1 - errorPp / BONUS_TOLERANCE);
    bonus = Math.round(BONUS_POINTS * closeness);
  }

  return { pickCorrect, actualProbability: share, base, bonus, total: base + bonus };
}

/** Sum a run of scores — the gauntlet total. */
export function totalScore(scores: Score[]): number {
  return scores.reduce((s, x) => s + x.total, 0);
}

/** Max achievable score for a run of `rounds` rounds (for a "X / Y" display). */
export function maxScore(rounds: number): number {
  return rounds * (PICK_POINTS + BONUS_POINTS);
}
