import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { equilibriumOccupancy, run } from './levins-metapopulation';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('levins-metapopulation', () => {
  it('equilibrium occupancy is p* = h − e/c above the threshold, else 0', () => {
    expect(equilibriumOccupancy(0.5, 0.1, 0)).toBeCloseTo(0.8, 10); // h=1
    expect(equilibriumOccupancy(0.5, 0.1, 0.5)).toBeCloseTo(0.3, 10); // h=0.5
    expect(equilibriumOccupancy(0.5, 0.1, 0.85)).toBe(0); // h=0.15 < e/c=0.2
  });

  it('reports the extinction threshold (max destroyable fraction = 1 − e/c)', () => {
    const r = run({ colonization: 0.5, extinction: 0.1 });
    expect(metric(r, 'extinctionThreshold')).toBeCloseTo(0.8, 10);
  });

  it('converges to the equilibrium occupancy', () => {
    const r = run({ colonization: 0.5, extinction: 0.1, destroyed: 0, p0: 0.1, tEnd: 200 });
    expect(metric(r, 'finalOccupancy')).toBeCloseTo(0.8, 3);
    expect(metric(r, 'persists')).toBe(1);
  });

  it('collapses to regional extinction past the habitat threshold', () => {
    const r = run({ colonization: 0.5, extinction: 0.1, destroyed: 0.85, tEnd: 200 });
    expect(metric(r, 'equilibriumOccupancy')).toBe(0);
    expect(metric(r, 'persists')).toBe(0);
    expect(metric(r, 'finalOccupancy')).toBeLessThan(0.01);
  });

  it('keeps occupancy within [0, 1]', () => {
    const r = run({ colonization: 0.9, extinction: 0.05, destroyed: 0.2 });
    for (const s of r.series ?? []) {
      for (const v of s.y.occupied) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('a single-point series reports the FINAL occupancy, not the stale initial p0 (regression)', () => {
    const r = run({
      colonization: 0.5,
      extinction: 0.1,
      destroyed: 0,
      p0: 0.1,
      tEnd: 200,
      outputPoints: 1,
    });
    const s = r.series?.[0];
    const lastValue = s?.y.occupied.at(-1) ?? Number.NaN;
    // The one kept point must be the converged state (≈ finalOccupancy), not p0=0.1.
    expect(lastValue).toBeCloseTo(metric(r, 'finalOccupancy'), 10);
    expect(lastValue).toBeGreaterThan(0.5);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('levins-metapopulation', { colonization: 0.6, extinction: 0.2 });
    const b = runEngine('levins-metapopulation', { colonization: 0.6, extinction: 0.2 });
    expect(a).toEqual(b);
  });
});
