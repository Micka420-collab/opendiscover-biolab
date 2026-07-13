import { describe, expect, it } from 'vitest';
import {
  BONUS_POINTS,
  type Hypothesis,
  PICK_POINTS,
  maxScore,
  scoreHypothesis,
  totalScore,
} from './scoring';
import { solveCross } from './solve';
import { crossById } from './specimens';

const monohybrid = solveCross(
  crossById('peas-monohybrid') as NonNullable<ReturnType<typeof crossById>>,
);

describe('scoreHypothesis', () => {
  it('awards the pick points for naming the most-common look', () => {
    const h: Hypothesis = { pick: 'Round', pct: null };
    const s = scoreHypothesis(monohybrid, h);
    expect(s.pickCorrect).toBe(true);
    expect(s.base).toBe(PICK_POINTS);
    expect(s.bonus).toBe(0);
    expect(s.total).toBe(PICK_POINTS);
  });

  it('gives no base points for the wrong pick', () => {
    const s = scoreHypothesis(monohybrid, { pick: 'Wrinkled', pct: null });
    expect(s.pickCorrect).toBe(false);
    expect(s.base).toBe(0);
  });

  it('a spot-on percentage bet earns the full bonus', () => {
    // Round is 75% of a 3:1 cross.
    const s = scoreHypothesis(monohybrid, { pick: 'Round', pct: 75 });
    expect(s.actualProbability).toBeCloseTo(0.75, 9);
    expect(s.bonus).toBe(BONUS_POINTS);
    expect(s.total).toBe(PICK_POINTS + BONUS_POINTS);
  });

  it('a far-off percentage bet earns no bonus', () => {
    const s = scoreHypothesis(monohybrid, { pick: 'Round', pct: 20 });
    expect(s.bonus).toBe(0);
  });

  it('scales the bonus with closeness', () => {
    const near = scoreHypothesis(monohybrid, { pick: 'Round', pct: 70 }).bonus;
    const far = scoreHypothesis(monohybrid, { pick: 'Round', pct: 55 }).bonus;
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThanOrEqual(0);
  });

  it('can score a bonus even on a wrong pick (you still knew that look’s share)', () => {
    // Wrinkled is 25%; bet 25% → full bonus, but no base points.
    const s = scoreHypothesis(monohybrid, { pick: 'Wrinkled', pct: 25 });
    expect(s.base).toBe(0);
    expect(s.bonus).toBe(BONUS_POINTS);
  });
});

describe('totals', () => {
  it('sums a run and reports the ceiling', () => {
    const a = scoreHypothesis(monohybrid, { pick: 'Round', pct: 75 });
    const b = scoreHypothesis(monohybrid, { pick: 'Wrinkled', pct: null });
    expect(totalScore([a, b])).toBe(a.total + b.total);
    expect(maxScore(4)).toBe(4 * (PICK_POINTS + BONUS_POINTS));
  });
});
