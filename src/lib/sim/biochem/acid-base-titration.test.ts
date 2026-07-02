import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { run, solveProton } from './acid-base-titration';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('acid-base-titration', () => {
  it('pH at half-equivalence ≈ pKa (Henderson–Hasselbalch; exact within ~0.02)', () => {
    // The exact charge-balance pH at half-equivalence is only approximately pKa —
    // closer for weaker acids, ~0.02 off for a stronger one (pKa 3.2).
    for (const pKa of [3.2, 4.76, 7.4]) {
      expect(
        metric(run({ pKa, acidConc: 0.1, acidVolume: 25, baseConc: 0.1 }), 'phAtHalfEquivalence'),
      ).toBeCloseTo(pKa, 1);
    }
    // For a weak acid it is essentially exact.
    expect(metric(run({ pKa: 7.4 }), 'phAtHalfEquivalence')).toBeCloseTo(7.4, 2);
  });

  it('equivalence volume is Ca·Va/Cb', () => {
    expect(
      metric(run({ acidConc: 0.1, acidVolume: 25, baseConc: 0.1 }), 'equivalenceVolume'),
    ).toBeCloseTo(25, 10);
    expect(
      metric(run({ acidConc: 0.2, acidVolume: 30, baseConc: 0.1 }), 'equivalenceVolume'),
    ).toBeCloseTo(60, 10);
  });

  it('the equivalence pH is above 7 (weak acid + strong base)', () => {
    const r = run({ pKa: 4.76, acidConc: 0.1, acidVolume: 25, baseConc: 0.1 });
    expect(metric(r, 'phAtEquivalence')).toBeGreaterThan(7);
    expect(metric(r, 'phAtEquivalence')).toBeCloseTo(8.73, 1); // 0.05 M acetate
  });

  it('the initial pH matches the weak-acid formula ½(pKa − log Ca)', () => {
    const r = run({ pKa: 4.76, acidConc: 0.1 });
    expect(metric(r, 'initialPH')).toBeCloseTo(0.5 * (4.76 - Math.log10(0.1)), 2); // ≈ 2.88
  });

  it('pH rises monotonically as base is added', () => {
    const r = run({ pKa: 4.76, acidConc: 0.1, acidVolume: 25, baseConc: 0.1 });
    const phs = r.series?.[0]?.y.pH ?? [];
    for (let i = 1; i < phs.length; i++)
      expect(phs[i]).toBeGreaterThanOrEqual((phs[i - 1] as number) - 1e-9);
  });

  it('solveProton satisfies the charge balance it solves', () => {
    const ka = 10 ** -4.76;
    const h = solveProton(0.02, 0.04, ka);
    const residual = 0.02 + h - 1e-14 / h - (0.04 * ka) / (ka + h);
    expect(residual).toBeCloseTo(0, 8);
    expect(h).toBeGreaterThan(0);
  });

  it('pH stays finite across the whole curve, even for a very weak acid', () => {
    const r = run({ pKa: 9.2, acidConc: 0.05, acidVolume: 40, baseConc: 0.05 });
    for (const v of r.series?.[0]?.y.pH ?? []) expect(Number.isFinite(v)).toBe(true);
    // The H–H anchor still holds: half-equivalence pH ≈ pKa even at pKa 9.2.
    expect(metric(r, 'phAtHalfEquivalence')).toBeCloseTo(9.2, 1);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('acid-base-titration', { pKa: 5, acidConc: 0.15 });
    const b = runEngine('acid-base-titration', { pKa: 5, acidConc: 0.15 });
    expect(a).toEqual(b);
  });
});
