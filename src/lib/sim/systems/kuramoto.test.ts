import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { criticalCoupling, orderParameter, run } from './kuramoto';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('kuramoto', () => {
  it('order parameter is 1 for identical phases and ~0 for evenly spread phases', () => {
    expect(orderParameter([0.7, 0.7, 0.7, 0.7]).r).toBeCloseTo(1, 10);
    // Four phases at 0, π/2, π, 3π/2 cancel exactly.
    const spread = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    expect(orderParameter(spread).r).toBeCloseTo(0, 10);
  });

  it('uses the Gaussian critical coupling Kc = 2σ√(2π)/π', () => {
    expect(criticalCoupling(1)).toBeCloseTo(1.5958, 3);
    expect(criticalCoupling(2)).toBeCloseTo(3.1915, 3);
  });

  it('stays incoherent with no coupling (K = 0)', () => {
    const r = run({ oscillators: 100, coupling: 0, freqSpread: 1, tEnd: 40, seed: 'k0' });
    expect(metric(r, 'meanOrderParameter')).toBeLessThan(0.35);
    expect(metric(r, 'synchronized')).toBe(0);
  });

  it('synchronizes for strong coupling (K ≫ Kc)', () => {
    const r = run({ oscillators: 100, coupling: 8, freqSpread: 1, tEnd: 60, seed: 'k8' });
    expect(metric(r, 'meanOrderParameter')).toBeGreaterThan(0.8);
    expect(metric(r, 'synchronized')).toBe(1);
  });

  it('coherence rises with coupling strength', () => {
    const weak = run({ oscillators: 100, coupling: 0, freqSpread: 1, seed: 's' });
    const strong = run({ oscillators: 100, coupling: 8, freqSpread: 1, tEnd: 60, seed: 's' });
    expect(metric(strong, 'meanOrderParameter')).toBeGreaterThan(
      metric(weak, 'meanOrderParameter'),
    );
  });

  it('keeps the order parameter within [0, 1]', () => {
    const r = run({ oscillators: 50, coupling: 3 });
    for (const s of r.series ?? []) {
      for (const v of s.y.coherence) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('is deterministic (same seed → identical result)', () => {
    const a = runEngine('kuramoto', { seed: 42, coupling: 2.5 });
    const b = runEngine('kuramoto', { seed: 42, coupling: 2.5 });
    expect(a).toEqual(b);
  });
});
