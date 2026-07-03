import { describe, expect, it } from 'vitest';
import { rateConstant, run, spec } from './arrhenius-rate';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

const R = 8.314;

describe('arrhenius-rate', () => {
  it('rate constant matches k = A·exp(−Ea/RT) and never exceeds A', () => {
    const k = rateConstant(1e13, 50, 25);
    expect(k).toBeCloseTo(1e13 * Math.exp(-(50 * 1000) / (R * 298.15)), 0);
    expect(
      metric(run({ preExponential: 1e13, activationEnergy: 50, temperatureC: 25 }), 'rateConstant'),
    ).toBeCloseTo(k, 0);
    // exp(negative) < 1, so k < A always
    expect(rateConstant(1e13, 50, 25)).toBeLessThan(1e13);
  });

  it('rate rises with temperature and with lower barriers', () => {
    expect(rateConstant(1e13, 50, 40)).toBeGreaterThan(rateConstant(1e13, 50, 20));
    expect(rateConstant(1e13, 30, 25)).toBeGreaterThan(rateConstant(1e13, 80, 25));
  });

  it('Q10 climbs monotonically with the barrier and the challenge (Q10=2) is winnable', () => {
    let prev = -1;
    for (let Ea = 1; Ea <= 200; Ea += 5) {
      const v = metric(run({ activationEnergy: Ea, temperatureC: 25 }), 'q10');
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    // Q10 ≈ 2 near Ea ≈ 53 kJ/mol at 25 °C (the classic rule of thumb)
    expect(metric(run({ activationEnergy: 53, temperatureC: 25 }), 'q10')).toBeCloseTo(2, 1);
  });

  it('the Arrhenius slope is −Ea/R (in K)', () => {
    expect(metric(run({ activationEnergy: 50 }), 'arrheniusSlope')).toBeCloseTo(
      -(50 * 1000) / R,
      6,
    );
  });

  it('fold-change across the range equals k(tMax)/k(tMin)', () => {
    const r = run({ activationEnergy: 50, tMinC: -10, tMaxC: 100, preExponential: 1e13 });
    expect(metric(r, 'foldChangeOverRange')).toBeCloseTo(
      rateConstant(1e13, 50, 100) / rateConstant(1e13, 50, -10),
      3,
    );
    expect(metric(r, 'foldChangeOverRange')).toBeGreaterThan(1); // hotter is faster
  });

  it('the Arrhenius plot (ln k vs 1/T) is a straight line of the reported slope', () => {
    const r = run({ activationEnergy: 50, tMinC: 0, tMaxC: 100, outputPoints: 50 });
    const invT = r.series?.[1]?.x ?? []; // 1000/T
    const lnk = r.series?.[1]?.y.lnRate ?? [];
    // slope of ln k vs (1000/T) is (−Ea/R)/1000; check between two points
    const i = 5;
    const j = 40;
    const measured = ((lnk[j] - lnk[i]) / (invT[j] - invT[i])) * 1000; // back to per-(1/T)
    expect(measured).toBeCloseTo(metric(r, 'arrheniusSlope'), 3);
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ activationEnergy: 5e-324 })).toThrow();
    expect(() => run({ preExponential: 5e-324 })).toThrow();
    const r = run({
      preExponential: 1e18,
      activationEnergy: 500,
      temperatureC: -50,
      tMinC: -50,
      tMaxC: 300,
    });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.rate ?? []) expect(Number.isFinite(y)).toBe(true);
    for (const y of r.series?.[1]?.y.lnRate ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes both curves and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.y.rate).toHaveLength(40);
    expect(r.series?.[1]?.y.lnRate).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('arrhenius-rate');
    expect(spec.domain).toBe('biochemistry');
  });
});
