import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { endemicPrevalence, run } from './sis';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('sis', () => {
  it('endemic prevalence is 1 - 1/R0 above threshold, 0 below', () => {
    expect(endemicPrevalence(0.3, 0.1)).toBeCloseTo(1 - 1 / 3, 12); // R0=3
    expect(endemicPrevalence(0.2, 0.1)).toBeCloseTo(0.5, 12); // R0=2
    expect(endemicPrevalence(0.05, 0.1)).toBe(0); // R0=0.5 < 1
    expect(endemicPrevalence(0.1, 0.1)).toBe(0); // R0=1 exactly
  });

  it('settles to the endemic equilibrium when R0 > 1', () => {
    const r = run({ beta: 0.3, gamma: 0.1, i0: 0.01, tEnd: 200 });
    expect(metric(r, 'r0')).toBeCloseTo(3, 12);
    expect(metric(r, 'endemicPrevalence')).toBeCloseTo(1 - 1 / 3, 10);
    expect(metric(r, 'finalPrevalence')).toBeCloseTo(1 - 1 / 3, 3);
    expect(metric(r, 'endemic')).toBe(1);
  });

  it('dies out when R0 <= 1', () => {
    const r = run({ beta: 0.05, gamma: 0.1, i0: 0.01, tEnd: 200 });
    expect(metric(r, 'r0')).toBeCloseTo(0.5, 12);
    expect(metric(r, 'endemicPrevalence')).toBe(0);
    expect(metric(r, 'finalPrevalence')).toBeLessThan(0.001);
    expect(metric(r, 'endemic')).toBe(0);
  });

  it('keeps the prevalence within [0, 1]', () => {
    const r = run({ beta: 0.8, gamma: 0.1, i0: 0.5 });
    for (const s of r.series ?? []) {
      for (const key of Object.keys(s.y)) {
        for (const v of s.y[key]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('sis', { beta: 0.4, gamma: 0.15 });
    const b = runEngine('sis', { beta: 0.4, gamma: 0.15 });
    expect(a).toEqual(b);
  });
});
