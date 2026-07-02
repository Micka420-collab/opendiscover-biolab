import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { endemicEquilibrium, run } from './sir-endemic';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('sir-endemic', () => {
  it('has the exact endemic equilibrium S*=1/R0, I*=mu(R0-1)/beta', () => {
    const eq = endemicEquilibrium(0.5, 0.1, 0.01); // R0 = 0.5/0.11
    expect(eq.r0).toBeCloseTo(0.5 / 0.11, 10);
    expect(eq.s).toBeCloseTo(1 / eq.r0, 10);
    expect(eq.i).toBeCloseTo((0.01 * (eq.r0 - 1)) / 0.5, 10);
  });

  it('is disease-free for R0 <= 1', () => {
    const eq = endemicEquilibrium(0.05, 0.1, 0.01); // R0 < 1
    expect(eq.r0).toBeLessThan(1);
    expect(eq.s).toBe(1);
    expect(eq.i).toBe(0);
  });

  it('settles (via damped oscillations) to the endemic prevalence when R0 > 1', () => {
    const r = run({ beta: 0.5, gamma: 0.1, mu: 0.01, i0: 0.001, tEnd: 3000 });
    const iStar = metric(r, 'endemicPrevalence');
    expect(iStar).toBeGreaterThan(0);
    // Time-averaged prevalence centres on I* (robust to slow damping).
    expect(metric(r, 'meanInfected')).toBeCloseTo(iStar, 2);
    expect(metric(r, 'endemic')).toBe(1);
  });

  it('dies out for R0 <= 1', () => {
    const r = run({ beta: 0.05, gamma: 0.1, mu: 0.01, i0: 0.01, tEnd: 3000 });
    expect(metric(r, 'endemicPrevalence')).toBe(0);
    expect(metric(r, 'finalInfected')).toBeLessThan(1e-3);
  });

  it('keeps the fractions within [0, 1]', () => {
    const r = run({ beta: 0.8, gamma: 0.1, mu: 0.02 });
    for (const s of r.series ?? []) {
      for (const key of Object.keys(s.y)) {
        for (const v of s.y[key]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1 + 1e-9);
        }
      }
    }
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('sir-endemic', { beta: 0.6, gamma: 0.2, mu: 0.02 });
    const b = runEngine('sir-endemic', { beta: 0.6, gamma: 0.2, mu: 0.02 });
    expect(a).toEqual(b);
  });
});
