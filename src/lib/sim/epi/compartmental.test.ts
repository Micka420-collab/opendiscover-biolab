import { describe, expect, it } from 'vitest';
import {
  type EpiRates,
  basicReproductionNumber,
  compartmentalParams,
  finalSize,
  findPeak,
  herdImmunityThreshold,
  peakInfectedFractionSIR,
  simulate,
  spec,
} from './compartmental';

// ---------------------------------------------------------------------------
// R0 definitions
// ---------------------------------------------------------------------------

describe('basic reproduction number', () => {
  it('is β/γ for SIR and SEIR', () => {
    expect(basicReproductionNumber('SIR', 0.5, 0.2)).toBeCloseTo(2.5, 12);
    expect(basicReproductionNumber('SEIR', 0.6, 0.2)).toBeCloseTo(3, 12);
  });

  it('is β/(γ+μ) for SIRD (mortality shortens the infectious period)', () => {
    // β/(γ+μ) = 0.5/(0.2+0.05) = 2, strictly below the SIR value β/γ = 2.5.
    expect(basicReproductionNumber('SIRD', 0.5, 0.2, 0.05)).toBeCloseTo(2, 12);
    expect(basicReproductionNumber('SIRD', 0.5, 0.2, 0.05)).toBeLessThan(
      basicReproductionNumber('SIR', 0.5, 0.2),
    );
  });
});

// ---------------------------------------------------------------------------
// Herd immunity threshold = 1 − 1/R0
// ---------------------------------------------------------------------------

describe('herd-immunity threshold 1 − 1/R0', () => {
  it('matches hand values for chosen R0', () => {
    expect(herdImmunityThreshold(2)).toBeCloseTo(0.5, 12); // 1 − 1/2
    expect(herdImmunityThreshold(4)).toBeCloseTo(0.75, 12); // 1 − 1/4
    expect(herdImmunityThreshold(5)).toBeCloseTo(0.8, 12); // measles-ish
  });

  it('is 0 when R0 ≤ 1 (no immunity needed)', () => {
    expect(herdImmunityThreshold(1)).toBe(0);
    expect(herdImmunityThreshold(0.7)).toBe(0);
  });

  it('the engine reports 1 − 1/R0 for a chosen R0', () => {
    // β=0.5, γ=0.2 ⇒ R0=2.5 ⇒ threshold = 1 − 1/2.5 = 0.6.
    const res = spec.run({
      model: 'SIR',
      beta: 0.5,
      gamma: 0.2,
      population: 1e6,
      i0: 10,
      tMax: 160,
    });
    const r0 = res.metrics.find((m) => m.key === 'r0')!.value;
    const herd = res.metrics.find((m) => m.key === 'herdImmunityThreshold')!.value;
    expect(r0).toBeCloseTo(2.5, 12);
    expect(herd).toBeCloseTo(1 - 1 / r0, 12);
    expect(herd).toBeCloseTo(0.6, 12);
  });
});

// ---------------------------------------------------------------------------
// Final epidemic size — transcendental equation vs textbook values
// ---------------------------------------------------------------------------

describe('final epidemic size (attack rate)', () => {
  it('reproduces textbook final sizes for a fully-susceptible start', () => {
    // Classic solutions of s∞ = e^{−R0(1−s∞)}; attack rate = 1 − s∞.
    expect(finalSize(1.5)).toBeCloseTo(0.5828, 3); // R0 = 1.5 → ~58.3%
    expect(finalSize(2.0)).toBeCloseTo(0.7968, 3); // R0 = 2   → ~79.7%
    expect(finalSize(2.5)).toBeCloseTo(0.8926, 3); // R0 = 2.5 → ~89.3%
    expect(finalSize(3.0)).toBeCloseTo(0.9405, 3); // R0 = 3   → ~94.0%
  });

  it('satisfies the self-consistency relation s∞ = e^{−R0(1−s∞)}', () => {
    for (const R0 of [1.2, 1.8, 2.4, 3.5]) {
      const attack = finalSize(R0);
      const sInf = 1 - attack;
      expect(sInf).toBeCloseTo(Math.exp(-R0 * (1 - sInf)), 6);
    }
  });

  it('is essentially zero (only the seed) when R0 ≤ 1', () => {
    // With a tiny seed and R0 < 1 there is no self-sustaining outbreak.
    expect(finalSize(0.8, 1 - 1e-6, 1e-6)).toBeLessThan(1e-3);
    expect(finalSize(0.5, 1 - 1e-6, 1e-6)).toBeLessThan(1e-3);
  });

  it('the analytic attack rate matches the integrated SIR trajectory', () => {
    // Run to completion (long horizon) and compare 1 − S(∞)/N to the equation.
    const res = spec.run({
      model: 'SIR',
      beta: 0.5,
      gamma: 0.2,
      population: 1e6,
      i0: 10,
      tMax: 400,
    });
    const analytic = res.detail!.finalSizeAnalytic;
    const simulated = res.detail!.finalSizeSimulated;
    expect(analytic).toBeCloseTo(0.8926, 3); // R0 = 2.5
    expect(simulated).toBeCloseTo(analytic, 2);
  });

  it('SEIR has the same final size as SIR at equal R0 (latency only delays)', () => {
    const seir = spec.run({
      model: 'SEIR',
      beta: 0.6,
      gamma: 0.2,
      sigma: 0.25,
      population: 1e6,
      i0: 10,
      tMax: 600,
    });
    // R0 = 3 ⇒ attack ≈ 0.9405, independent of the latent period.
    expect(seir.detail!.finalSizeAnalytic).toBeCloseTo(0.9405, 3);
    expect(seir.detail!.finalSizeSimulated).toBeCloseTo(seir.detail!.finalSizeAnalytic, 2);
  });
});

// ---------------------------------------------------------------------------
// Epidemic peak — closed form vs integrated trajectory
// ---------------------------------------------------------------------------

describe('epidemic peak prevalence (SIR closed form)', () => {
  it('matches i_max = 1 − (1 + ln R0)/R0 for a fully-susceptible start', () => {
    // R0 = 2 ⇒ 1 − (1+ln2)/2 = 0.15342.
    expect(peakInfectedFractionSIR(2)).toBeCloseTo(1 - (1 + Math.log(2)) / 2, 12);
    expect(peakInfectedFractionSIR(2)).toBeCloseTo(0.15342, 4);
    // R0 = 3 ⇒ 1 − (1+ln3)/3 = 0.30048.
    expect(peakInfectedFractionSIR(3)).toBeCloseTo(0.30048, 4);
  });

  it('the integrated SIR peak agrees with the closed form', () => {
    const N = 1e6;
    const i0 = 10;
    const res = spec.run({
      model: 'SIR',
      beta: 0.6,
      gamma: 0.2,
      population: N,
      i0,
      tMax: 120,
      outputPoints: 2000,
    });
    const peakFrac = res.detail!.peakInfectedFraction;
    const s0 = (N - i0) / N;
    const expected = peakInfectedFractionSIR(3, s0, i0 / N);
    expect(peakFrac).toBeCloseTo(expected, 3); // within ~0.1% of population
  });

  it('the reported peak occurs where S ≈ N/R0 (dI/dt = 0)', () => {
    const N = 1e6;
    const res = spec.run({
      model: 'SIR',
      beta: 0.6,
      gamma: 0.2,
      population: N,
      i0: 10,
      tMax: 120,
      outputPoints: 2000,
    });
    const traj = res.detail!.trajectory;
    const { peakIndex } = findPeak(traj);
    // At the peak the susceptible pool sits at the threshold N/R0.
    expect(traj.S[peakIndex] / N).toBeCloseTo(1 / 3, 2);
  });

  it('peak prevalence strictly exceeds the initial seed when R0 > 1', () => {
    const i0 = 10;
    const res = spec.run({ model: 'SIR', beta: 0.5, gamma: 0.2, population: 1e6, i0, tMax: 160 });
    const peak = res.metrics.find((m) => m.key === 'peakInfected')!.value;
    expect(peak).toBeGreaterThan(i0);
  });
});

// ---------------------------------------------------------------------------
// Population conservation
// ---------------------------------------------------------------------------

describe('population is conserved (S+E+I+R+D ≈ N at all times)', () => {
  const N = 1e6;
  const cases: Array<{ model: 'SIR' | 'SEIR' | 'SIRD'; rates: EpiRates }> = [
    { model: 'SIR', rates: { beta: 0.5, gamma: 0.2, sigma: 0.2, mu: 0 } },
    { model: 'SEIR', rates: { beta: 0.6, gamma: 0.2, sigma: 0.25, mu: 0 } },
    { model: 'SIRD', rates: { beta: 0.5, gamma: 0.2, sigma: 0.2, mu: 0.05 } },
  ];

  for (const c of cases) {
    it(`${c.model}: total mass stays at N along the whole trajectory`, () => {
      const traj = simulate(c.model, c.rates, N, 10, 200, 400);
      for (let i = 0; i < traj.t.length; i++) {
        const total = traj.S[i] + traj.E[i] + traj.I[i] + traj.R[i] + traj.D[i];
        expect(Math.abs(total - N) / N).toBeLessThan(1e-6);
      }
    });
  }

  it('SIRD splits removed individuals into recovered and dead in ratio γ:μ', () => {
    // In SIRD every infected individual eventually leaves I; a fraction γ/(γ+μ)
    // recovers and μ/(γ+μ) dies, so R(∞)/D(∞) = γ/μ.
    const res = spec.run({
      model: 'SIRD',
      beta: 0.5,
      gamma: 0.2,
      mu: 0.05,
      population: 1e6,
      i0: 10,
      tMax: 600,
    });
    const R = res.detail!.totalRecovered;
    const D = res.detail!.totalDeaths;
    expect(R / D).toBeCloseTo(0.2 / 0.05, 2); // γ/μ = 4
  });
});

// ---------------------------------------------------------------------------
// R0 < 1 ⇒ the infected compartment declines monotonically (no epidemic)
// ---------------------------------------------------------------------------

describe('sub-threshold dynamics (R0 < 1)', () => {
  it('SIR: prevalence declines monotonically', () => {
    // β=0.1, γ=0.2 ⇒ R0 = 0.5 < 1.
    const traj = simulate('SIR', { beta: 0.1, gamma: 0.2, sigma: 0.2, mu: 0 }, 1e6, 1000, 100, 400);
    for (let i = 1; i < traj.I.length; i++) {
      expect(traj.I[i]).toBeLessThanOrEqual(traj.I[i - 1] + 1e-9);
    }
    expect(traj.I[traj.I.length - 1]).toBeLessThan(traj.I[0]); // strictly died down
  });

  it('SIRD: prevalence declines monotonically', () => {
    // β=0.15, γ=0.2, μ=0.05 ⇒ R0 = 0.15/0.25 = 0.6 < 1.
    const traj = simulate(
      'SIRD',
      { beta: 0.15, gamma: 0.2, sigma: 0.2, mu: 0.05 },
      1e6,
      1000,
      100,
      400,
    );
    for (let i = 1; i < traj.I.length; i++) {
      expect(traj.I[i]).toBeLessThanOrEqual(traj.I[i - 1] + 1e-9);
    }
  });

  it('the engine summary flags "no epidemic" when R0 < 1', () => {
    const res = spec.run({
      model: 'SIR',
      beta: 0.1,
      gamma: 0.2,
      population: 1e6,
      i0: 1000,
      tMax: 100,
    });
    expect(res.metrics.find((m) => m.key === 'r0')!.value).toBeCloseTo(0.5, 12);
    expect(res.summary).toContain('no epidemic');
  });
});

// ---------------------------------------------------------------------------
// Engine contract & determinism
// ---------------------------------------------------------------------------

describe('engine run() contract', () => {
  it('emits the five required metrics and a time series', () => {
    const res = spec.run(spec.example);
    const keys = res.metrics.map((m) => m.key);
    expect(keys).toEqual(['r0', 'herdImmunityThreshold', 'peakInfected', 'peakDay', 'finalSize']);
    expect(res.engine).toBe('compartmental');
    expect(res.provenance.version).toBe('1.0.0');
    expect(res.series![0].y.S.length).toBeGreaterThan(0);
    expect(res.series![0].y.I.length).toBe(res.series![0].x.length);
  });

  it('includes the E series for SEIR and the D series for SIRD', () => {
    const seir = spec.run({
      model: 'SEIR',
      beta: 0.6,
      gamma: 0.2,
      sigma: 0.25,
      population: 1e6,
      i0: 10,
      tMax: 160,
    });
    expect(seir.series![0].y.E).toBeDefined();
    const sird = spec.run({
      model: 'SIRD',
      beta: 0.5,
      gamma: 0.2,
      mu: 0.05,
      population: 1e6,
      i0: 10,
      tMax: 160,
    });
    expect(sird.series![0].y.D).toBeDefined();
  });

  it('validates parameters through the zod schema (rejects β ≤ 0)', () => {
    expect(() => compartmentalParams.parse({ beta: -1, gamma: 0.2 })).toThrow();
  });
});

describe('determinism (stochastic reporting model)', () => {
  it('same seed → byte-identical result', () => {
    const params = {
      model: 'SIR' as const,
      beta: 0.5,
      gamma: 0.2,
      population: 1e6,
      i0: 10,
      tMax: 160,
      reportingRate: 0.6,
      seed: 'outbreak-7',
    };
    const a = spec.run(params);
    const b = spec.run(params);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.detail!.reportedIncidence).toBeDefined();
    expect(a.detail!.reportedIncidence!.reported).toEqual(b.detail!.reportedIncidence!.reported);
  });

  it('different seed → different reported incidence', () => {
    const base = {
      model: 'SIR' as const,
      beta: 0.5,
      gamma: 0.2,
      population: 1e6,
      i0: 10,
      tMax: 160,
      reportingRate: 0.6,
    };
    const a = spec.run({ ...base, seed: 'seed-A' });
    const b = spec.run({ ...base, seed: 'seed-B' });
    expect(a.detail!.reportedIncidence!.reported).not.toEqual(
      b.detail!.reportedIncidence!.reported,
    );
  });

  it('reported cases never exceed true new infections (ascertainment ≤ 1)', () => {
    const res = spec.run({
      model: 'SIR',
      beta: 0.5,
      gamma: 0.2,
      population: 1e6,
      i0: 10,
      tMax: 160,
      reportingRate: 0.6,
      seed: 'x',
    });
    const traj = res.detail!.trajectory;
    const rep = res.detail!.reportedIncidence!.reported;
    for (let k = 1; k < traj.t.length; k++) {
      const trueNew = Math.round(traj.S[k - 1] - traj.S[k]);
      expect(rep[k]).toBeLessThanOrEqual(trueNew);
      expect(rep[k]).toBeGreaterThanOrEqual(0);
    }
  });
});
