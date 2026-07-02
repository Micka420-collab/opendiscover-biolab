import { describe, expect, it } from 'vitest';
import { distanceFromEfficiency, efficiency, run, sensitivity, spec } from './fret';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('fret (Förster molecular ruler)', () => {
  it('efficiency is exactly 50% at the Förster radius', () => {
    expect(efficiency(5, 5)).toBeCloseTo(0.5, 12);
    expect(metric(run({ distance: 5, forsterRadius: 5 }), 'efficiency')).toBeCloseTo(0.5, 12);
  });

  it('E → 1 as r → 0 and E → 0 as r → ∞', () => {
    expect(efficiency(0.01, 5)).toBeGreaterThan(0.999);
    expect(efficiency(50, 5)).toBeLessThan(1e-3);
    expect(efficiency(0, 5)).toBe(1); // exact at contact
  });

  it('the 90% and 10% ruler bounds are R0·(1/9)^(1/6) and R0·9^(1/6)', () => {
    const r0 = 6;
    const r = run({ forsterRadius: r0 });
    const low = metric(r, 'workingRangeLow');
    const high = metric(r, 'workingRangeHigh');
    expect(low).toBeCloseTo(r0 * (1 / 9) ** (1 / 6), 10);
    expect(high).toBeCloseTo(r0 * 9 ** (1 / 6), 10);
    // Those distances really give 90% and 10% efficiency.
    expect(efficiency(low, r0)).toBeCloseTo(0.9, 10);
    expect(efficiency(high, r0)).toBeCloseTo(0.1, 10);
  });

  it('efficiency decreases monotonically with distance and stays in [0,1]', () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let r = 0; r <= 30; r += 0.5) {
      const e = efficiency(r, 5);
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(1);
      expect(e).toBeLessThanOrEqual(prev + 1e-12);
      prev = e;
    }
  });

  it('the ruler inverts: r = R0·((1−E)/E)^(1/6) recovers the distance', () => {
    const r0 = 5.5;
    for (const r of [2, 4, 5.5, 7, 9]) {
      const e = efficiency(r, r0);
      expect(distanceFromEfficiency(e, r0)).toBeCloseTo(r, 9);
    }
  });

  it('the sixth-power law: E(2·R0) = 1/(1+64)', () => {
    expect(efficiency(10, 5)).toBeCloseTo(1 / 65, 12);
  });

  it('sensitivity peaks near R0 and vanishes at both extremes', () => {
    const r0 = 5;
    const nearR0 = sensitivity(5, r0);
    expect(nearR0).toBeGreaterThan(sensitivity(1, r0));
    expect(nearR0).toBeGreaterThan(sensitivity(15, r0));
    expect(sensitivity(0, r0)).toBe(0);
  });

  it('flags whether the queried distance is inside the readable ruler range', () => {
    const inside = run({ distance: 5, forsterRadius: 5 });
    const tooClose = run({ distance: 2, forsterRadius: 5 });
    expect(inside.metrics.find((m) => m.key === 'sensitivity')?.note).toMatch(/good ruler/);
    expect(tooClose.metrics.find((m) => m.key === 'sensitivity')?.note).toMatch(/poor ruler/);
  });

  it('exposes an E-vs-r curve and is deterministic', () => {
    const r = run({ distance: 5, forsterRadius: 5, outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.efficiency).toHaveLength(40);
    expect(r.series?.[0]?.y.sensitivity).toHaveLength(40);
    expect(run({ distance: 5, forsterRadius: 5 })).toEqual(run({ distance: 5, forsterRadius: 5 }));
    expect(spec.slug).toBe('fret');
    expect(spec.domain).toBe('structural');
  });
});
