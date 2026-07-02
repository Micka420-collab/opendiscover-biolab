import { describe, expect, it } from 'vitest';
import { EMPTY_STREAK, previousDay, recordClear } from './challenge-streak';

describe('previousDay', () => {
  it('steps back one day within a month', () => {
    expect(previousDay('2026-07-02')).toBe('2026-07-01');
  });
  it('crosses month boundaries (non-leap Feb)', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
  });
  it('crosses year boundaries', () => {
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
  });
  it('handles leap years', () => {
    expect(previousDay('2028-03-01')).toBe('2028-02-29'); // 2028 is a leap year
  });
  it('ignores any time suffix on the input', () => {
    expect(previousDay('2026-07-02T23:59:59Z')).toBe('2026-07-01');
  });
});

describe('recordClear', () => {
  it('starts a streak at 1 from the empty state', () => {
    expect(recordClear(EMPTY_STREAK, '2026-07-02')).toEqual({
      lastClearedDate: '2026-07-02',
      current: 1,
      best: 1,
    });
  });

  it('increments on a consecutive day', () => {
    const day1 = recordClear(EMPTY_STREAK, '2026-07-02');
    const day2 = recordClear(day1, '2026-07-03');
    expect(day2).toEqual({ lastClearedDate: '2026-07-03', current: 2, best: 2 });
  });

  it('is idempotent for the same day (no double count)', () => {
    const s = { lastClearedDate: '2026-07-02', current: 3, best: 3 };
    expect(recordClear(s, '2026-07-02')).toBe(s); // unchanged, same reference
  });

  it('resets to 1 after a gap, keeping best monotonic', () => {
    const s = { lastClearedDate: '2026-07-02', current: 5, best: 9 };
    expect(recordClear(s, '2026-07-05')).toEqual({
      lastClearedDate: '2026-07-05',
      current: 1,
      best: 9,
    });
  });

  it('increments across a month boundary', () => {
    const s = { lastClearedDate: '2026-02-28', current: 4, best: 4 };
    expect(recordClear(s, '2026-03-01')).toEqual({
      lastClearedDate: '2026-03-01',
      current: 5,
      best: 5,
    });
  });

  it('increments across a year boundary', () => {
    const s = { lastClearedDate: '2025-12-31', current: 2, best: 7 };
    expect(recordClear(s, '2026-01-01')).toEqual({
      lastClearedDate: '2026-01-01',
      current: 3,
      best: 7,
    });
  });

  it('raises best when the current streak exceeds the previous best', () => {
    let s = recordClear(EMPTY_STREAK, '2026-07-01');
    s = recordClear(s, '2026-07-02');
    s = recordClear(s, '2026-07-03');
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
  });
});
