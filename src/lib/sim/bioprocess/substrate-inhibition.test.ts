import { describe, expect, it } from 'vitest';
import { growthRate, halfMuLevels, monodRate, run, spec } from './substrate-inhibition';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('substrate-inhibition (Haldane)', () => {
  it('growth peaks at S_opt = √(Ks·Ki) with µ_opt = µmax/(1+2√(Ks/Ki))', () => {
    const muMax = 0.8;
    const ks = 1;
    const ki = 100;
    const r = run({ muMax, ks, ki });
    const sOpt = Math.sqrt(ks * ki);
    const muOpt = muMax / (1 + 2 * Math.sqrt(ks / ki));
    expect(metric(r, 'optimalSubstrate')).toBeCloseTo(sOpt, 10);
    expect(metric(r, 'maxGrowthRate')).toBeCloseTo(muOpt, 10);
    // The closed-form peak equals the actual curve value at S_opt.
    expect(growthRate(sOpt, muMax, ks, ki)).toBeCloseTo(muOpt, 12);
  });

  it('S_opt is a genuine maximum (µ falls on both sides)', () => {
    const muMax = 0.8;
    const ks = 1;
    const ki = 100;
    const sOpt = Math.sqrt(ks * ki);
    const peak = growthRate(sOpt, muMax, ks, ki);
    expect(growthRate(sOpt * 0.5, muMax, ks, ki)).toBeLessThan(peak);
    expect(growthRate(sOpt * 2, muMax, ks, ki)).toBeLessThan(peak);
  });

  it('the two half-peak substrate levels have product Ks·Ki (symmetry anchor)', () => {
    const muMax = 0.8;
    const ks = 3;
    const ki = 75;
    const muOpt = muMax / (1 + 2 * Math.sqrt(ks / ki));
    const { low, high } = halfMuLevels(muMax, muOpt, ks, ki);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(low * high).toBeCloseTo(ks * ki, 6);
    // Each level really is half of the peak.
    expect(growthRate(low, muMax, ks, ki)).toBeCloseTo(muOpt / 2, 8);
    expect(growthRate(high, muMax, ks, ki)).toBeCloseTo(muOpt / 2, 8);
  });

  it('Ki → ∞ recovers Monod (curve matches, efficiency → 1)', () => {
    const muMax = 0.8;
    const ks = 1;
    const r = run({ muMax, ks, ki: 1e9, substrateMax: 50 });
    for (const s of [0, 1, 5, 20, 50]) {
      expect(growthRate(s, muMax, ks, 1e9)).toBeCloseTo(monodRate(s, muMax, ks), 6);
    }
    expect(metric(r, 'peakEfficiency')).toBeGreaterThan(0.999);
  });

  it('growth never exceeds µmax and is zero at S = 0', () => {
    const muMax = 0.8;
    const ks = 1;
    const ki = 100;
    expect(growthRate(0, muMax, ks, ki)).toBe(0);
    for (let s = 0; s <= 500; s += 5) {
      expect(growthRate(s, muMax, ks, ki)).toBeLessThanOrEqual(muMax + 1e-12);
    }
  });

  it('peak efficiency = 1/(1+2√(Ks/Ki)) and is < 1 for finite Ki', () => {
    const r = run({ muMax: 0.8, ks: 4, ki: 100 });
    const expected = 1 / (1 + 2 * Math.sqrt(4 / 100));
    expect(metric(r, 'peakEfficiency')).toBeCloseTo(expected, 10);
    expect(metric(r, 'peakEfficiency')).toBeLessThan(1);
  });

  it('stronger inhibition (smaller Ki) lowers both S_opt and the peak', () => {
    const strong = run({ muMax: 0.8, ks: 1, ki: 20 });
    const weak = run({ muMax: 0.8, ks: 1, ki: 500 });
    expect(metric(strong, 'optimalSubstrate')).toBeLessThan(metric(weak, 'optimalSubstrate'));
    expect(metric(strong, 'maxGrowthRate')).toBeLessThan(metric(weak, 'maxGrowthRate'));
  });

  it('plots the Haldane curve against a Monod reference', () => {
    const r = run({ muMax: 0.8, ks: 1, ki: 100, outputPoints: 60 });
    const s = r.series?.[0];
    expect(s?.x).toHaveLength(60);
    expect(s?.y.growthRate).toHaveLength(60);
    expect(s?.y.monodReference).toHaveLength(60);
    expect(spec.slug).toBe('substrate-inhibition');
    expect(spec.domain).toBe('bioprocess');
  });

  it('is deterministic', () => {
    const a = run({ muMax: 0.8, ks: 1, ki: 100 });
    const b = run({ muMax: 0.8, ks: 1, ki: 100 });
    expect(a).toEqual(b);
  });
});
