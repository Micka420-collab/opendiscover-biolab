/**
 * Bioreactor engine tests — validated against analytic fermentation theory.
 *
 * We check the science, not just "does not throw":
 *   - Monod kinetics reduce correctly in limits.
 *   - Analytic chemostat steady state matches textbook algebra.
 *   - Simulated CSTR converges to the analytic S*, X* and productivity.
 *   - Washout (D > muMax) drives biomass to ~0.
 *   - Batch biomass rises then plateaus; the X + Yxs*S invariant is conserved.
 *   - Fed-batch respects its volume and mass-balance invariants.
 *   - The optional noisy sensor channel is deterministic under a fixed seed.
 */

import { describe, expect, it } from 'vitest';
import {
  chemostatSteadyState,
  criticalDilutionRate,
  monodMu,
  paramsSchema,
  run,
  simulateBatch,
  spec,
} from './bioreactor';

describe('Monod kinetics', () => {
  it('is half of muMax at S = Ks', () => {
    expect(monodMu(0.5, 2, 2)).toBeCloseTo(0.25, 12);
  });

  it('saturates to muMax as S >> Ks and is 0 at S = 0', () => {
    expect(monodMu(0.5, 0.5, 1e6)).toBeCloseTo(0.5, 6);
    expect(monodMu(0.5, 0.5, 0)).toBe(0);
  });
});

describe('chemostat analytic steady state', () => {
  it('matches the textbook S* and X* algebra', () => {
    // muMax=0.4, Ks=0.5, Yxs=0.5, Sin=10, D=0.2
    // S* = Ks*D/(muMax-D) = 0.5*0.2/0.2 = 0.5
    // X* = Yxs*(Sin-S*) = 0.5*9.5 = 4.75
    const ss = chemostatSteadyState(0.4, 0.5, 0.5, 10, 0.2);
    expect(ss.washout).toBe(false);
    expect(ss.sStar).toBeCloseTo(0.5, 12);
    expect(ss.xStar).toBeCloseTo(4.75, 12);
    expect(ss.productivity).toBeCloseTo(0.95, 12); // D*X* = 0.2*4.75
  });

  it('flags washout when D exceeds the critical dilution rate', () => {
    const dCrit = criticalDilutionRate(0.4, 0.5, 10); // 0.4*10/10.5 ~ 0.381
    expect(dCrit).toBeCloseTo(0.380952, 5);
    const ss = chemostatSteadyState(0.4, 0.5, 0.5, 10, 0.5);
    expect(ss.washout).toBe(true);
    expect(ss.xStar).toBe(0);
    expect(ss.sStar).toBe(10); // residual = feed when nothing grows
  });
});

describe('chemostat simulation converges to analytic steady state', () => {
  it('S(tEnd) and X(tEnd) match S* and X* within tolerance', () => {
    const res = run({
      mode: 'chemostat',
      muMax: 0.4,
      ks: 0.5,
      yxs: 0.5,
      sin: 10,
      d: 0.2,
      x0: 0.5,
      s0: 5,
      tEnd: 300,
      outputPoints: 600,
    });
    const m = Object.fromEntries(res.metrics.map((x) => [x.key, x.value]));
    // Analytic targets baked into the metrics:
    expect(m.steadyStateSubstrate).toBeCloseTo(0.5, 6);
    expect(m.steadyStateBiomass).toBeCloseTo(4.75, 6);
    expect(m.productivity).toBeCloseTo(0.95, 6);
    // Simulated endpoint converges onto them:
    expect(m.simulatedSubstrate).toBeCloseTo(0.5, 2);
    expect(m.simulatedBiomass).toBeCloseTo(4.75, 2);
  });

  it('reaches the same steady state from a different initial condition', () => {
    const res = run({
      mode: 'chemostat',
      muMax: 0.4,
      ks: 0.5,
      yxs: 0.5,
      sin: 10,
      d: 0.2,
      x0: 4.0, // start above steady state
      s0: 0.2,
      tEnd: 300,
      outputPoints: 600,
    });
    const m = Object.fromEntries(res.metrics.map((x) => [x.key, x.value]));
    expect(m.simulatedSubstrate).toBeCloseTo(0.5, 2);
    expect(m.simulatedBiomass).toBeCloseTo(4.75, 2);
  });
});

describe('chemostat washout drives biomass to ~0', () => {
  it('X(tEnd) -> 0 and S(tEnd) -> Sin when D > muMax', () => {
    const res = run({
      mode: 'chemostat',
      muMax: 0.4,
      ks: 0.5,
      yxs: 0.5,
      sin: 10,
      d: 0.6, // > muMax => washout
      x0: 2.0,
      s0: 5,
      tEnd: 100,
      outputPoints: 300,
    });
    const m = Object.fromEntries(res.metrics.map((x) => [x.key, x.value]));
    expect(m.washout).toBe(1);
    expect(m.simulatedBiomass).toBeLessThan(1e-3);
    expect(m.simulatedSubstrate).toBeCloseTo(10, 2); // feed concentration
  });
});

describe('batch fermentation', () => {
  const res = run({
    mode: 'batch',
    muMax: 0.5,
    ks: 0.2,
    yxs: 0.5,
    alpha: 0.3,
    beta: 0,
    x0: 0.1,
    s0: 10,
    p0: 0,
    tEnd: 40,
    outputPoints: 800,
  });
  const m = Object.fromEntries(res.metrics.map((x) => [x.key, x.value]));
  const series = res.series![0];

  it('biomass rises monotonically then plateaus once substrate is gone', () => {
    const X = series.y.X;
    // Monotonic non-decreasing (no decay term in batch Monod growth).
    for (let i = 1; i < X.length; i++) {
      expect(X[i]).toBeGreaterThanOrEqual(X[i - 1] - 1e-9);
    }
    // Plateau: the last 5% of the trajectory barely changes.
    const n = X.length;
    const tail = X[n - 1] - X[Math.floor(n * 0.95)];
    expect(Math.abs(tail)).toBeLessThan(1e-3);
  });

  it('final biomass equals the yield prediction X0 + Yxs*(S0 - S_f)', () => {
    // With substrate essentially exhausted, X_f ~ X0 + Yxs*S0 = 0.1 + 5 = 5.1
    expect(m.finalBiomass).toBeCloseTo(5.1, 3);
    expect(m.finalSubstrate).toBeLessThan(0.02);
  });

  it('conserves the batch mass-balance invariant X + Yxs*S', () => {
    // Residual reported by the engine should be ~0.
    expect(Math.abs(m.massBalanceError)).toBeLessThan(1e-6);
    // And it holds pointwise along the whole trajectory.
    const X = series.y.X;
    const S = series.y.S;
    const inv0 = 0.1 + 0.5 * 10;
    for (let i = 0; i < X.length; i++) {
      expect(X[i] + 0.5 * S[i]).toBeCloseTo(inv0, 4);
    }
  });

  it('growth-associated product follows P = alpha*(X - X0)', () => {
    // beta = 0 => Luedeking–Piret reduces to P_f = alpha*(X_f - X0).
    const P = series.y.P;
    const expectedP = 0.3 * (m.finalBiomass - 0.1);
    expect(P[P.length - 1]).toBeCloseTo(expectedP, 4);
  });

  it('records a finite time to substrate exhaustion before tEnd', () => {
    expect(m.timeToSubstrateExhaustion).toBeGreaterThan(0);
    expect(m.timeToSubstrateExhaustion).toBeLessThan(40);
  });
});

describe('fed-batch', () => {
  const res = run({
    mode: 'fedbatch',
    muMax: 0.4,
    ks: 0.5,
    yxs: 0.5,
    alpha: 0.1,
    x0: 0.5,
    s0: 5,
    p0: 0,
    feedRate: 0.05,
    feedSubstrate: 200,
    v0: 1,
    tEnd: 20,
    outputPoints: 400,
  });
  const m = Object.fromEntries(res.metrics.map((x) => [x.key, x.value]));

  it('grows the working volume by F*tEnd', () => {
    // V(tEnd) = v0 + F*tEnd = 1 + 0.05*20 = 2 L
    expect(m.finalVolume).toBeCloseTo(2, 6);
  });

  it('conserves the fed-batch mass-balance invariant', () => {
    // m_S + m_X/Yxs - F*Sf*t is constant.
    expect(Math.abs(m.massBalanceError)).toBeLessThan(1e-4);
  });

  it('accumulates more total biomass than it started with', () => {
    const initialMass = 0.5 * 1; // X0 * V0
    expect(m.finalBiomassMass).toBeGreaterThan(initialMass);
  });
});

describe('determinism & provenance', () => {
  it('produces identical output for identical params (pure ODE)', () => {
    const a = run({ mode: 'batch', s0: 8, tEnd: 30 });
    const b = run({ mode: 'batch', s0: 8, tEnd: 30 });
    expect(a.series![0].y.X).toEqual(b.series![0].y.X);
    expect(a.metrics).toEqual(b.metrics);
  });

  it('reproduces the noisy sensor channel exactly under a fixed seed', () => {
    const p = { mode: 'batch' as const, sensorNoiseCv: 0.05, seed: 7, tEnd: 20 };
    const a = run(p);
    const b = run(p);
    expect(a.series![0].y.measuredBiomass).toEqual(b.series![0].y.measuredBiomass);
    // A different seed yields a different noisy trace.
    const c = run({ ...p, seed: 8 });
    expect(c.series![0].y.measuredBiomass).not.toEqual(a.series![0].y.measuredBiomass);
    // But the underlying (clean) biomass is unaffected by the seed.
    expect(c.series![0].y.X).toEqual(a.series![0].y.X);
  });

  it('exposes a runnable spec whose example is valid', () => {
    expect(spec.slug).toBe('bioreactor');
    expect(spec.domain).toBe('bioprocess');
    const out = spec.run(spec.example);
    expect(out.engine).toBe('bioreactor');
    expect(out.provenance.version).toBe('1.0.0');
    expect(out.metrics.length).toBeGreaterThan(0);
  });
});

describe('simulateBatch low-level', () => {
  it('returns aligned time/state arrays of the [X,S,P] shape', () => {
    const params = paramsSchema.parse({ mode: 'batch', tEnd: 10, outputPoints: 50 });
    const traj = simulateBatch(params);
    expect(traj.t.length).toBe(traj.y.length);
    expect(traj.y[0].length).toBe(3);
  });
});
