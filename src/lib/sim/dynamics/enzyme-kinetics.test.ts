import { describe, expect, it } from 'vitest';
import {
  apparentKm,
  apparentVmax,
  competitive,
  enzymeKineticsParams,
  hill,
  lineweaverBurk,
  michaelisMenten,
  noncompetitive,
  spec,
  uncompetitive,
  velocity,
  velocityVsSubstrate,
} from './enzyme-kinetics';

// A reusable base parameter set with a large sMax so the curve nears saturation.
const base = enzymeKineticsParams.parse({
  vmax: 10,
  km: 5,
  sMax: 500, // 100·Km ⇒ v(sMax) ≈ 0.99·Vmax
});

describe('michaelisMenten (defining properties)', () => {
  it('gives exactly Vmax/2 at [S] = Km', () => {
    // The canonical definition of the Michaelis constant.
    expect(michaelisMenten(5, 10, 5)).toBe(5); // Vmax/2 = 10/2
    expect(michaelisMenten(2, 8, 2)).toBe(4);
    expect(michaelisMenten(0.37, 123, 0.37)).toBeCloseTo(61.5, 10);
  });

  it('is 0 at [S] = 0 and → Vmax as [S] → ∞', () => {
    expect(michaelisMenten(0, 10, 5)).toBe(0);
    expect(michaelisMenten(1e9, 10, 5)).toBeCloseTo(10, 6);
  });

  it('matches a hand-computed intermediate value', () => {
    // v = 10·20 / (5 + 20) = 200/25 = 8
    expect(michaelisMenten(20, 10, 5)).toBe(8);
  });
});

describe('hill equation', () => {
  it('with n = 1 is identical to Michaelis–Menten', () => {
    for (const s of [0.1, 1, 5, 12.5, 50, 250]) {
      expect(hill(s, 10, 5, 1)).toBeCloseTo(michaelisMenten(s, 10, 5), 12);
    }
  });

  it('gives Vmax/2 at [S] = K for any n', () => {
    expect(hill(5, 10, 5, 1)).toBeCloseTo(5, 12);
    expect(hill(5, 10, 5, 2)).toBeCloseTo(5, 12);
    expect(hill(5, 10, 5, 4)).toBeCloseTo(5, 12);
  });

  it('is steeper (more switch-like) for larger n', () => {
    // Below K a higher Hill coefficient suppresses activity more strongly.
    const low = 2.5; // = K/2
    expect(hill(low, 10, 5, 4)).toBeLessThan(hill(low, 10, 5, 1));
    // Above K a higher Hill coefficient boosts activity toward Vmax faster.
    const high = 10; // = 2K
    expect(hill(high, 10, 5, 4)).toBeGreaterThan(hill(high, 10, 5, 1));
  });
});

describe('reversible inhibition rate laws', () => {
  const Vmax = 10;
  const Km = 5;
  const I = 4;
  const Ki = 2; // ⇒ α = 1 + I/Ki = 3

  it('competitive inflates apparent Km by α, keeps Vmax', () => {
    // v = Vmax·S / (α·Km + S); with S = α·Km the velocity is Vmax/2.
    expect(competitive(15, Vmax, Km, I, Ki)).toBeCloseTo(Vmax / 2, 12); // α·Km = 15
    // Asymptote unchanged.
    expect(competitive(1e9, Vmax, Km, I, Ki)).toBeCloseTo(Vmax, 4);
  });

  it('noncompetitive scales Vmax by 1/α, keeps Km', () => {
    // Half-saturation still at S = Km, but of the reduced Vmax/α.
    expect(noncompetitive(Km, Vmax, Km, I, Ki)).toBeCloseTo(Vmax / (2 * 3), 12);
    expect(noncompetitive(1e9, Vmax, Km, I, Ki)).toBeCloseTo(Vmax / 3, 4);
  });

  it('uncompetitive scales both Vmax and Km by 1/α', () => {
    // Asymptote = Vmax/α; half of that reached at S = Km/α.
    expect(uncompetitive(1e9, Vmax, Km, I, Ki)).toBeCloseTo(Vmax / 3, 4);
    expect(uncompetitive(Km / 3, Vmax, Km, I, Ki)).toBeCloseTo(Vmax / (2 * 3), 12);
  });

  it('with no inhibitor (I = 0) every variant collapses to plain MM', () => {
    for (const s of [1, 5, 25, 100]) {
      expect(competitive(s, Vmax, Km, 0, Ki)).toBeCloseTo(michaelisMenten(s, Vmax, Km), 12);
      expect(noncompetitive(s, Vmax, Km, 0, Ki)).toBeCloseTo(michaelisMenten(s, Vmax, Km), 12);
      expect(uncompetitive(s, Vmax, Km, 0, Ki)).toBeCloseTo(michaelisMenten(s, Vmax, Km), 12);
    }
  });
});

describe('competitive inhibitor raises the [S] needed for half-Vmax', () => {
  it('apparent half-saturation increases with inhibitor', () => {
    const clean = { ...base, mode: 'competitive' as const, inhibitor: 0 };
    const inhibited = { ...base, mode: 'competitive' as const, inhibitor: 4, ki: 2 };
    const kmClean = apparentKm({ ...clean, hillN: 1 });
    const kmInh = apparentKm({ ...inhibited, hillN: 1 });
    expect(kmClean).toBeCloseTo(5, 12); // Km
    expect(kmInh).toBeCloseTo(15, 12); // α·Km = 3·5
    expect(kmInh).toBeGreaterThan(kmClean);

    // Apparent Vmax (asymptote) is unchanged by a competitive inhibitor.
    expect(apparentVmax({ ...inhibited, hillN: 1 })).toBeCloseTo(10, 12);
  });
});

describe('velocity curve monotonicity and saturation', () => {
  it('is strictly increasing in [S] and asymptotes to Vmax', () => {
    const curve = velocityVsSubstrate(base, base.sMax ?? 500, 200);
    for (let i = 1; i < curve.v.length; i++) {
      expect(curve.v[i]).toBeGreaterThan(curve.v[i - 1]);
    }
    // At sMax = 100·Km the curve is within ~1% of Vmax and never exceeds it.
    const last = curve.v[curve.v.length - 1];
    expect(last).toBeLessThan(base.vmax);
    expect(last).toBeGreaterThan(0.98 * base.vmax);
  });
});

describe('Lineweaver–Burk recovers Km and Vmax from clean MM data', () => {
  it('fit intercept = 1/Vmax, slope = Km/Vmax, x-intercept = -1/Km', () => {
    const curve = velocityVsSubstrate(base, 200, 40);
    const lb = lineweaverBurk(curve.S, curve.v);
    expect(lb.vmaxFit).toBeCloseTo(10, 6);
    expect(lb.kmFit).toBeCloseTo(5, 6);
    expect(lb.intercept).toBeCloseTo(1 / 10, 8);
    expect(lb.slope).toBeCloseTo(5 / 10, 8);
    expect(lb.xIntercept).toBeCloseTo(-1 / 5, 6);
  });
});

describe('progress curve obeys the integrated Michaelis–Menten equation', () => {
  it('Vmax·t = (S0 − S) + Km·ln(S0/S) along the RK45 trajectory', () => {
    // Textbook closed form for single-substrate depletion (Cornish-Bowden §3).
    const res = spec.run({ vmax: 10, km: 5, sMax: 100, progressPoints: 400 });
    const pc = res.detail!.progressCurve;
    const S0 = pc.S[0];
    const Vmax = 10;
    const Km = 5;
    let maxRelErr = 0;
    for (let i = 1; i < pc.t.length; i++) {
      const S = pc.S[i];
      // Only test where S is well within (0, S0): interpolation/round-off blow
      // up the ln term as S → 0.
      if (S < 0.05 * S0 || S > 0.98 * S0) continue;
      const lhs = Vmax * pc.t[i];
      const rhs = S0 - S + Km * Math.log(S0 / S);
      maxRelErr = Math.max(maxRelErr, Math.abs(lhs - rhs) / rhs);
    }
    expect(maxRelErr).toBeLessThan(5e-3);
  });

  it('substrate is monotonically non-increasing and stays non-negative', () => {
    const res = spec.run({ vmax: 10, km: 5, sMax: 100 });
    const pc = res.detail!.progressCurve;
    for (let i = 1; i < pc.S.length; i++) {
      expect(pc.S[i]).toBeLessThanOrEqual(pc.S[i - 1] + 1e-9);
      expect(pc.S[i]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('engine run() contract', () => {
  it('reports vAtKm = Vmax/2 and half-saturation = Km for plain MM', () => {
    const res = spec.run(spec.example);
    const vAtKm = res.metrics.find((m) => m.key === 'vAtKm')!.value;
    const halfSat = res.metrics.find((m) => m.key === 'halfSaturation')!.value;
    expect(vAtKm).toBe(spec.example.vmax / 2);
    expect(halfSat).toBeCloseTo(spec.example.km, 12);
    expect(res.engine).toBe('enzyme-kinetics');
    expect(res.series![0].y.velocity.length).toBeGreaterThan(0);
    expect(res.provenance.version).toBe('1.0.0');
  });

  it('velocity dispatcher matches the individual rate laws', () => {
    const m = { vmax: 10, km: 5, mode: 'uncompetitive' as const, inhibitor: 4, ki: 2, hillN: 1 };
    expect(velocity(7, m)).toBeCloseTo(uncompetitive(7, 10, 5, 4, 2), 12);
  });
});

describe('determinism', () => {
  it('same seed → byte-identical result (incl. noisy assay data)', () => {
    const params = { vmax: 10, km: 5, sMax: 200, noiseCv: 0.1, seed: 'assay-42' };
    const a = spec.run(params);
    const b = spec.run(params);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.detail!.assayData).toBeDefined();
    expect(a.detail!.assayData!.vMeasured).toEqual(b.detail!.assayData!.vMeasured);
  });

  it('different seed → different noisy assay data', () => {
    const a = spec.run({ vmax: 10, km: 5, sMax: 200, noiseCv: 0.1, seed: 'seed-A' });
    const b = spec.run({ vmax: 10, km: 5, sMax: 200, noiseCv: 0.1, seed: 'seed-B' });
    expect(a.detail!.assayData!.vMeasured).not.toEqual(b.detail!.assayData!.vMeasured);
  });
});
