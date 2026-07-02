import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { run } from './oxygen-transfer';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('oxygen-transfer', () => {
  it('steady-state DO = C* − OUR/kLa when supply meets demand', () => {
    const r = run({ kLa: 100, saturationDO: 8, our: 400 }); // 8 − 4 = 4 mg/L
    expect(metric(r, 'steadyStateDO')).toBeCloseTo(4, 10);
    expect(metric(r, 'percentSaturation')).toBeCloseTo(50, 10);
    expect(metric(r, 'oxygenLimited')).toBe(0);
  });

  it('flags oxygen limitation when kLa is too low, and clamps DO at zero', () => {
    const r = run({ kLa: 40, saturationDO: 8, our: 400, criticalDO: 1 }); // C_ss = 8 − 10 = −2
    expect(metric(r, 'oxygenLimited')).toBe(1);
    expect(metric(r, 'steadyStateDO')).toBe(0); // clamped, not negative
  });

  it('critical kLa = OUR/(C* − C_crit)', () => {
    expect(metric(run({ our: 400, saturationDO: 8, criticalDO: 1 }), 'criticalKLa')).toBeCloseTo(
      400 / 7,
      9,
    );
  });

  it('the DO curve starts at C0 and relaxes to the steady state', () => {
    const r = run({ kLa: 100, saturationDO: 8, our: 400, initialDO: 8, tEnd: 0.2 });
    const do2 = r.series?.[0]?.y.dissolvedO2 ?? [];
    expect(do2[0]).toBeCloseTo(8, 8); // starts air-saturated
    expect(do2.at(-1)).toBeCloseTo(4, 3); // ≈ steady state after ~20 time constants
  });

  it('response time constant is 1/kLa', () => {
    expect(metric(run({ kLa: 250 }), 'responseTimeConstant')).toBeCloseTo(1 / 250, 12);
  });

  it('dissolved O2 stays within [0, C*] over the whole curve', () => {
    const r = run({ kLa: 30, saturationDO: 8, our: 400, initialDO: 8 }); // oxygen-limited
    for (const c of r.series?.[0]?.y.dissolvedO2 ?? []) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(8);
    }
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('oxygen-transfer', { kLa: 120, our: 300 });
    const b = runEngine('oxygen-transfer', { kLa: 120, our: 300 });
    expect(a).toEqual(b);
  });
});
