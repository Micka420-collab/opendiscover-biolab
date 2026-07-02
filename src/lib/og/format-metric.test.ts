import { describe, expect, it } from 'vitest';
import { formatMetric, formatMetricValue } from './format-metric';

describe('formatMetricValue', () => {
  it('groups large numbers instead of using scientific notation', () => {
    expect(formatMetricValue(12345.6)).toBe('12,345.6');
    expect(formatMetricValue(1500000)).toBe('1,500,000');
    expect(formatMetricValue(2333.333)).toBe('2,333.33'); // capped at 2 decimals
    expect(formatMetricValue(-42000)).toBe('-42,000');
  });

  it('shows integers as-is below 1000', () => {
    expect(formatMetricValue(5)).toBe('5');
    expect(formatMetricValue(0)).toBe('0');
    expect(formatMetricValue(-3)).toBe('-3');
    expect(formatMetricValue(999)).toBe('999');
  });

  it('uses 4 significant figures and strips trailing zeros for mid-range decimals', () => {
    expect(formatMetricValue(0.0421)).toBe('0.0421');
    expect(formatMetricValue(0.5)).toBe('0.5'); // not '0.5000'
    expect(formatMetricValue(1.23456)).toBe('1.235');
    expect(formatMetricValue(0.134)).toBe('0.134');
    expect(formatMetricValue(123.456)).toBe('123.5');
    expect(formatMetricValue(-2.5)).toBe('-2.5');
  });

  it('uses a trimmed compact exponent for very small magnitudes', () => {
    expect(formatMetricValue(1e-9)).toBe('1e-9');
    expect(formatMetricValue(1.23e-5)).toBe('1.23e-5');
    expect(formatMetricValue(-1e-9)).toBe('-1e-9');
  });

  it('never emits scientific notation or padded zeros for the readable range', () => {
    for (const v of [0.5, 12345.6, 0.0421, 42, 7.25, 999.9]) {
      const s = formatMetricValue(v);
      expect(s).not.toMatch(/e\+/i); // no positive exponent
      expect(s).not.toMatch(/\.\d*?0+$/); // no trailing-zero padding
    }
  });

  it('guards non-finite values', () => {
    expect(formatMetricValue(Number.NaN)).toBe('—');
    expect(formatMetricValue(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatMetricValue(Number.NEGATIVE_INFINITY)).toBe('—');
  });
});

describe('formatMetric (with unit)', () => {
  it('appends the unit when present', () => {
    expect(formatMetric({ value: 0.42, unit: 'g/L/h' })).toBe('0.42 g/L/h');
    expect(formatMetric({ value: 12345.6 })).toBe('12,345.6');
    expect(formatMetric({ value: 5, unit: 'µM' })).toBe('5 µM');
  });
});
