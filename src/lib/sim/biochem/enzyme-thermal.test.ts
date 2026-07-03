import { describe, expect, it } from 'vitest';
import { activity, q10, run, spec } from './enzyme-thermal';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('enzyme-thermal (temperature optimum)', () => {
  it('activity is bell-shaped: the optimum beats both colder and hotter', () => {
    const r = run({ activationEnergy: 50, denaturationEnthalpy: 400, meltingTemp: 55 });
    const topt = metric(r, 'optimalTemp');
    const aOpt = activity(topt, 50, 400, 55);
    expect(aOpt).toBeGreaterThan(activity(topt - 20, 50, 400, 55));
    expect(aOpt).toBeGreaterThan(activity(topt + 20, 50, 400, 55));
  });

  it('the optimum sits below the melting temperature', () => {
    const r = run({ meltingTemp: 55 });
    expect(metric(r, 'optimalTemp')).toBeLessThan(55);
    expect(metric(r, 'thermalMargin')).toBeGreaterThan(0); // Tm − T_opt > 0
  });

  it('a more thermostable enzyme (higher Tm) has a higher optimum', () => {
    const cold = run({ meltingTemp: 45 });
    const hot = run({ meltingTemp: 75 });
    expect(metric(hot, 'optimalTemp')).toBeGreaterThan(metric(cold, 'optimalTemp'));
  });

  it('relative activity is in (0,1] and Q10 matches the Arrhenius formula', () => {
    const r = run({ temperatureC: 37, activationEnergy: 50 });
    const rel = metric(r, 'relativeActivityAtT');
    expect(rel).toBeGreaterThan(0);
    expect(rel).toBeLessThanOrEqual(1 + 1e-9);
    expect(metric(r, 'q10')).toBeCloseTo(q10(37, 50), 12);
    expect(metric(r, 'q10')).toBeGreaterThan(1); // heat speeds chemistry up
  });

  it('relative activity never exceeds 1, even when the reporting temperature is outside the plot window', () => {
    const r = run({ tMinC: 0, tMaxC: 40, temperatureC: 50, denaturationEnthalpy: 400 });
    expect(metric(r, 'relativeActivityAtT')).toBeGreaterThan(0);
    expect(metric(r, 'relativeActivityAtT')).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('the optimum can rise to/above Tm (margin ≤ 0) when denaturation is shallow (ΔHd < 2·Ea)', () => {
    const r = run({ activationEnergy: 200, denaturationEnthalpy: 300, meltingTemp: 55 });
    expect(metric(r, 'thermalMargin')).toBeLessThanOrEqual(0); // Tm − T_opt ≤ 0
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ activationEnergy: 5e-324 })).toThrow();
    expect(() => run({ denaturationEnthalpy: 1e-160 })).toThrow();
    const r = run({
      activationEnergy: 400,
      denaturationEnthalpy: 3000,
      meltingTemp: 0,
      temperatureC: 150,
      tMinC: -20,
      tMaxC: 150,
    });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.activity ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the activity curve and is deterministic', () => {
    const r = run({ outputPoints: 50 });
    expect(r.series?.[0]?.x).toHaveLength(50);
    expect(r.series?.[0]?.y.activity).toHaveLength(50);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('enzyme-thermal');
    expect(spec.domain).toBe('biochemistry');
  });
});
