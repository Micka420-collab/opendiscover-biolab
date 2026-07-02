import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { run } from './luria-delbruck';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('luria-delbruck', () => {
  it('expected mutations per culture is m = μ·(Nt − N0)', () => {
    const r = run({ mutationRate: 1e-8, finalSize: 1e8, initialSize: 1 });
    expect(metric(r, 'expectedMutations')).toBeCloseTo(1, 6);
  });

  it('shows the fluctuation signature: variance ≫ mean (not Poisson)', () => {
    const r = run({});
    // A Poisson (induced-mutation) model would give VMR ≈ 1; jackpots blow it up.
    expect(metric(r, 'varianceToMeanRatio')).toBeGreaterThan(20);
    expect(metric(r, 'peakResistant')).toBeGreaterThan(10 * metric(r, 'meanResistant'));
  });

  it('recovers the mutation count via the p0 method, m = −ln(p0)', () => {
    const r = run({});
    // p0 ≈ e^{−m} = e^{−1} ≈ 0.368, so −ln(p0) ≈ 1.
    expect(metric(r, 'p0')).toBeCloseTo(Math.exp(-1), 1);
    expect(metric(r, 'estimatedMutations')).toBeCloseTo(1, 1);
  });

  it('the resistant-count distribution is a valid partition (sums to 1)', () => {
    const r = run({});
    const d = (r.detail as { resistantDistribution: { probability: number }[] })
      .resistantDistribution;
    expect(d.reduce((s, x) => s + x.probability, 0)).toBeCloseTo(1, 10);
  });

  it('is deterministic (same seed → identical result)', () => {
    const a = runEngine('luria-delbruck', { seed: 5, cultures: 500 });
    const b = runEngine('luria-delbruck', { seed: 5, cultures: 500 });
    expect(a).toEqual(b);
  });
});
