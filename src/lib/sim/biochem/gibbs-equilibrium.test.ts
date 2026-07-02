import { describe, expect, it } from 'vitest';
import { lnEquilibriumConstant, run, spec } from './gibbs-equilibrium';

const R = 8.314462618;
const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('gibbs-equilibrium (ΔG / K / van’t Hoff)', () => {
  it('ΔG° = ΔH° − T·ΔS° (in consistent units)', () => {
    const r = run({ deltaH: -40, deltaS: -100, temperatureC: 25 });
    const tK = 298.15;
    expect(metric(r, 'deltaG0')).toBeCloseTo(-40 - (tK * -100) / 1000, 9);
  });

  it('at standard conditions (Q=1) the actual ΔG equals ΔG°', () => {
    const r = run({ deltaH: -40, deltaS: -100, temperatureC: 25, reactionQuotient: 1 });
    expect(metric(r, 'deltaG')).toBeCloseTo(metric(r, 'deltaG0'), 9);
  });

  it('a favourable ΔG° (<0) gives K>1 (log₁₀K>0) and a product-rich equilibrium', () => {
    const r = run({ deltaH: -40, deltaS: -100, temperatureC: 25 });
    expect(metric(r, 'deltaG0')).toBeLessThan(0);
    expect(metric(r, 'log10K')).toBeGreaterThan(0);
    const f = metric(r, 'productFraction');
    expect(f).toBeGreaterThan(0.5);
    expect(f).toBeLessThan(1);
  });

  it('ln K follows the van’t Hoff line: slope in 1/T is −ΔH°/R', () => {
    const dH = -40;
    const dS = -100;
    const t1 = 300;
    const t2 = 400;
    const lnK1 = lnEquilibriumConstant(dH, dS, t1);
    const lnK2 = lnEquilibriumConstant(dH, dS, t2);
    const slope = (lnK2 - lnK1) / (1 / t2 - 1 / t1);
    expect(slope).toBeCloseTo(-(dH * 1000) / R, 6);
  });

  it('heating flips spontaneity for an exothermic, entropy-lowering reaction', () => {
    // ΔH<0, ΔS<0 ⇒ forward at low T, reverse at high T; crossover at ΔH/ΔS.
    const cold = run({ deltaH: -40, deltaS: -100, temperatureC: 25 });
    const hot = run({ deltaH: -40, deltaS: -100, temperatureC: 200 });
    expect(metric(cold, 'deltaG0')).toBeLessThan(0);
    expect(metric(hot, 'deltaG0')).toBeGreaterThan(0);
    // Crossover T = ΔH°/ΔS° = -40000/-100 = 400 K = 126.85 °C.
    expect(metric(cold, 'crossoverTemperature')).toBeCloseTo(400 - 273.15, 6);
  });

  it('the reaction quotient shifts the actual ΔG (Le Chatelier): more product raises ΔG', () => {
    const base = run({ deltaH: -40, deltaS: -100, reactionQuotient: 1 });
    const pushed = run({ deltaH: -40, deltaS: -100, reactionQuotient: 1000 });
    expect(metric(pushed, 'deltaG')).toBeGreaterThan(metric(base, 'deltaG'));
  });

  it('stays finite for extreme but valid inputs, and rejects denormals', () => {
    expect(() => run({ reactionQuotient: 5e-324 })).toThrow();
    const r = run({ deltaH: -1000, deltaS: 10000, temperatureC: -250, reactionQuotient: 1e12 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    const f = metric(r, 'productFraction');
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(1);
    for (const y of r.series?.[0]?.y.lnK ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the ln K-vs-temperature curve and is deterministic', () => {
    const r = run({ outputPoints: 60 });
    expect(r.series?.[0]?.x).toHaveLength(60);
    expect(r.series?.[0]?.y.lnK).toHaveLength(60);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('gibbs-equilibrium');
    expect(spec.domain).toBe('biochemistry');
  });
});
