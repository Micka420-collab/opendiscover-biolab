import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { nicholsonBaileyEquilibrium, run } from './nicholson-bailey';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('nicholson-bailey', () => {
  it('has the exact coexistence equilibrium P*=lnR/a, H*=R·lnR/(a·c·(R−1))', () => {
    const eq = nicholsonBaileyEquilibrium(2, 0.1, 1);
    expect(eq?.parasitoid).toBeCloseTo(Math.log(2) / 0.1, 10);
    expect(eq?.host).toBeCloseTo((2 * Math.log(2)) / (0.1 * 1 * (2 - 1)), 10);
  });

  it('has no coexistence equilibrium when R <= 1', () => {
    expect(nicholsonBaileyEquilibrium(1, 0.1, 1)).toBeNull();
    expect(nicholsonBaileyEquilibrium(0.8, 0.1, 1)).toBeNull();
  });

  it('is always unstable — a near-equilibrium start diverges into a host outbreak', () => {
    const r = run({
      reproduction: 2,
      searchEfficiency: 0.05,
      parasitoidsPerHost: 1,
      host0: 24,
      parasitoid0: 12,
      generations: 50,
    });
    // Host peaks far above the equilibrium (~27.7) — the classic divergent oscillation.
    expect(metric(r, 'outbreakRatio')).toBeGreaterThan(3);
    expect(metric(r, 'peakHost')).toBeGreaterThan(3 * metric(r, 'hostEquilibrium'));
  });

  it('keeps all populations finite (no overflow to Infinity/NaN)', () => {
    const r = run({ reproduction: 3, searchEfficiency: 0.02, generations: 80 });
    for (const s of r.series ?? []) {
      for (const key of Object.keys(s.y)) {
        for (const v of s.y[key]) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('gives a finite equilibrium and a divergent (not zero) outbreak for astronomically large R', () => {
    // R·lnR would overflow; the rearranged formula stays finite (~14184).
    const eq = nicholsonBaileyEquilibrium(1e308, 0.05, 1);
    expect(eq?.host).toBeCloseTo(Math.log(1e308) / 0.05, 5);
    // The map's overflow clamps to the ceiling (not 0 = false extinction).
    const r = run({
      reproduction: 1e308,
      searchEfficiency: 0.05,
      parasitoidsPerHost: 1,
      generations: 5,
    });
    expect(metric(r, 'peakHost')).toBeGreaterThan(1e11);
    expect(metric(r, 'outbreakRatio')).toBeGreaterThan(1);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('nicholson-bailey', { reproduction: 2.5, searchEfficiency: 0.03 });
    const b = runEngine('nicholson-bailey', { reproduction: 2.5, searchEfficiency: 0.03 });
    expect(a).toEqual(b);
  });
});
