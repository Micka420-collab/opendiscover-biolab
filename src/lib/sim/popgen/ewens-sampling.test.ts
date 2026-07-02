import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { alleleSpectrum, expectedAlleles, run } from './ewens-sampling';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('ewens-sampling', () => {
  it('computes E[K_n] = Σ θ/(θ+i) (θ=1, n=2 → 1.5)', () => {
    expect(expectedAlleles(2, 1)).toBeCloseTo(1.5, 12); // 1/1 + 1/2
    expect(expectedAlleles(3, 1)).toBeCloseTo(1 + 1 / 2 + 1 / 3, 12);
    // With θ large, almost every gene is its own allele → E[K] → n.
    expect(expectedAlleles(10, 1e6)).toBeGreaterThan(9.99);
  });

  it('spectrum satisfies Σ E[a_j] = E[K_n] (identity)', () => {
    for (const [n, theta] of [
      [50, 1],
      [30, 3.5],
      [100, 0.7],
    ] as const) {
      const total = alleleSpectrum(n, theta).reduce((s, x) => s + x, 0);
      expect(total).toBeCloseTo(expectedAlleles(n, theta), 8);
    }
  });

  it('spectrum satisfies Σ j·E[a_j] = n (every gene is in some allele class)', () => {
    for (const [n, theta] of [
      [50, 1],
      [40, 5],
      [200, 2],
    ] as const) {
      const spec = alleleSpectrum(n, theta);
      const totalGenes = spec.reduce((s, x, i) => s + (i + 1) * x, 0);
      expect(totalGenes).toBeCloseTo(n, 6);
    }
  });

  it('reports homozygosity 1/(1+θ) and effective alleles 1+θ', () => {
    const r = run({ sampleSize: 50, theta: 1 });
    expect(metric(r, 'expectedHomozygosity')).toBeCloseTo(0.5, 12);
    expect(metric(r, 'effectiveAlleles')).toBeCloseTo(2, 12);
    const r2 = run({ sampleSize: 80, theta: 4 });
    expect(metric(r2, 'expectedHomozygosity')).toBeCloseTo(0.2, 12);
  });

  it('reports singletons E[a₁] = nθ/(θ+n−1) and it matches the spectrum head', () => {
    const r = run({ sampleSize: 50, theta: 2 });
    const e1 = (50 * 2) / (2 + 50 - 1);
    expect(metric(r, 'expectedSingletons')).toBeCloseTo(e1, 12);
    expect(r.series?.[0]?.y.expectedCount[0]).toBeCloseTo(e1, 12);
  });

  it('every expected count is non-negative', () => {
    const r = run({ sampleSize: 120, theta: 3 });
    for (const v of r.series?.[0]?.y.expectedCount ?? []) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('ewens-sampling', { sampleSize: 60, theta: 2.5 });
    const b = runEngine('ewens-sampling', { sampleSize: 60, theta: 2.5 });
    expect(a).toEqual(b);
  });
});
