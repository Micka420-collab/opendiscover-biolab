import { describe, expect, it } from 'vitest';
import { logisticPop, run, spec } from './microbial-growth';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('microbial-growth (logistic)', () => {
  it('is half the capacity exactly at the inflection time', () => {
    const r = run({ carryingCapacity: 2, growthRate: 0.4, initialPop: 0.01 });
    const tInf = metric(r, 'inflectionTime');
    expect(logisticPop(2, 0.4, 0.01, tInf)).toBeCloseTo(1, 6); // K/2
  });

  it('grows monotonically toward the carrying capacity', () => {
    let prev = -1;
    for (let t = 0; t <= 48; t += 2) {
      const p = logisticPop(2, 0.4, 0.01, t);
      expect(p).toBeGreaterThanOrEqual(prev);
      expect(p).toBeLessThanOrEqual(2 + 1e-9);
      prev = p;
    }
    expect(logisticPop(2, 0.4, 0.01, 1e4)).toBeCloseTo(2, 6); // plateau at K
  });

  it('reports the early doubling time ln2/r and 90% time reaching 0.9K', () => {
    const r = run({ carryingCapacity: 2, growthRate: 0.4, initialPop: 0.01 });
    expect(metric(r, 'doublingTime')).toBeCloseTo(Math.LN2 / 0.4, 9);
    const t90 = metric(r, 'timeTo90Pct');
    expect(logisticPop(2, 0.4, 0.01, t90)).toBeCloseTo(0.9 * 2, 6);
  });

  it('max absolute growth rate is r·K/4', () => {
    expect(metric(run({ carryingCapacity: 2, growthRate: 0.4 }), 'maxAbsGrowthRate')).toBeCloseTo(
      (0.4 * 2) / 4,
      12,
    );
  });

  it('stays finite when the seed already meets or exceeds capacity (no log of ≤0)', () => {
    const r = run({ carryingCapacity: 1, growthRate: 0.5, initialPop: 1e6 }); // P0 ≫ K
    expect(metric(r, 'inflectionTime')).toBe(0);
    expect(metric(r, 'timeTo90Pct')).toBe(0);
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.population ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ growthRate: 5e-324 })).toThrow();
    expect(() => run({ initialPop: 5e-324 })).toThrow();
    const r = run({ carryingCapacity: 1e6, growthRate: 100, initialPop: 1e-9, tEnd: 1e6 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
  });

  it('exposes the growth curve and is deterministic', () => {
    const r = run({ outputPoints: 50 });
    expect(r.series?.[0]?.x).toHaveLength(50);
    expect(r.series?.[0]?.y.population).toHaveLength(50);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('microbial-growth');
    expect(spec.domain).toBe('bioprocess');
  });
});
