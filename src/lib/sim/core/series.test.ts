import { describe, expect, it } from 'vitest';
import { downsampleIndices } from './series';

describe('downsampleIndices', () => {
  it('keeps every point when len <= n', () => {
    expect(downsampleIndices(3, 5)).toEqual([0, 1, 2]);
    expect(downsampleIndices(4, 4)).toEqual([0, 1, 2, 3]);
  });

  it('always includes the first and last index when downsampling', () => {
    const idx = downsampleIndices(401, 400);
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(400);
    expect(idx.length).toBe(400);
  });

  it('for a single requested point returns the FINAL state, not the initial one', () => {
    // Regression: this used to return [0], plotting a stale initial value that
    // contradicted the engine's final-value metric.
    expect(downsampleIndices(2, 1)).toEqual([1]);
    expect(downsampleIndices(500, 1)).toEqual([499]);
  });

  it('handles degenerate sizes without dividing by zero', () => {
    expect(downsampleIndices(1, 1)).toEqual([0]);
    expect(downsampleIndices(1, 400)).toEqual([0]);
    expect(downsampleIndices(0, 5)).toEqual([]);
  });

  it('returns strictly in-range, non-decreasing indices', () => {
    const idx = downsampleIndices(1000, 50);
    expect(idx.length).toBe(50);
    for (let i = 1; i < idx.length; i++) {
      expect(idx[i]).toBeGreaterThanOrEqual(idx[i - 1] as number);
    }
    expect(Math.min(...idx)).toBe(0);
    expect(Math.max(...idx)).toBe(999);
  });
});
