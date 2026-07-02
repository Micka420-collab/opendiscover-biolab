import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { oralConc, run } from './pk-oral-absorption';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('pk-oral-absorption', () => {
  it('starts at zero and peaks at Tmax = ln(ka/ke)/(ka−ke)', () => {
    const r = run({ dose: 100, ka: 1, cl: 5, v: 20 }); // ke = 0.25
    expect(r.series?.[0]?.y.plasma[0]).toBeCloseTo(0, 12); // C(0) = 0
    expect(metric(r, 'tmax')).toBeCloseTo(Math.log(1 / 0.25) / (1 - 0.25), 10); // 1.848 h
  });

  it('AUC(0→∞) = F·Dose/CL, independent of absorption', () => {
    expect(metric(run({ dose: 100, bioavailability: 1, cl: 5 }), 'auc')).toBeCloseTo(20, 10);
    expect(metric(run({ dose: 200, bioavailability: 0.5, cl: 5, ka: 3 }), 'auc')).toBeCloseTo(
      20,
      10,
    );
  });

  it('Cmax is the maximum of the sampled curve', () => {
    const r = run({ dose: 100, ka: 1, cl: 5, v: 20, tEnd: 48, outputPoints: 2000 });
    const peak = Math.max(...(r.series?.[0]?.y.plasma ?? []));
    expect(metric(r, 'cmax')).toBeGreaterThanOrEqual(peak - 1e-6);
    expect(metric(r, 'cmax')).toBeCloseTo(peak, 3);
  });

  it('handles the ka = ke removable singularity with the exact limit', () => {
    // ke = cl/v = 5/20 = 0.25; set ka = 0.25 to hit the 0/0 case.
    const r = run({ dose: 100, ka: 0.25, cl: 5, v: 20 });
    expect(Number.isFinite(metric(r, 'cmax'))).toBe(true);
    expect(metric(r, 'tmax')).toBeCloseTo(1 / 0.25, 10); // Tmax = 1/ka = 4 h
    // Concentration matches the limit form C = (F·D·ka/V)·t·e^(−ka t).
    const fDose = 100;
    const expected = ((fDose * 0.25) / 20) * 3 * Math.exp(-0.25 * 3);
    expect(oralConc(3, fDose, 20, 0.25, 0.25)).toBeCloseTo(expected, 12);
  });

  it('is continuous across ka ≈ ke (no blow-up just off the singularity)', () => {
    const atLimit = oralConc(3, 100, 20, 0.25, 0.25);
    const nearLimit = oralConc(3, 100, 20, 0.250001, 0.25);
    expect(nearLimit).toBeCloseTo(atLimit, 4);
    expect(Number.isFinite(nearLimit)).toBe(true);
  });

  it('terminal half-life follows the slower rate (flip-flop when ka < ke)', () => {
    // Normal: ka=1 > ke=0.25 → ln2/ke.
    expect(metric(run({ ka: 1, cl: 5, v: 20 }), 'terminalHalfLife')).toBeCloseTo(
      Math.LN2 / 0.25,
      9,
    );
    // Flip-flop: ka=0.1 < ke=0.25 → ln2/ka.
    expect(metric(run({ ka: 0.1, cl: 5, v: 20 }), 'terminalHalfLife')).toBeCloseTo(
      Math.LN2 / 0.1,
      9,
    );
  });

  it('plasma concentration stays non-negative', () => {
    const r = run({ dose: 100, ka: 2, cl: 8, v: 15, tEnd: 36 });
    for (const c of r.series?.[0]?.y.plasma ?? []) expect(c).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('pk-oral-absorption', { dose: 50, ka: 1.5, cl: 4 });
    const b = runEngine('pk-oral-absorption', { dose: 50, ka: 1.5, cl: 4 });
    expect(a).toEqual(b);
  });
});
