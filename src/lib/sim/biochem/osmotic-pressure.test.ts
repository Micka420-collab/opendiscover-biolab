import { describe, expect, it } from 'vitest';
import { classifyTonicity, osmoticPressureAtm, run, spec } from './osmotic-pressure';

const R_ATM = 0.082057338;
const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('osmotic-pressure (van’t Hoff)', () => {
  it('Π = i·M·R·T and matches ~7.8 atm for physiological saline', () => {
    expect(osmoticPressureAtm(2, 0.154, 37)).toBeCloseTo(2 * 0.154 * R_ATM * 310.15, 12);
    const pi = metric(
      run({ vantHoffFactor: 2, molarity: 0.154, temperatureC: 37 }),
      'osmoticPressure',
    );
    expect(pi).toBeGreaterThan(7);
    expect(pi).toBeLessThan(8.5);
  });

  it('Π scales linearly with molarity, van’t Hoff factor, and absolute temperature', () => {
    expect(osmoticPressureAtm(1, 0.2, 25)).toBeCloseTo(2 * osmoticPressureAtm(1, 0.1, 25), 12);
    expect(osmoticPressureAtm(3, 0.1, 25)).toBeCloseTo(3 * osmoticPressureAtm(1, 0.1, 25), 12);
    // T in kelvin: doubling absolute temperature doubles Π.
    const tLow = -136.575; // ≈ 136.575 K
    const tHigh = 2 * (tLow + 273.15) - 273.15;
    expect(osmoticPressureAtm(1, 0.1, tHigh)).toBeCloseTo(2 * osmoticPressureAtm(1, 0.1, tLow), 12);
  });

  it('osmolarity is i·M', () => {
    expect(metric(run({ vantHoffFactor: 2, molarity: 0.15 }), 'osmolarity')).toBeCloseTo(0.3, 12);
    expect(metric(run({ vantHoffFactor: 3, molarity: 0.1 }), 'osmolarity')).toBeCloseTo(0.3, 12);
  });

  it('tonicity classification matches the exact ±5% boundaries', () => {
    const ref = 0.3;
    expect(classifyTonicity(0.3, ref)).toBe('isotonic'); // exactly at reference
    expect(classifyTonicity(0.3 * 1.04, ref)).toBe('isotonic'); // within +5%
    expect(classifyTonicity(0.3 * 1.06, ref)).toBe('hypertonic'); // beyond +5%
    expect(classifyTonicity(0.3 * 0.96, ref)).toBe('isotonic'); // within −5%
    expect(classifyTonicity(0.3 * 0.94, ref)).toBe('hypotonic'); // beyond −5%
  });

  it('the tonicity note describes the correct cell fate', () => {
    const hyper = run({ vantHoffFactor: 2, molarity: 0.3, referenceOsmolarity: 0.3 }); // 0.6 vs 0.3
    const hypo = run({ vantHoffFactor: 1, molarity: 0.05, referenceOsmolarity: 0.3 }); // 0.05 vs 0.3
    expect(hyper.metrics.find((m) => m.key === 'tonicityRatio')?.note).toMatch(
      /hypertonic.*shrinks/,
    );
    expect(hypo.metrics.find((m) => m.key === 'tonicityRatio')?.note).toMatch(/hypotonic.*swells/);
  });

  it('freezing-point depression is i·Kf·M (≈ −0.57 °C for plasma)', () => {
    expect(
      metric(run({ vantHoffFactor: 2, molarity: 0.154 }), 'freezingPointDepression'),
    ).toBeCloseTo(2 * 1.86 * 0.154, 12);
  });

  it('osmometry: implied molar mass = mass concentration / molarity (recovers NaCl ≈ 58.4)', () => {
    const r = run({ massConcentration: 9, molarity: 0.154 });
    expect(metric(r, 'impliedMolarMass')).toBeCloseTo(9 / 0.154, 9);
    expect(metric(r, 'impliedMolarMass')).toBeGreaterThan(55);
    expect(metric(r, 'impliedMolarMass')).toBeLessThan(62);
  });

  it('rejects denormal inputs (schema-robustness) and stays finite at the bounds', () => {
    expect(() => run({ molarity: 5e-324 })).toThrow();
    expect(() => run({ vantHoffFactor: 1e-160 })).toThrow();
    const r = run({ molarity: 1e-9, vantHoffFactor: 1e-6 });
    expect(Number.isFinite(metric(r, 'osmoticPressure'))).toBe(true);
    expect(Number.isFinite(metric(r, 'impliedMolarMass'))).toBe(true);
  });

  it('exposes the Π-vs-M curve and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.osmoticPressure).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('osmotic-pressure');
    expect(spec.domain).toBe('biochemistry');
  });
});
