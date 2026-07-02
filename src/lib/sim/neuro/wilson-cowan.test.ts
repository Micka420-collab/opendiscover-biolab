import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { analyzeOscillation, response, run } from './wilson-cowan';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('wilson-cowan', () => {
  it('has a baseline-subtracted response with S(0)=0 and a stable, bounded sigmoid', () => {
    expect(response(0, 1.3, 4)).toBeCloseTo(0, 12);
    // Monotone increasing and bounded in (−1, 1).
    expect(response(100, 1.3, 4)).toBeGreaterThan(response(4, 1.3, 4));
    expect(response(1e6, 2, 3.7)).toBeLessThanOrEqual(1);
    expect(response(-1e6, 2, 3.7)).toBeGreaterThanOrEqual(-1);
    expect(Number.isFinite(response(1e6, 2, 3.7))).toBe(true); // no overflow
  });

  it('with zero coupling relaxes to the analytic fixed point E* = S_E(P)', () => {
    // Decoupled populations: each just relaxes to the sigmoid of its own input.
    const r = run({
      cEE: 0,
      cEI: 0,
      cIE: 0,
      cII: 0,
      P: 2,
      Q: 1,
      aE: 1.3,
      thetaE: 4,
      aI: 2,
      thetaI: 3.7,
      E0: 0.5,
      I0: 0.5,
      tEnd: 80,
    });
    expect(metric(r, 'oscillates')).toBe(0);
    expect(metric(r, 'meanE')).toBeCloseTo(response(2, 1.3, 4), 4);
    expect(metric(r, 'meanI')).toBeCloseTo(response(1, 2, 3.7), 4);
  });

  it('sustains a limit cycle in the classic oscillatory regime (default params)', () => {
    const r = run({ tEnd: 120 });
    expect(metric(r, 'oscillates')).toBe(1);
    expect(metric(r, 'amplitudeE')).toBeGreaterThan(0.05);
    expect(metric(r, 'periodE')).toBeGreaterThan(0);
  });

  it('strong self-inhibition with weak excitation settles instead of oscillating', () => {
    const r = run({ cEE: 1, cEI: 2, cIE: 2, cII: 8, P: 0.5, Q: 0, tEnd: 80 });
    expect(metric(r, 'oscillates')).toBe(0);
  });

  it('activity stays finite and self-bounded (no blow-up)', () => {
    const r = run({ tEnd: 120 });
    for (const s of r.series ?? []) {
      for (const key of ['E', 'I']) {
        for (const v of s.y[key] ?? []) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThan(-0.1);
          expect(v).toBeLessThan(1.1);
        }
      }
    }
  });

  it('analyzeOscillation reports a clean period on a pure sine and none on a flat line', () => {
    const t = Array.from({ length: 400 }, (_, i) => i * 0.05); // 0..20
    const sine = t.map((x) => 0.5 + 0.3 * Math.sin(2 * Math.PI * x)); // period 1
    const s = analyzeOscillation(t, sine);
    expect(s.oscillates).toBe(true);
    expect(s.period).toBeCloseTo(1, 1);
    const flat = analyzeOscillation(
      t,
      t.map(() => 0.42),
    );
    expect(flat.oscillates).toBe(false);
    expect(flat.period).toBe(0);
    expect(flat.mean).toBeCloseTo(0.42, 10);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('wilson-cowan', { P: 1.25 });
    const b = runEngine('wilson-cowan', { P: 1.25 });
    expect(a).toEqual(b);
  });
});
