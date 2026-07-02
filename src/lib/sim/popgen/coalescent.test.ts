import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { coalescentTimes, harmonic, run } from './coalescent';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('coalescent', () => {
  it('E[T_MRCA] = 2(1 − 1/n)', () => {
    expect(metric(run({ sampleSize: 2 }), 'expectedTMRCA')).toBeCloseTo(1, 12); // 2(1−1/2)
    expect(metric(run({ sampleSize: 10 }), 'expectedTMRCA')).toBeCloseTo(1.8, 12);
    expect(metric(run({ sampleSize: 1000 }), 'expectedTMRCA')).toBeCloseTo(2 * (1 - 1 / 1000), 12);
  });

  it('E[total tree length] = 2·H_{n−1}', () => {
    expect(metric(run({ sampleSize: 2 }), 'expectedTreeLength')).toBeCloseTo(2, 12); // 2·H_1
    expect(metric(run({ sampleSize: 3 }), 'expectedTreeLength')).toBeCloseTo(3, 12); // 2·(1+1/2)
    expect(metric(run({ sampleSize: 5 }), 'expectedTreeLength')).toBeCloseTo(2 * harmonic(4), 12);
  });

  it('the summed waiting times recover both closed forms (cross-check identities)', () => {
    for (const n of [4, 20, 137]) {
      const times = coalescentTimes(n);
      const sumT = times.reduce((s, t) => s + t.expectedTime, 0);
      const sumKT = times.reduce((s, t) => s + t.k * t.expectedTime, 0);
      expect(sumT).toBeCloseTo(2 * (1 - 1 / n), 10); // Σ E[T_k] = E[T_MRCA]
      expect(sumKT).toBeCloseTo(2 * harmonic(n - 1), 10); // Σ k·E[T_k] = E[L]
    }
  });

  it('Watterson: E[S] = θ·a_n, E[π] = θ, and θ̂_W recovers θ from the expected S', () => {
    const r = run({ sampleSize: 10, theta: 4 });
    const aN = harmonic(9);
    expect(metric(r, 'harmonicNumber')).toBeCloseTo(aN, 12);
    expect(metric(r, 'expectedSegregatingSites')).toBeCloseTo(4 * aN, 12);
    expect(metric(r, 'expectedPairwiseDiversity')).toBeCloseTo(4, 12);
    // With no observed S given, S defaults to round(E[S]); θ̂_W = S/a_n ≈ θ.
    expect(metric(r, 'wattersonTheta')).toBeCloseTo(Math.round(4 * aN) / aN, 12);
    expect(metric(r, 'wattersonTheta')).toBeCloseTo(4, 0);
  });

  it('θ̂_W uses an explicitly observed segregating-site count when given', () => {
    const r = run({ sampleSize: 10, theta: 5, observedSegregatingSites: 20 });
    expect(metric(r, 'wattersonTheta')).toBeCloseTo(20 / harmonic(9), 12);
  });

  it('the last coalescence (T_2) takes ~half of E[T_MRCA]', () => {
    const times = coalescentTimes(50);
    const t2 = times[times.length - 1]; // k = 2
    expect(t2?.k).toBe(2);
    expect(t2?.expectedTime).toBeCloseTo(1, 12); // 2/(2·1)
    // 1 out of E[T_MRCA]=2(1−1/50)=1.96 → ~51%.
    expect((t2?.expectedTime ?? 0) / (2 * (1 - 1 / 50))).toBeGreaterThan(0.5);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('coalescent', { sampleSize: 25, theta: 3 });
    const b = runEngine('coalescent', { sampleSize: 25, theta: 3 });
    expect(a).toEqual(b);
  });
});
