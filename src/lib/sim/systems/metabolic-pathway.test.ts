import { describe, expect, it } from 'vitest';
import { mmRate, spec } from './metabolic-pathway';

describe('mmRate — Michaelis-Menten, the same exact half-max property as enzyme-kinetics', () => {
  it('mmRate(Km, Vmax, Km) === Vmax/2 exactly', () => {
    expect(mmRate(5, 10, 5)).toBeCloseTo(5, 12);
    expect(mmRate(3, 20, 3)).toBeCloseTo(10, 12);
  });

  it('is 0 for non-positive substrate', () => {
    expect(mmRate(0, 10, 5)).toBe(0);
    expect(mmRate(-1, 10, 5)).toBe(0);
  });
});

describe('two-step pathway — closed-form steady state', () => {
  // S0=10 fixed, step1 Vmax=5/Km=2, step2 Vmax=6/Km=3.
  // J = mmRate(10,5,2) = 50/12 = 4.1666...  (known in closed form since S0 is fixed)
  // Solving J = mmRate(S1*,6,3) for S1*: J(3+S1*) = 6*S1*  =>  S1* = 3J/(6-J)
  //   = 3*4.166667/(6-4.166667) = 12.5/1.833333 = 6.818181818...
  // Verified independently against a from-scratch RK4 integration (in the
  // engine's dev derivation) before being trusted here.
  const J = (5 * 10) / (2 + 10);
  const s1Star = (3 * J) / (6 - J);

  it('the flux J matches the closed form for a fixed source', () => {
    expect(J).toBeCloseTo(4.166666666666667, 10);
  });

  it('simulated S1 converges to the hand-derived closed-form steady state', () => {
    const r = spec.run({
      sourceConcentration: 10,
      steps: [
        { vmax: 5, km: 2 },
        { vmax: 6, km: 3 },
      ],
      tEnd: 300,
    });
    expect(r.detail?.finalConcentrations[0]).toBeCloseTo(s1Star, 4);
    expect(s1Star).toBeCloseTo(6.818181818181819, 9);
  });

  it('the flux through both steps agrees at steady state', () => {
    const r = spec.run({
      sourceConcentration: 10,
      steps: [
        { vmax: 5, km: 2 },
        { vmax: 6, km: 3 },
      ],
      tEnd: 300,
    });
    expect(r.detail?.fluxByStep[0]).toBeCloseTo(J, 6);
    expect(r.detail?.fluxByStep[1]).toBeCloseTo(J, 6);
    expect(r.detail?.fluxUniformityError).toBeLessThan(1e-5);
  });
});

describe('three-step pathway (bottleneck-safe) — uniform flux at steady state', () => {
  it('every step carries the same flux once all downstream capacities exceed it', () => {
    const r = spec.run(spec.example); // vmax = [5, 6, 8]; source flux ≈ 4.1667 < min(6,8)
    const [f1, f2, f3] = r.detail?.fluxByStep ?? [];
    expect(f1).toBeCloseTo(4.166666666666667, 4);
    expect(f2).toBeCloseTo(f1, 4);
    expect(f3).toBeCloseTo(f1, 4);
    expect(r.detail?.fluxUniformityError).toBeLessThan(1e-3);
  });

  it('identifies the correct bottleneck step (smallest Vmax)', () => {
    const r = spec.run(spec.example); // vmax = [5, 6, 8] -> step 1 (index 0) is smallest
    expect(r.detail?.bottleneckStepIndex).toBe(0);
  });

  it('the achieved flux never exceeds the bottleneck Vmax (a basic MM bound)', () => {
    const r = spec.run(spec.example);
    const bottleneckVmax = 5; // spec.example's smallest Vmax
    for (const f of r.detail?.fluxByStep ?? []) {
      expect(f).toBeLessThan(bottleneckVmax);
    }
  });
});

describe('capacity-exceeded backup — a real, verifiable pathway phenomenon', () => {
  it('when a downstream Vmax is below the upstream steady flux, the intermediate accumulates without bound (does not converge)', () => {
    // Same source/step1/step2 as above (steady flux ~4.1667), but step 3's
    // Vmax=4 is BELOW that flux -> S2 can never reach a finite steady state;
    // it must keep growing for as long as we integrate.
    const r = spec.run({
      sourceConcentration: 10,
      steps: [
        { vmax: 5, km: 2 },
        { vmax: 6, km: 3 },
        { vmax: 4, km: 1.5 },
      ],
      tEnd: 100,
      outputPoints: 50,
    });
    const series = r.series?.[0];
    const s2 = series?.y.S2 ?? [];
    // S2 must be monotonically non-decreasing and still growing at the end
    // (last value strictly greater than the value a good way through the run).
    const mid = Math.floor(s2.length * 0.6);
    expect(s2[s2.length - 1]).toBeGreaterThan(s2[mid]);
    for (let i = 1; i < s2.length; i++) {
      expect(s2[i]).toBeGreaterThanOrEqual(s2[i - 1] - 1e-9);
    }
  });
});

describe('physical invariants', () => {
  it('all concentrations stay non-negative throughout', () => {
    const r = spec.run(spec.example);
    for (const series of r.series ?? []) {
      for (const values of Object.values(series.y)) {
        for (const v of values) expect(v).toBeGreaterThanOrEqual(-1e-9);
      }
    }
  });

  it('rejects a mismatched initialIntermediates length', () => {
    expect(
      () => spec.run({ ...spec.example, initialIntermediates: [0, 0] }), // example has 3 steps
    ).toThrow();
  });
});

describe('determinism', () => {
  it('identical params produce a byte-identical result', () => {
    expect(spec.run(spec.example)).toEqual(spec.run(spec.example));
  });
});
