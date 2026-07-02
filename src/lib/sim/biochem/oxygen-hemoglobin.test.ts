import { describe, expect, it } from 'vitest';
import { oxygenSaturation, run, spec } from './oxygen-hemoglobin';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('oxygen-hemoglobin (Hill dissociation)', () => {
  it('is exactly half-saturated at p = P₅₀, for any cooperativity', () => {
    expect(oxygenSaturation(26, 26, 2.7)).toBeCloseTo(0.5, 12);
    expect(oxygenSaturation(10, 10, 1)).toBeCloseTo(0.5, 12);
    expect(oxygenSaturation(50, 50, 4)).toBeCloseTo(0.5, 12);
  });

  it('saturation rises monotonically with pO₂ and lives in [0,1]', () => {
    let prev = -1;
    for (let pp = 0; pp <= 120; pp += 5) {
      const y = oxygenSaturation(pp, 26, 2.7);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });

  it('cooperativity (n>1) makes the curve steeper — below P₅₀ lower, above P₅₀ higher', () => {
    // At a pressure below P₅₀ a more cooperative curve sits lower; above P₅₀, higher.
    expect(oxygenSaturation(20, 26, 2.7)).toBeLessThan(oxygenSaturation(20, 26, 1));
    expect(oxygenSaturation(40, 26, 2.7)).toBeGreaterThan(oxygenSaturation(40, 26, 1));
  });

  it('reproduces physiological arterial ≈ 97% and venous ≈ 76% saturation', () => {
    const r = run({ p50: 26, hillCoefficient: 2.7, arterialPO2: 100, venousPO2: 40 });
    expect(metric(r, 'arterialSaturation')).toBeGreaterThan(0.95);
    expect(metric(r, 'arterialSaturation')).toBeLessThan(0.99);
    expect(metric(r, 'venousSaturation')).toBeGreaterThan(0.7);
    expect(metric(r, 'venousSaturation')).toBeLessThan(0.8);
  });

  it('oxygen delivered = arterial − venous saturation', () => {
    const r = run({ arterialPO2: 100, venousPO2: 40 });
    const a = metric(r, 'arterialSaturation');
    const v = metric(r, 'venousSaturation');
    expect(metric(r, 'oxygenDelivered')).toBeCloseTo(a - v, 12);
    expect(metric(r, 'extractionRatio')).toBeCloseTo((a - v) / a, 12);
  });

  it('a right shift (higher P₅₀, the Bohr effect) unloads more O₂ to tissues', () => {
    const normal = run({ p50: 26, arterialPO2: 100, venousPO2: 40 });
    const shifted = run({ p50: 38, arterialPO2: 100, venousPO2: 40 });
    expect(metric(shifted, 'oxygenDelivered')).toBeGreaterThan(metric(normal, 'oxygenDelivered'));
  });

  it('extraction ratio stays finite (0) when saturation collapses to zero', () => {
    const r = run({ arterialPO2: 0, venousPO2: 0 });
    expect(metric(r, 'arterialSaturation')).toBe(0);
    expect(Number.isFinite(metric(r, 'extractionRatio'))).toBe(true);
    expect(metric(r, 'extractionRatio')).toBe(0);
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ p50: 5e-324 })).toThrow();
    expect(() => run({ hillCoefficient: 1e-160 })).toThrow();
    const r = run({ p50: 1000, hillCoefficient: 8, arterialPO2: 1000, pO2Max: 1000 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.saturation ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the dissociation curve and is deterministic', () => {
    const r = run({ outputPoints: 50 });
    expect(r.series?.[0]?.x).toHaveLength(50);
    expect(r.series?.[0]?.y.saturation).toHaveLength(50);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('oxygen-hemoglobin');
    expect(spec.domain).toBe('biochemistry');
  });
});
