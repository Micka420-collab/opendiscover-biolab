import { describe, expect, it } from 'vitest';
import { run, spec, sternVolmerRatio } from './stern-volmer';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('stern-volmer (fluorescence quenching)', () => {
  it('no quencher means full brightness (F₀/F = 1)', () => {
    expect(sternVolmerRatio(10, 0)).toBe(1);
    const r = run({ ksv: 10, quencher: 0, f0: 100 });
    expect(metric(r, 'fluorescence')).toBeCloseTo(100, 12);
    expect(metric(r, 'fractionRemaining')).toBeCloseTo(1, 12);
    expect(metric(r, 'quenchingEfficiency')).toBeCloseTo(0, 12);
  });

  it('is exactly half-quenched at [Q] = 1/K_SV', () => {
    const r = run({ ksv: 10, quencher: 0.1, f0: 100 });
    expect(metric(r, 'sternVolmerRatio')).toBeCloseTo(2, 12);
    expect(metric(r, 'fractionRemaining')).toBeCloseTo(0.5, 12);
    expect(metric(r, 'quencherForHalf')).toBeCloseTo(0.1, 12);
  });

  it('F₀/F rises linearly with quencher (slope K_SV)', () => {
    const a = sternVolmerRatio(10, 0.2);
    const b = sternVolmerRatio(10, 0.4);
    expect((b - a) / (0.4 - 0.2)).toBeCloseTo(10, 12); // slope = K_SV
  });

  it('remaining glow falls monotonically and stays in (0,1]', () => {
    let prev = 2;
    for (let q = 0; q <= 1; q += 0.05) {
      const frac = 1 / sternVolmerRatio(10, q);
      expect(frac).toBeGreaterThan(0);
      expect(frac).toBeLessThanOrEqual(1);
      expect(frac).toBeLessThanOrEqual(prev);
      prev = frac;
    }
  });

  it('a stronger quencher (bigger K_SV) dims more at the same concentration', () => {
    expect(1 / sternVolmerRatio(50, 0.1)).toBeLessThan(1 / sternVolmerRatio(5, 0.1));
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ ksv: 5e-324 })).toThrow();
    expect(() => run({ f0: 1e-160 })).toThrow();
    const r = run({ ksv: 1e6, quencher: 1e6, f0: 1e9, quencherMax: 1e6 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.ratio ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the Stern–Volmer + fluorescence curves and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.ratio).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('stern-volmer');
    expect(spec.domain).toBe('structural');
  });
});
