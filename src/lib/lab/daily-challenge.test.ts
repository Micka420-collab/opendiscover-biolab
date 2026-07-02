import { runEngine } from '@/lib/sim';
import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_POOL,
  type Challenge,
  challengeForDate,
  challengeParams,
  meetsBar,
} from './daily-challenge';

function metricAt(c: Challenge, knob: number): number | undefined {
  const result = runEngine(c.engine, challengeParams(c, knob));
  return result.metrics.find((m) => m.key === c.metricKey)?.value;
}

describe('daily challenge selection', () => {
  it('is deterministic and date-only (any time on a day maps to the same challenge)', () => {
    const a = challengeForDate('2026-07-02');
    const b = challengeForDate('2026-07-02T23:59:59Z');
    expect(a.id).toBe(b.id);
    // Stable across repeated calls.
    expect(challengeForDate('2026-07-02').id).toBe(a.id);
  });

  it('exercises more than one challenge across a span of dates', () => {
    const ids = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      const iso = `2026-07-${String(day).padStart(2, '0')}`;
      ids.add(challengeForDate(iso).id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  it('only ever returns a challenge from the pool', () => {
    const poolIds = new Set(CHALLENGE_POOL.map((c) => c.id));
    for (let day = 1; day <= 60; day++) {
      const iso = `2026-01-${String((day % 28) + 1).padStart(2, '0')}`;
      expect(poolIds.has(challengeForDate(iso).id)).toBe(true);
    }
  });
});

describe('every pooled challenge is valid and winnable against the real engine', () => {
  for (const c of CHALLENGE_POOL) {
    it(`${c.id}: metric "${c.metricKey}" exists and a knob value clears the bar`, () => {
      // The metric the challenge scores must actually be produced by the engine.
      expect(metricAt(c, c.knob.default)).toBeTypeOf('number');

      // Scan the knob's range: at least one setting must clear the bar, proving the
      // challenge is winnable (guards against a wrong param name or unreachable target).
      let winnable = false;
      for (let v = c.knob.min; v <= c.knob.max + 1e-9; v += c.knob.step) {
        const value = metricAt(c, Number(v.toFixed(6)));
        if (value !== undefined && meetsBar(c, value)) {
          winnable = true;
          break;
        }
      }
      expect(winnable).toBe(true);
    });
  }
});
