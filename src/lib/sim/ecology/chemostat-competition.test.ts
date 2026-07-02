import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { breakEvenSubstrate, run } from './chemostat-competition';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('chemostat-competition', () => {
  it('computes the break-even substrate R* = Ks·D/(µmax−D)', () => {
    expect(breakEvenSubstrate(0.5, 1, 0.2)).toBeCloseTo((1 * 0.2) / (0.5 - 0.2), 10); // 0.667
    expect(breakEvenSubstrate(0.5, 3, 0.2)).toBeCloseTo(2, 10);
    expect(breakEvenSubstrate(0.1, 1, 0.2)).toBe(Number.POSITIVE_INFINITY); // µmax < D
  });

  it('the lower-R* species wins and excludes the other (species 1)', () => {
    const r = run({ ks1: 1, ks2: 3 }); // R*1=0.667 < R*2=2.0
    expect(metric(r, 'winner')).toBe(1);
    expect(metric(r, 'finalBiomass1')).toBeGreaterThan(3);
    expect(metric(r, 'finalBiomass2')).toBeLessThan(0.01);
  });

  it('competitive exclusion works the other way too (species 2 wins)', () => {
    const r = run({ ks1: 3, ks2: 1 }); // R*2 now lower
    expect(metric(r, 'winner')).toBe(2);
    expect(metric(r, 'finalBiomass2')).toBeGreaterThan(3);
    expect(metric(r, 'finalBiomass1')).toBeLessThan(0.01);
  });

  it('both species wash out when the dilution exceeds both max growth rates', () => {
    const r = run({ d: 0.6 }); // > µmax = 0.5 for both
    expect(metric(r, 'winner')).toBe(0);
    expect(metric(r, 'finalBiomass1')).toBeLessThan(0.01);
    expect(metric(r, 'finalBiomass2')).toBeLessThan(0.01);
  });

  it('keeps substrate and biomass non-negative', () => {
    const r = run({ ks1: 1, ks2: 2 });
    for (const s of r.series ?? []) {
      for (const key of Object.keys(s.y)) {
        for (const v of s.y[key]) expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('chemostat-competition', { ks1: 1.5, ks2: 2.5 });
    const b = runEngine('chemostat-competition', { ks1: 1.5, ks2: 2.5 });
    expect(a).toEqual(b);
  });
});
