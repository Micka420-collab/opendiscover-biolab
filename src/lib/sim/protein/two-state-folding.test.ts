import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { deltaGUnfold, fractionFolded, run } from './two-state-folding';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

const KELVIN = 273.15;

describe('two-state-folding', () => {
  it('ΔG = 0 and f_F = 0.5 exactly at the melting temperature', () => {
    const tmK = 60 + KELVIN;
    expect(deltaGUnfold(tmK, 250, tmK, 8)).toBeCloseTo(0, 9);
    expect(fractionFolded(0, tmK)).toBeCloseTo(0.5, 12);
  });

  it('a Tm=60°C protein is mostly folded and stable at 25°C', () => {
    const r = run({ deltaHm: 250, tmCelsius: 60, deltaCp: 8 });
    expect(metric(r, 'deltaG25')).toBeGreaterThan(0); // folding favoured
    expect(metric(r, 'fractionFolded25')).toBeGreaterThan(0.9);
  });

  it('maximum stability sits below Tm, at the closed-form temperature', () => {
    const r = run({ deltaHm: 250, tmCelsius: 60, deltaCp: 8 });
    const tmK = 60 + KELVIN;
    const expectedMaxK = tmK * Math.exp(-250 / (tmK * 8));
    expect(metric(r, 'maxStabilityTemp')).toBeCloseTo(expectedMaxK - KELVIN, 6);
    expect(metric(r, 'maxStabilityTemp')).toBeLessThan(60);
    // Peak ΔG is the maximum: at least as large as ΔG at 25°C.
    expect(metric(r, 'deltaGmax')).toBeGreaterThanOrEqual(metric(r, 'deltaG25') - 1e-9);
  });

  it('shows BOTH cold and heat denaturation (the stability curve dips negative at each end)', () => {
    const params = { deltaHm: 250, tmCelsius: 60, deltaCp: 8 };
    const tmK = 60 + KELVIN;
    // Heat: above Tm, ΔG < 0.
    expect(deltaGUnfold(90 + KELVIN, params.deltaHm, tmK, params.deltaCp)).toBeLessThan(0);
    // Cold: well below the stability max, ΔG goes negative again.
    expect(deltaGUnfold(-20 + KELVIN, params.deltaHm, tmK, params.deltaCp)).toBeLessThan(0);
    // And the peak in between is positive.
    expect(metric(run(params), 'deltaGmax')).toBeGreaterThan(0);
  });

  it('fraction folded stays within [0,1] across the whole curve (no NaN/overflow)', () => {
    const r = run({ deltaHm: 400, tmCelsius: 80, deltaCp: 12, tMinCelsius: -40, tMaxCelsius: 150 });
    for (const v of r.series?.[0]?.y.fractionFolded ?? []) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('ΔG and the peak-stability metric stay finite even when maxStab underflows to 0 K (regression)', () => {
    // Extreme ΔHm/(Tm·ΔCp): maxStabK underflows to exactly 0; the T→0 limit is finite.
    const tmK = 150 + KELVIN;
    expect(deltaGUnfold(0, 5000, tmK, 0.01)).toBeCloseTo(5000 - 0.01 * tmK, 6);
    const r = run({ deltaHm: 5000, tmCelsius: 150, deltaCp: 0.01 });
    expect(Number.isFinite(metric(r, 'deltaGmax'))).toBe(true);
    expect(r.summary).not.toContain('NaN');
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('two-state-folding', { tmCelsius: 55, deltaHm: 300 });
    const b = runEngine('two-state-folding', { tmCelsius: 55, deltaHm: 300 });
    expect(a).toEqual(b);
  });
});
