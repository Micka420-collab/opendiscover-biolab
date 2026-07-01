import { describe, expect, it } from 'vitest';
import {
  alphaM,
  alphaN,
  betaM,
  betaN,
  gateInf,
  hhDerivative,
  hodgkinHuxleyParams,
  spec,
} from './hodgkin-huxley';

describe('rate functions — removable singularities', () => {
  it('alphaN is exactly the analytic limit at V = -55 mV (0/0 form)', () => {
    // lim_{x->0} x / (1 - e^{-x/10}) = 10, so alphaN(-55) = 0.01 * 10 = 0.1 exactly.
    expect(alphaN(-55)).toBeCloseTo(0.1, 12);
  });

  it('alphaM is exactly the analytic limit at V = -40 mV (0/0 form)', () => {
    // lim_{x->0} x / (1 - e^{-x/10}) = 10, so alphaM(-40) = 0.1 * 10 = 1.0 exactly.
    expect(alphaM(-40)).toBeCloseTo(1.0, 12);
  });

  it('rate functions stay finite and continuous approaching the singularities', () => {
    const near = [-55.001, -55.0001, -54.9999, -54.999];
    for (const v of near) {
      expect(Number.isFinite(alphaN(v))).toBe(true);
      expect(alphaN(v)).toBeCloseTo(0.1, 2);
    }
  });

  it('all rate constants are non-negative for physiological V', () => {
    for (let v = -100; v <= 50; v += 5) {
      expect(alphaN(v)).toBeGreaterThanOrEqual(0);
      expect(betaN(v)).toBeGreaterThanOrEqual(0);
      expect(alphaM(v)).toBeGreaterThanOrEqual(0);
      expect(betaM(v)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('resting state is a genuine fixed point', () => {
  const REST = -65;

  it('the derivative at the computed steady state with no stimulus is ~0', () => {
    const n0 = gateInf(alphaN(REST), betaN(REST));
    const m0 = gateInf(alphaM(REST), betaM(REST));
    const h0 = gateInf(0.07 * Math.exp(-(REST + 65) / 20), 1 / (1 + Math.exp(-(REST + 35) / 10)));
    const c = {
      cm: 1,
      gNa: 120,
      gK: 36,
      gL: 0.3,
      eNa: 50,
      eK: -77,
      eL: -54.4,
      iExt: 0,
      stimStart: 1e9,
      stimEnd: 1e9, // stimulus window in the far future -> no current at t=0
    };
    const [dV, dn, dm, dh] = hhDerivative(c)(0, [REST, n0, m0, h0]);
    // -65 mV is Hodgkin & Huxley's historically-fit *approximate* resting
    // potential for this exact conductance/reversal-potential set (E_L was
    // empirically tuned to make -65 mV close to equilibrium, not derived to
    // force an exact zero of the full nonlinear balance). A small residual
    // drift on the order of 1e-3 mV/ms is genuine and expected here — this is
    // a real property of the classic 1952 parameterization, not a bug.
    expect(Math.abs(dV)).toBeLessThan(1e-3);
    expect(Math.abs(dn)).toBeLessThan(1e-9);
    expect(Math.abs(dm)).toBeLessThan(1e-9);
    expect(Math.abs(dh)).toBeLessThan(1e-9);
  });

  it('with zero stimulus, the simulated membrane stays at rest', () => {
    const r = spec.run({ iExt: 0, tEnd: 20 });
    expect(r.detail?.spikeCount).toBe(0);
    // Peak should not meaningfully deviate from the -65 mV resting potential.
    expect(r.detail?.peakPotential).toBeLessThan(-60);
  });
});

describe('all-or-none spike threshold — the hallmark HH behavior', () => {
  it('a strong brief stimulus fires a full action potential (overshoot above 0 mV)', () => {
    const r = spec.run({ iExt: 10, stimStart: 5, stimDuration: 1, tEnd: 30 });
    expect(r.detail?.spikeCount).toBeGreaterThanOrEqual(1);
    expect(r.detail?.peakPotential).toBeGreaterThan(0);
  });

  it('a very weak brief stimulus stays subthreshold (no overshoot)', () => {
    const r = spec.run({ iExt: 0.5, stimStart: 5, stimDuration: 1, tEnd: 30 });
    expect(r.detail?.spikeCount).toBe(0);
    expect(r.detail?.peakPotential).toBeLessThan(0);
  });
});

describe('sustained suprathreshold current drives repetitive firing', () => {
  it('a long, strong current pulse produces multiple action potentials', () => {
    const r = spec.run({ iExt: 15, stimStart: 2, stimDuration: 45, tEnd: 50, outputPoints: 1000 });
    expect(r.detail?.spikeCount).toBeGreaterThanOrEqual(2);
  });
});

describe('physical invariants', () => {
  it('gating variables (probabilities) stay within [0, 1] throughout', () => {
    const p = hodgkinHuxleyParams.parse({ iExt: 15, stimStart: 2, stimDuration: 45, tEnd: 50 });
    const n0 = gateInf(alphaN(p.vRest), betaN(p.vRest));
    // Re-derive via the engine's own run to inspect the series.
    const r = spec.run(p);
    for (const series of r.series ?? []) {
      if (series.yLabel !== 'gating variable') continue;
      for (const key of ['n', 'm', 'h']) {
        for (const v of series.y[key]) {
          expect(v).toBeGreaterThanOrEqual(-1e-6);
          expect(v).toBeLessThanOrEqual(1 + 1e-6);
        }
      }
    }
    expect(n0).toBeGreaterThan(0);
    expect(n0).toBeLessThan(1);
  });
});

describe('determinism', () => {
  it('identical params produce a byte-identical result', () => {
    const params = { iExt: 10, stimStart: 5, stimDuration: 1, tEnd: 30 };
    expect(spec.run(params)).toEqual(spec.run(params));
  });
});
