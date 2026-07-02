import { describe, expect, it } from 'vitest';
import { fractionDuplex, run, spec } from './dna-melting';

const R = 0.0083145;
const KELVIN = 273.15;

describe('dna-melting', () => {
  it('θ = 0.5 exactly at the closed-form melting temperature (non-self)', () => {
    const deltaH = -380;
    const deltaS = -1;
    const cT = 1e-5;
    const tmK = deltaH / (deltaS + R * Math.log(cT / 4));
    expect(fractionDuplex(tmK, deltaH, deltaS, cT, false)).toBeCloseTo(0.5, 6);
  });

  it('θ = 0.5 exactly at Tm for a self-complementary strand (x=1)', () => {
    const deltaH = -300;
    const deltaS = -0.85;
    const cT = 5e-6;
    const tmK = deltaH / (deltaS + R * Math.log(cT / 1));
    expect(fractionDuplex(tmK, deltaH, deltaS, cT, true)).toBeCloseTo(0.5, 6);
  });

  it('reports the closed-form Tm as the meltingTemp metric', () => {
    const r = run({ deltaH: -380, deltaS: -1, strandConc: 1e-5 });
    const tmK = -380 / (-1 + R * Math.log(1e-5 / 4));
    const tm = r.metrics.find((m) => m.key === 'meltingTemp')?.value as number;
    expect(tm).toBeCloseTo(tmK - KELVIN, 6);
  });

  it('Tm rises with strand concentration (bimolecular hallmark)', () => {
    const lowC = run({ strandConc: 1e-7 }).metrics.find((m) => m.key === 'meltingTemp')
      ?.value as number;
    const highC = run({ strandConc: 1e-4 }).metrics.find((m) => m.key === 'meltingTemp')
      ?.value as number;
    expect(highC).toBeGreaterThan(lowC);
  });

  it('self-complementary melts higher than the same strand as non-self (x=1 vs 4)', () => {
    const params = { deltaH: -380, deltaS: -1, strandConc: 1e-5 } as const;
    const self = run({ ...params, selfComplementary: true }).metrics.find(
      (m) => m.key === 'meltingTemp',
    )?.value as number;
    const nonSelf = run({ ...params, selfComplementary: false }).metrics.find(
      (m) => m.key === 'meltingTemp',
    )?.value as number;
    // ln(C_T/1) > ln(C_T/4), so the self denominator ΔS°+R·ln(C_T/1) is smaller in
    // magnitude (less negative); dividing the same negative ΔH° by it gives a higher Tm.
    expect(self).toBeGreaterThan(nonSelf);
  });

  it('θ decreases monotonically with temperature and stays in [0,1]', () => {
    const params = { deltaH: -380, deltaS: -1, strandConc: 1e-5 } as const;
    let prev = Number.POSITIVE_INFINITY;
    for (let tC = 0; tC <= 100; tC += 5) {
      const th = fractionDuplex(
        tC + KELVIN,
        params.deltaH,
        params.deltaS,
        params.strandConc,
        false,
      );
      expect(th).toBeGreaterThanOrEqual(0);
      expect(th).toBeLessThanOrEqual(1);
      expect(th).toBeLessThanOrEqual(prev + 1e-12);
      prev = th;
    }
  });

  it('θ → 1 far below Tm and → 0 far above (finite, no NaN at extremes)', () => {
    const args = [-380, -1, 1e-5, false] as const;
    const cold = fractionDuplex(-100 + KELVIN, ...args);
    const hot = fractionDuplex(300 + KELVIN, ...args);
    expect(cold).toBeGreaterThan(0.999);
    expect(Number.isFinite(cold)).toBe(true);
    expect(hot).toBeLessThan(1e-3);
    expect(Number.isFinite(hot)).toBe(true);
  });

  it('fractionDuplexAt37 lies in [0,1] and matches θ(37°C)', () => {
    const r = run({ deltaH: -380, deltaS: -1, strandConc: 1e-5 });
    const reported = r.metrics.find((m) => m.key === 'fractionDuplexAt37')?.value as number;
    const direct = fractionDuplex(37 + KELVIN, -380, -1, 1e-5, false);
    expect(reported).toBeCloseTo(direct, 10);
    expect(reported).toBeGreaterThanOrEqual(0);
    expect(reported).toBeLessThanOrEqual(1);
  });

  it('transition width is positive and narrows for a larger |ΔH°| (sharper melt)', () => {
    const wide = run({ deltaH: -200, deltaS: -0.55, strandConc: 1e-5 }).metrics.find(
      (m) => m.key === 'transitionWidth',
    )?.value as number;
    const sharp = run({ deltaH: -600, deltaS: -1.6, strandConc: 1e-5 }).metrics.find(
      (m) => m.key === 'transitionWidth',
    )?.value as number;
    expect(wide).toBeGreaterThan(0);
    expect(sharp).toBeGreaterThan(0);
    expect(sharp).toBeLessThan(wide);
  });

  it('is deterministic', () => {
    const a = run({ deltaH: -380, deltaS: -1, strandConc: 1e-5 });
    const b = run({ deltaH: -380, deltaS: -1, strandConc: 1e-5 });
    expect(a).toEqual(b);
  });

  it('exposes the melting curve as a series and a Tm/37°C detail', () => {
    const r = run({ deltaH: -380, deltaS: -1, strandConc: 1e-5, outputPoints: 50 });
    expect(r.series?.[0]?.x).toHaveLength(50);
    expect(r.series?.[0]?.y.fractionDuplex).toHaveLength(50);
    expect(spec.slug).toBe('dna-melting');
    expect(spec.domain).toBe('structural');
  });
});
