import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { analyticFinalSize, run, simulate } from './reed-frost';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('reed-frost', () => {
  it('analytic final size solves z = 1 − e^(−R₀z)', () => {
    expect(analyticFinalSize(0.5)).toBe(0); // sub-critical → no epidemic
    expect(analyticFinalSize(1)).toBe(0);
    const z = analyticFinalSize(2);
    expect(z).toBeCloseTo(1 - Math.exp(-2 * z), 10); // fixed point
    expect(z).toBeCloseTo(0.7968, 3);
  });

  it('the simulated attack rate matches the analytic final size for large N', () => {
    for (const r0 of [1.5, 2.5, 3.5]) {
      const r = run({ population: 100_000, r0 });
      expect(metric(r, 'attackRate')).toBeCloseTo(analyticFinalSize(r0), 3);
    }
  });

  it('a sub-critical R₀ < 1 fizzles out', () => {
    const r = run({ population: 100_000, r0: 0.5 });
    expect(metric(r, 'attackRate')).toBeLessThan(0.01);
    expect(metric(r, 'herdImmunityThreshold')).toBe(0);
  });

  it('reports the herd-immunity threshold 1 − 1/R₀', () => {
    expect(metric(run({ r0: 2.5 }), 'herdImmunityThreshold')).toBeCloseTo(0.6, 12);
    expect(metric(run({ r0: 4 }), 'herdImmunityThreshold')).toBeCloseTo(0.75, 12);
  });

  it('conserves individuals: total infected = N − immune − S_final', () => {
    const p = {
      population: 1000,
      r0: 2.5,
      initialInfectives: 1,
      initialImmune: 50,
      maxGenerations: 200,
    };
    const sim = simulate({ ...p });
    const sFinal = sim.susceptible[sim.susceptible.length - 1] ?? 0;
    expect(sim.totalInfected).toBeCloseTo(p.population - p.initialImmune - sFinal, 6);
  });

  it('a major outbreak peaks after the first generation with non-negative counts', () => {
    const r = run({ population: 5000, r0: 3 });
    expect(metric(r, 'peakGeneration')).toBeGreaterThan(0);
    expect(metric(r, 'peakIncidence')).toBeGreaterThan(1);
    for (const s of r.series ?? []) {
      for (const key of Object.keys(s.y)) {
        for (const v of s.y[key] ?? []) expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('analytic final size converges for R₀ just above 1 (regression: fixed-point stalled there)', () => {
    for (const r0 of [1.001, 1.01, 1.05]) {
      const z = analyticFinalSize(r0);
      expect(z).toBeCloseTo(1 - Math.exp(-r0 * z), 9); // truly satisfies the equation
    }
    expect(analyticFinalSize(1.01)).toBeCloseTo(0.019736, 5);
    // Matches the simulator's own attack rate near threshold (large N).
    const sim = run({ population: 1_000_000, r0: 1.05, maxGenerations: 1000 });
    expect(metric(sim, 'attackRate')).toBeCloseTo(analyticFinalSize(1.05), 3);
  });

  it('flags when the generation cap is hit instead of true die-out (regression)', () => {
    const capped = run({ population: 1_000_000, r0: 1.02, maxGenerations: 200 });
    expect(capped.metrics.find((m) => m.key === 'epidemicDuration')?.note).toMatch(/cap reached/);
    // A normal outbreak that dies out carries no such caveat.
    const settled = run({ population: 1000, r0: 2.5 });
    expect(settled.metrics.find((m) => m.key === 'epidemicDuration')?.note).toBeUndefined();
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('reed-frost', { population: 2000, r0: 2.2 });
    const b = runEngine('reed-frost', { population: 2000, r0: 2.2 });
    expect(a).toEqual(b);
  });
});
