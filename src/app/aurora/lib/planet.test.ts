import { CHALLENGE_POOL } from '@/lib/lab/daily-challenge';
import { describe, expect, it } from 'vitest';
import { TOTAL_BEACONS, auroraIndex, decodeLit, encodeLit, planetFor } from './planet';

describe('aurora planet', () => {
  it('gives every pooled challenge a finite, on-globe beacon with copy', () => {
    for (const c of CHALLENGE_POOL) {
      const p = planetFor(c.id);
      expect(Number.isFinite(p.lat), c.id).toBe(true);
      expect(p.lat).toBeGreaterThanOrEqual(-90);
      expect(p.lat).toBeLessThanOrEqual(90);
      expect(Number.isFinite(p.lon), c.id).toBe(true);
      expect(p.lon).toBeGreaterThanOrEqual(-180);
      expect(p.lon).toBeLessThanOrEqual(180);
      expect(p.region.length).toBeGreaterThan(0);
      expect(p.whyEarthNeedsIt.length).toBeGreaterThan(0);
    }
  });

  it('round-trips the ?lit= relay bitmask', () => {
    const seven = CHALLENGE_POOL.slice(0, 7).map((c) => c.id);
    expect(decodeLit(encodeLit(seven))).toEqual(new Set(seven));
    expect(decodeLit(encodeLit([])).size).toBe(0);
    expect(decodeLit(null).size).toBe(0);
    expect(decodeLit('!!!').size).toBe(0);
    const all = CHALLENGE_POOL.map((c) => c.id);
    expect(decodeLit(encodeLit(all))).toEqual(new Set(all));
  });

  it('computes the AURORA index as lit / total', () => {
    expect(TOTAL_BEACONS).toBe(CHALLENGE_POOL.length);
    expect(auroraIndex(0)).toBe(0);
    expect(auroraIndex(TOTAL_BEACONS)).toBe(1);
    expect(auroraIndex(TOTAL_BEACONS / 2)).toBeCloseTo(0.5, 10);
    expect(auroraIndex(TOTAL_BEACONS * 2)).toBe(1); // clamped
  });
});
