import { describe, expect, it } from 'vitest';
import { plateHeight, run, spec } from './van-deemter';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('van-deemter (chromatography plate height)', () => {
  it('optimum is u_opt = √(B/C) with H_min = A + 2√(B·C)', () => {
    const a = 0.5;
    const b = 2;
    const c = 0.05;
    const r = run({ aTerm: a, bTerm: b, cTerm: c });
    expect(metric(r, 'optimalVelocity')).toBeCloseTo(Math.sqrt(b / c), 12);
    expect(metric(r, 'minPlateHeight')).toBeCloseTo(a + 2 * Math.sqrt(b * c), 12);
  });

  it('H(u_opt) evaluated on the curve equals the reported H_min', () => {
    const a = 0.5;
    const b = 2;
    const c = 0.05;
    const uOpt = Math.sqrt(b / c);
    expect(plateHeight(uOpt, a, b, c)).toBeCloseTo(a + 2 * Math.sqrt(b * c), 12);
  });

  it('u_opt is a genuine minimum (H rises on both sides)', () => {
    const a = 0.5;
    const b = 2;
    const c = 0.05;
    const uOpt = Math.sqrt(b / c);
    const hMin = plateHeight(uOpt, a, b, c);
    expect(plateHeight(uOpt * 0.5, a, b, c)).toBeGreaterThan(hMin);
    expect(plateHeight(uOpt * 2, a, b, c)).toBeGreaterThan(hMin);
  });

  it('the derivative dH/du = −B/u² + C vanishes at u_opt', () => {
    const b = 2;
    const c = 0.05;
    const uOpt = Math.sqrt(b / c);
    const eps = 1e-6;
    const slope =
      (plateHeight(uOpt + eps, 0.5, b, c) - plateHeight(uOpt - eps, 0.5, b, c)) / (2 * eps);
    expect(slope).toBeCloseTo(0, 6);
  });

  it('plate count N = L / H and efficiency = H_min/H ≤ 1 (=1 at optimum)', () => {
    const r = run({ aTerm: 0.5, bTerm: 2, cTerm: 0.05, velocity: 2, columnLength: 100 });
    const h = metric(r, 'plateHeightAtU');
    expect(metric(r, 'plateCount')).toBeCloseTo(100 / h, 9);
    expect(metric(r, 'efficiencyVsOptimum')).toBeLessThanOrEqual(1 + 1e-12);
    // Running exactly at the optimum gives efficiency 1 and the most plates.
    const atOpt = run({ aTerm: 0.5, bTerm: 2, cTerm: 0.05, velocity: Math.sqrt(2 / 0.05) });
    expect(metric(atOpt, 'efficiencyVsOptimum')).toBeCloseTo(1, 10);
  });

  it('running at the optimum maximizes the plate count', () => {
    const base = { aTerm: 0.5, bTerm: 2, cTerm: 0.05, columnLength: 100 } as const;
    const uOpt = Math.sqrt(2 / 0.05);
    const nOpt = metric(run({ ...base, velocity: uOpt }), 'plateCount');
    expect(nOpt).toBeGreaterThan(metric(run({ ...base, velocity: uOpt * 0.5 }), 'plateCount'));
    expect(nOpt).toBeGreaterThan(metric(run({ ...base, velocity: uOpt * 2 }), 'plateCount'));
  });

  it('the plotted curve avoids the u=0 singularity and stays finite', () => {
    const r = run({ outputPoints: 50, velocityMax: 12 });
    const h = r.series?.[0]?.y.plateHeight ?? [];
    const x = r.series?.[0]?.x ?? [];
    expect(x[0]).toBeGreaterThan(0);
    for (const v of h) expect(Number.isFinite(v)).toBe(true);
  });

  it('smaller B and C shift the optimum and lower H_min', () => {
    const wide = run({ aTerm: 0.5, bTerm: 4, cTerm: 0.1 });
    const tight = run({ aTerm: 0.5, bTerm: 1, cTerm: 0.02 });
    expect(metric(tight, 'minPlateHeight')).toBeLessThan(metric(wide, 'minPlateHeight'));
  });

  it('rejects extreme B/C and tiny velocityMax; u_opt and the curve stay finite (regression)', () => {
    // Previously cTerm=1e-305 passed positive() and √(B/C) overflowed → optimalVelocity=Infinity.
    expect(() => run({ bTerm: 1e4, cTerm: 1e-305 })).toThrow();
    // Previously velocityMax=1e-305 made uMin subnormal and B/uMin overflowed the plotted curve.
    expect(() => run({ velocityMax: 1e-305, outputPoints: 4000, bTerm: 1e4 })).toThrow();
    // At the extreme in-bounds ratio u_opt is still finite (√B/√C form, no √(B/C) overflow).
    const r = run({ bTerm: 1e4, cTerm: 1e-6 });
    expect(Number.isFinite(metric(r, 'optimalVelocity'))).toBe(true);
    expect(r.series?.[0]?.y.plateHeight.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('exposes the van Deemter curve and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.plateHeight).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('van-deemter');
    expect(spec.domain).toBe('biochemistry');
  });
});
