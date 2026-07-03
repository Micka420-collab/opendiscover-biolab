import { describe, expect, it } from 'vitest';
import { formatMetric } from './result-view';

describe('formatMetric — human-friendly metric display', () => {
  it('groups large integers with commas (locale-pinned)', () => {
    expect(formatMetric(17952)).toBe('17,952');
    expect(formatMetric(100000)).toBe('100,000');
    expect(formatMetric(9900)).toBe('9,900');
    expect(formatMetric(50)).toBe('50');
    expect(formatMetric(0)).toBe('0');
  });

  it('trims mid-range values to four significant figures', () => {
    expect(formatMetric(285.714)).toBe('285.7');
    expect(formatMetric(0.4931)).toBe('0.4931');
    expect(formatMetric(0.0876)).toBe('0.0876');
    expect(formatMetric(-2.60149)).toBe('-2.601');
    expect(formatMetric(707.107)).toBe('707.1');
  });

  it('uses exponential only at the extremes (tiny or huge magnitudes)', () => {
    expect(formatMetric(1.23e-9)).toBe('1.230e-9');
    expect(formatMetric(3.9e26)).toBe('3.900e+26'); // huge integer-valued → sci, not a comma monster
    expect(formatMetric(5e-5)).toBe('5.000e-5');
  });

  it('never produces a comma-monster for a huge whole number', () => {
    expect(formatMetric(3.9e26)).not.toContain(',');
    expect(formatMetric(1e18).length).toBeLessThan(12);
  });

  it('passes non-finite values straight through (defensive; engines never emit these)', () => {
    expect(formatMetric(Number.POSITIVE_INFINITY)).toBe('Infinity');
    expect(formatMetric(Number.NaN)).toBe('NaN');
  });
});
