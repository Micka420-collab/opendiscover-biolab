import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { CHI2_CRIT_DF1, chiSquare, run } from './hardy-weinberg';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('hardy-weinberg', () => {
  it('estimates allele frequency p = (2·nAA + nAa) / 2N', () => {
    const r = run({ countAA: 30, countAa: 40, countaa: 30 });
    // (60 + 40) / 200 = 0.5
    expect(metric(r, 'freqA')).toBeCloseTo(0.5, 10);
    expect(metric(r, 'freqa')).toBeCloseTo(0.5, 10);
  });

  it('accepts a population in perfect HW proportions (χ² = 0, not rejected)', () => {
    // p=0.6 → 36 : 48 : 16 out of 100 is exactly p²:2pq:q².
    const r = run({ countAA: 36, countAa: 48, countaa: 16 });
    expect(metric(r, 'chiSquare')).toBeCloseTo(0, 8);
    expect(metric(r, 'rejectedHW')).toBe(0);
    expect(metric(r, 'inbreedingCoefficient')).toBeCloseTo(0, 8);
    expect(metric(r, 'freqA')).toBeCloseTo(0.6, 10);
  });

  it('rejects a strong heterozygote deficit and reports F = 1', () => {
    // All homozygotes, no heterozygotes: maximal inbreeding signal.
    const r = run({ countAA: 50, countAa: 0, countaa: 50 });
    expect(metric(r, 'freqA')).toBeCloseTo(0.5, 10);
    expect(metric(r, 'chiSquare')).toBeCloseTo(100, 6); // 25 + 50 + 25
    expect(metric(r, 'chiSquare')).toBeGreaterThan(CHI2_CRIT_DF1);
    expect(metric(r, 'rejectedHW')).toBe(1);
    expect(metric(r, 'inbreedingCoefficient')).toBeCloseTo(1, 10);
  });

  it('genotype distributions are valid partitions (sum to 1) so they auto-chart', () => {
    const r = run({ countAA: 35, countAa: 48, countaa: 17 });
    const d = r.detail as {
      observedGenotypeDistribution: { probability: number }[];
      expectedGenotypeDistribution: { probability: number }[];
    };
    const sum = (a: { probability: number }[]) => a.reduce((s, x) => s + x.probability, 0);
    expect(sum(d.observedGenotypeDistribution)).toBeCloseTo(1, 10);
    expect(sum(d.expectedGenotypeDistribution)).toBeCloseTo(1, 10);
  });

  it('chiSquare skips zero-expectation classes', () => {
    expect(chiSquare([0, 10], [0, 10])).toBe(0);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('hardy-weinberg', { countAA: 12, countAa: 55, countaa: 33 });
    const b = runEngine('hardy-weinberg', { countAA: 12, countAa: 55, countaa: 33 });
    expect(a).toEqual(b);
  });
});
