import { describe, expect, it } from 'vitest';
import { gompertz, run, spec } from './gompertz-tumor';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('gompertz-tumor', () => {
  it('the closed form starts at N₀ and rises monotonically toward K', () => {
    const n0 = 0.01;
    const k = 1;
    expect(gompertz(0, n0, k, 0.2)).toBeCloseTo(n0, 9);
    let prev = -1;
    for (let t = 0; t <= 60; t += 2) {
      const s = gompertz(t, n0, k, 0.2);
      expect(s).toBeGreaterThanOrEqual(prev);
      expect(s).toBeLessThanOrEqual(k + 1e-9);
      prev = s;
    }
    expect(gompertz(500, n0, k, 0.2)).toBeCloseTo(k, 6); // saturates at capacity
  });

  it('growth is fastest at the inflection size K/e (≈37% of capacity)', () => {
    const r = run({ carryingCapacity: 1, initialSize: 0.01, growthRate: 0.2, tEnd: 40 });
    expect(metric(r, 'inflectionSize')).toBeCloseTo(1 / Math.E, 9);
    expect(metric(r, 'peakGrowthRate')).toBeCloseTo(0.2 / Math.E, 9);
    // the growth-rate series peaks at the inflection size, not at the start or end
    const size = r.series?.[0]?.y.size ?? [];
    const growth = r.series?.[0]?.y.growthRate ?? [];
    const iPeak = growth.indexOf(Math.max(...growth));
    expect(size[iPeak]).toBeGreaterThan(0.25);
    expect(size[iPeak]).toBeLessThan(0.5);
  });

  it('a bigger growth constant fills more of the capacity by the deadline (monotonic knob)', () => {
    const slow = run({ initialSize: 0.01, carryingCapacity: 1, growthRate: 0.1, tEnd: 10 });
    const fast = run({ initialSize: 0.01, carryingCapacity: 1, growthRate: 0.4, tEnd: 10 });
    expect(metric(fast, 'fractionOfCapacity')).toBeGreaterThan(metric(slow, 'fractionOfCapacity'));
    // the daily challenge tunes b to hit fraction 0.5 near b≈0.19
    expect(
      metric(
        run({ initialSize: 0.01, carryingCapacity: 1, growthRate: 0.19, tEnd: 10 }),
        'fractionOfCapacity',
      ),
    ).toBeCloseTo(0.5, 2);
  });

  it('reports inflection time only while still below K/e, else 0', () => {
    // N0 well below K/e ⇒ a positive inflection time
    expect(
      metric(run({ initialSize: 0.01, carryingCapacity: 1, growthRate: 0.2 }), 'inflectionTime'),
    ).toBeGreaterThan(0);
    // N0 above K/e (already past the steepest point) ⇒ 0
    expect(
      metric(run({ initialSize: 0.9, carryingCapacity: 1, growthRate: 0.2 }), 'inflectionTime'),
    ).toBe(0);
  });

  it('handles a shrinking population (N₀ above capacity) and stays finite', () => {
    const r = run({ initialSize: 10, carryingCapacity: 1, growthRate: 0.2, tEnd: 40 });
    expect(metric(r, 'finalSize')).toBeLessThan(10);
    expect(metric(r, 'finalSize')).toBeGreaterThan(1 - 1e-6); // decays toward K, not below
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
  });

  it('rejects denormal inputs and stays finite at the schema bounds (log-difference guard)', () => {
    expect(() => run({ initialSize: 5e-324 })).toThrow();
    expect(() => run({ growthRate: 5e-324 })).toThrow();
    // tiny N₀ over huge K would make log(N₀/K) underflow; the log-difference form stays finite
    const r = run({ initialSize: 1e-9, carryingCapacity: 1e12, growthRate: 10, tEnd: 1e9 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.size ?? []) expect(Number.isFinite(y)).toBe(true);
    for (const y of r.series?.[0]?.y.growthRate ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the growth + growth-rate curves and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.size).toHaveLength(40);
    expect(r.series?.[0]?.y.growthRate).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('gompertz-tumor');
    expect(spec.domain).toBe('systems-biology');
  });
});
