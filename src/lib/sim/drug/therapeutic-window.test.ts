import { describe, expect, it } from 'vitest';
import { hillResponse, run, spec } from './therapeutic-window';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('therapeutic-window (safety margin)', () => {
  it('Hill response is 0.5 at the half-max dose, 0 at dose 0, → 1 at high dose', () => {
    expect(hillResponse(10, 10, 1)).toBeCloseTo(0.5, 9);
    expect(hillResponse(0, 10, 1)).toBe(0); // dose 0 → exactly 0, no NaN
    expect(hillResponse(1e9, 10, 1)).toBeCloseTo(1, 6);
  });

  it('therapeutic index is TD50/ED50', () => {
    expect(metric(run({ ed50: 10, td50: 100 }), 'therapeuticIndex')).toBeCloseTo(10, 12);
    expect(metric(run({ ed50: 5, td50: 200 }), 'therapeuticIndex')).toBeCloseTo(40, 12);
  });

  it('efficacy and toxicity at a dose match the Hill curves', () => {
    const r = run({ ed50: 10, td50: 100, hillEfficacy: 1, hillToxicity: 1, dose: 30 });
    expect(metric(r, 'efficacyAtDose')).toBeCloseTo(30 / 40, 9); // 0.75
    expect(metric(r, 'toxicityAtDose')).toBeCloseTo(30 / 130, 9); // 0.2308
    expect(metric(r, 'netBenefitAtDose')).toBeCloseTo(0.75 * (1 - 30 / 130), 9);
    expect(metric(r, 'marginAtDose')).toBeCloseTo(0.75 - 30 / 130, 9);
  });

  it('net benefit peaks at an INTERMEDIATE dose (more is not better)', () => {
    const nb = (dose: number) => metric(run({ ed50: 10, td50: 100, dose }), 'netBenefitAtDose');
    const low = nb(5);
    const peak = nb(31.6); // ≈ √(ED50·TD50) for equal slopes
    const high = nb(200);
    expect(peak).toBeGreaterThan(low);
    expect(peak).toBeGreaterThan(high);
    // the challenge (maximize net benefit) is winnable: the peak clears the par of 0.57
    expect(peak).toBeGreaterThan(0.57);
  });

  it('a wider therapeutic index gives a higher achievable net benefit', () => {
    const narrow = run({ ed50: 10, td50: 20, dose: 14 }); // TI=2, curves overlap
    const wide = run({ ed50: 10, td50: 1000, dose: 100 }); // TI=100, far apart
    expect(metric(wide, 'netBenefitAtDose')).toBeGreaterThan(metric(narrow, 'netBenefitAtDose'));
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ ed50: 5e-324 })).toThrow();
    expect(() => run({ hillEfficacy: 5e-324 })).toThrow();
    for (const combo of [
      { ed50: 1e-6, td50: 1e9, hillEfficacy: 10, hillToxicity: 10, dose: 1e12, doseMax: 1e12 },
      { ed50: 1e9, td50: 1e-6, hillEfficacy: 10, hillToxicity: 10, dose: 0, doseMax: 1e-6 },
    ]) {
      const r = run(combo);
      for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
      for (const y of r.series?.[0]?.y.efficacy ?? []) expect(Number.isFinite(y)).toBe(true);
      for (const y of r.series?.[0]?.y.toxicity ?? []) expect(Number.isFinite(y)).toBe(true);
    }
  });

  it('exposes the efficacy + toxicity curves (starting at 0) and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.efficacy?.[0]).toBe(0); // dose 0
    expect(r.series?.[0]?.y.toxicity?.[0]).toBe(0);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('therapeutic-window');
    expect(spec.domain).toBe('drug-discovery');
  });
});
