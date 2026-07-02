import { describe, expect, it } from 'vitest';
import { finalSizeGivenS0, run, spec } from './vaccination';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('vaccination (herd immunity)', () => {
  it('critical coverage = (1 − 1/R₀)/ε (classic 1 − 1/R₀ for a perfect vaccine)', () => {
    const perfect = run({ r0: 4, coverage: 0, efficacy: 1 });
    expect(metric(perfect, 'criticalCoverage')).toBeCloseTo(1 - 1 / 4, 12); // 0.75
    const imperfect = run({ r0: 4, coverage: 0, efficacy: 0.8 });
    expect(metric(imperfect, 'criticalCoverage')).toBeCloseTo((1 - 1 / 4) / 0.8, 12); // 0.9375
  });

  it('final size is 0 exactly at and above the herd-immunity threshold', () => {
    // R0=3, ε=1 → v_c = 2/3. At v=0.7 (> v_c) no outbreak; at v=0.6 (< v_c) an outbreak.
    const above = run({ r0: 3, coverage: 0.7, efficacy: 1 });
    const below = run({ r0: 3, coverage: 0.6, efficacy: 1 });
    expect(metric(above, 'finalSize')).toBe(0);
    expect(metric(above, 'herdImmunity')).toBe(1);
    expect(metric(below, 'finalSize')).toBeGreaterThan(0);
    expect(metric(below, 'herdImmunity')).toBe(0);
  });

  it('final size solves z = s₀·(1 − e^(−R₀·z)) at the returned root', () => {
    const r0 = 3;
    const s0 = 0.8;
    const z = finalSizeGivenS0(r0, s0);
    expect(z).toBeGreaterThan(0);
    expect(z).toBeLessThanOrEqual(s0);
    expect(s0 * (1 - Math.exp(-r0 * z))).toBeCloseTo(z, 9); // residual ≈ 0
  });

  it('R_eff ≤ 1 ⇒ no epidemic (final size exactly 0)', () => {
    expect(finalSizeGivenS0(0.9, 1)).toBe(0); // R0 < 1
    expect(finalSizeGivenS0(3, 1 / 3)).toBe(0); // R_eff = R0·s0 = 1
    expect(finalSizeGivenS0(3, 0.3)).toBe(0); // R_eff = 0.9 < 1
  });

  it('final size decreases monotonically as coverage rises', () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let v = 0; v <= 1.0001; v += 0.1) {
      const fs = metric(run({ r0: 5, coverage: Math.min(v, 1), efficacy: 0.9 }), 'finalSize');
      expect(fs).toBeLessThanOrEqual(prev + 1e-12);
      prev = fs;
    }
  });

  it('R_eff = R₀·(1 − εv) and effective R drops below 1 at the threshold', () => {
    const r = run({ r0: 4, coverage: 0.75, efficacy: 1 }); // exactly v_c
    expect(metric(r, 'effectiveR')).toBeCloseTo(4 * (1 - 0.75), 12); // = 1
  });

  it('a weak vaccine against a very transmissible disease cannot eradicate (v_c > 1)', () => {
    // R0=10, ε=0.5 → v_c = (1−0.1)/0.5 = 1.8 > 1.
    const r = run({ r0: 10, coverage: 1, efficacy: 0.5 });
    expect(metric(r, 'criticalCoverage')).toBeGreaterThan(1);
    expect(metric(r, 'herdImmunity')).toBe(0); // even full coverage fails
    expect(metric(r, 'finalSize')).toBeGreaterThan(0);
  });

  it('cases prevented = final size without vaccination minus with, and is ≥ 0', () => {
    const r = run({ r0: 3, coverage: 0.4, efficacy: 0.9 });
    const withVax = metric(r, 'finalSize');
    const noVax = metric(r, 'finalSizeNoVax');
    expect(metric(r, 'casesPrevented')).toBeCloseTo(noVax - withVax, 10);
    expect(metric(r, 'casesPrevented')).toBeGreaterThanOrEqual(0);
  });

  it('R₀ ≤ 1 needs no vaccination (v_c clamped to 0, no baseline epidemic)', () => {
    const r = run({ r0: 0.8, coverage: 0, efficacy: 0.9 });
    expect(metric(r, 'criticalCoverage')).toBe(0);
    expect(metric(r, 'finalSizeNoVax')).toBe(0);
    expect(metric(r, 'herdImmunity')).toBe(1);
  });

  it('exposes a coverage-response curve and is deterministic', () => {
    const r = run({ r0: 3, coverage: 0.5, efficacy: 0.95, outputPoints: 50 });
    expect(r.series?.[0]?.x).toHaveLength(50);
    expect(r.series?.[0]?.y.finalSize).toHaveLength(50);
    expect(r.series?.[0]?.y.effectiveR).toHaveLength(50);
    expect(run({ r0: 3, coverage: 0.5, efficacy: 0.95 })).toEqual(
      run({ r0: 3, coverage: 0.5, efficacy: 0.95 }),
    );
    expect(spec.slug).toBe('vaccination');
    expect(spec.domain).toBe('epidemiology');
  });
});
