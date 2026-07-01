/**
 * Tests for the Gene Regulatory Network engine.
 *
 * These validate the *science*, not merely "does not throw":
 *  - Hill kinetics match closed-form activation/repression values.
 *  - The repressilator produces sustained oscillations (≥ 2 full mean-crossing
 *    cycles per species, amplitude above threshold).
 *  - The toggle switch is bistable: it converges to one of two mutually
 *    exclusive high/low states, and the winner flips when initial conditions
 *    are swapped.
 *  - Concentrations remain non-negative throughout.
 *  - The optional seeded initial-condition jitter is deterministic.
 */

import { describe, expect, it } from 'vitest';
import type { SimResult } from '../core/types';
import {
  type GrnDetail,
  analyzeSeries,
  buildDerivative,
  buildPreset,
  hillResponse,
  resolveNetwork,
  run,
  spec,
} from './grn';

function detailOf(res: SimResult<GrnDetail>): GrnDetail {
  return res.detail as GrnDetail;
}

function metric(res: SimResult<GrnDetail>, key: string): number {
  const m = res.metrics.find((mm) => mm.key === key);
  if (!m) throw new Error(`metric ${key} not found`);
  return m.value;
}

describe('Hill kinetics (closed form)', () => {
  it('activation Hill equals x^n/(K^n+x^n)', () => {
    // At x = K the response is exactly 1/2 regardless of n.
    expect(hillResponse(2, { sign: 1, K: 2, n: 4 })).toBeCloseTo(0.5, 12);
    // n = 1, K = 1, x = 3 → 3/4.
    expect(hillResponse(3, { sign: 1, K: 1, n: 1 })).toBeCloseTo(0.75, 12);
    // Large x → saturates to 1.
    expect(hillResponse(1000, { sign: 1, K: 1, n: 2 })).toBeGreaterThan(0.999);
  });

  it('repression Hill equals K^n/(K^n+x^n) and is 1 − activation', () => {
    expect(hillResponse(2, { sign: -1, K: 2, n: 4 })).toBeCloseTo(0.5, 12);
    expect(hillResponse(3, { sign: -1, K: 1, n: 1 })).toBeCloseTo(0.25, 12);
    // repression + activation = 1 for the same x, K, n.
    const x = 1.7;
    const act = hillResponse(x, { sign: 1, K: 1.3, n: 3 });
    const rep = hillResponse(x, { sign: -1, K: 1.3, n: 3 });
    expect(act + rep).toBeCloseTo(1, 12);
  });

  it('repression is monotonically decreasing in x', () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let x = 0; x <= 5; x += 0.25) {
      const r = hillResponse(x, { sign: -1, K: 1, n: 3 });
      expect(r).toBeLessThanOrEqual(prev + 1e-15);
      prev = r;
    }
  });
});

describe('derivative: analytic steady state of a single unregulated gene', () => {
  it('constitutive gene relaxes to (basal+beta)/gamma', () => {
    // No edges ⇒ activity = 1 ⇒ dp/dt = basal + beta − gamma·p ⇒ p* = (basal+beta)/gamma.
    const net = resolveNetwork({
      genes: [{ name: 'g', basal: 2, beta: 8, degradation: 2, y0: 0 }],
      edges: [],
      logic: 'multiplicative',
    });
    const f = buildDerivative(net);
    // Derivative at the predicted fixed point p* = (2+8)/2 = 5 must vanish.
    expect(f(0, [5])[0]).toBeCloseTo(0, 12);
    // And be positive below, negative above (stable attractor).
    expect(f(0, [0])[0]!).toBeGreaterThan(0);
    expect(f(0, [10])[0]!).toBeLessThan(0);
  });
});

describe('analyzeSeries oscillation detection (synthetic sine)', () => {
  it('recovers the period and amplitude of a known sinusoid', () => {
    // x(t) = 5 + 3 sin(2π t / P), P = 4, over 40 time units.
    const P = 4;
    const t: number[] = [];
    const x: number[] = [];
    const N = 4000;
    for (let i = 0; i <= N; i++) {
      const tt = (40 * i) / N;
      t.push(tt);
      x.push(5 + 3 * Math.sin((2 * Math.PI * tt) / P));
    }
    const a = analyzeSeries(t, x, 'sine');
    expect(a.oscillatory).toBe(true);
    expect(a.estimatedPeriod).not.toBeNull();
    expect(a.estimatedPeriod!).toBeCloseTo(P, 1);
    expect(a.amplitude).toBeCloseTo(3, 1);
    expect(a.cycles).toBeGreaterThanOrEqual(2);
  });

  it('does not flag a flat line as oscillatory and calls it steady', () => {
    const t = Array.from({ length: 200 }, (_, i) => i * 0.5);
    const x = t.map(() => 7);
    const a = analyzeSeries(t, x, 'flat');
    expect(a.oscillatory).toBe(false);
    expect(a.steadyState).toBe(true);
  });
});

describe('repressilator produces sustained oscillations', () => {
  const res = run({ preset: 'repressilator', tMax: 100, outputPoints: 3000 });
  const detail = detailOf(res);

  it('classifies the run as oscillatory', () => {
    expect(detail.behavior).toBe('oscillatory');
  });

  it('every species completes at least 2 full mean-crossing cycles', () => {
    expect(detail.analyses).toHaveLength(3);
    for (const a of detail.analyses) {
      expect(a.oscillatory).toBe(true);
      expect(a.cycles).toBeGreaterThanOrEqual(2);
    }
  });

  it('oscillation amplitude is well above the noise floor', () => {
    for (const a of detail.analyses) {
      expect(a.amplitude).toBeGreaterThan(1);
    }
    expect(metric(res, 'amplitude')).toBeGreaterThan(1);
  });

  it('reports a positive finite estimated period', () => {
    const period = metric(res, 'estimatedPeriod');
    expect(period).toBeGreaterThan(0);
    expect(Number.isFinite(period)).toBe(true);
  });

  it('keeps all concentrations non-negative', () => {
    const s = res.series![0]!;
    for (const key of Object.keys(s.y)) {
      for (const v of s.y[key]!) expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('toggle switch is bistable and initial-condition dependent', () => {
  it('with A starting high, A wins (high A, low B), mutually exclusive', () => {
    const res = run({ preset: 'toggleSwitch', initial: [5, 1], tMax: 80 });
    const A = metric(res, 'finalStateA');
    const B = metric(res, 'finalStateB');
    expect(A).toBeGreaterThan(B);
    expect(A).toBeGreaterThan(5); // ON state near beta/gamma
    expect(B).toBeLessThan(1); // OFF state near basal/gamma
    expect(metric(res, 'winnerIndex')).toBe(0);
    expect(detailOf(res).behavior).toBe('toggle');
  });

  it('swapping the initial conditions flips the winner to B', () => {
    const res = run({ preset: 'toggleSwitch', initial: [1, 5], tMax: 80 });
    const A = metric(res, 'finalStateA');
    const B = metric(res, 'finalStateB');
    expect(B).toBeGreaterThan(A);
    expect(B).toBeGreaterThan(5);
    expect(A).toBeLessThan(1);
    expect(metric(res, 'winnerIndex')).toBe(1);
  });

  it('the two attractors are the same regardless of which gene wins (symmetry)', () => {
    const resA = run({ preset: 'toggleSwitch', initial: [5, 1], tMax: 80 });
    const resB = run({ preset: 'toggleSwitch', initial: [1, 5], tMax: 80 });
    // High(A-wins) ≈ High(B-wins); Low(A-wins) ≈ Low(B-wins).
    expect(metric(resA, 'finalStateA')).toBeCloseTo(metric(resB, 'finalStateB'), 2);
    expect(metric(resA, 'finalStateB')).toBeCloseTo(metric(resB, 'finalStateA'), 2);
  });

  it('keeps concentrations non-negative', () => {
    const res = run({ preset: 'toggleSwitch', initial: [5, 1], tMax: 80 });
    const s = res.series![0]!;
    for (const key of Object.keys(s.y)) {
      for (const v of s.y[key]!) expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('feed-forward loop settles to a steady ON state', () => {
  const res = run({ preset: 'feedForwardLoop', tMax: 60 });
  const detail = detailOf(res);

  it('reaches a non-oscillatory steady state', () => {
    expect(detail.behavior).toBe('steady-state');
    for (const a of detail.analyses) expect(a.steadyState).toBe(true);
  });

  it('activates X, Y and Z (all end high and positive)', () => {
    const [X, Y, Z] = detail.finalState;
    expect(X!).toBeGreaterThan(4); // X ≈ beta/gamma = 5
    expect(Y!).toBeGreaterThan(3);
    expect(Z!).toBeGreaterThan(3);
    for (const v of detail.finalState) expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe('linear-stability threshold: odd-N Hopf secant vs even-N real-eigenvalue saddle', () => {
  // Reference: Thron CD, "The secant condition for instability in biochemical
  // feedback control models," Bull Math Biol 53:383-401 (1991); Mallet-Paret J,
  // Smith HL, "The Poincare-Bendixson theorem for monotone cyclic feedback
  // systems," J Dyn Diff Eq 2:367-421 (1990).
  //
  // Linearizing a symmetric N-gene repressor ring about its symmetric fixed
  // point p* gives a circulant Jacobian with eigenvalues
  //   λ_k = -γ - m·exp(i·2πk/N),  k = 0..N-1,  m = |f'(p*)|.
  // The least-stable mode sits at whichever k lands closest to angle π:
  //   - odd N (repressilator, N=3): no k lands exactly on π; the closest pair
  //     is at π ± π/N, giving a complex-conjugate (Hopf) threshold m/γ > sec(π/N).
  //   - even N (toggle switch, N=2): k=N/2 lands exactly on π, giving a REAL
  //     eigenvalue λ = -γ + m, so the threshold is simply m/γ > 1 — a saddle,
  //     not a Hopf bifurcation. sec(π/2) is undefined (cos 90° = 0), so the
  //     odd-N formula cannot be applied here.

  /** Symmetric fixed point of p' = basal + beta*H(p) - gamma*p via bisection. */
  function symmetricFixedPoint(
    basal: number,
    beta: number,
    gamma: number,
    edge: { K: number; n: number },
  ): number {
    const g = (p: number) => basal + beta * hillResponse(p, { sign: -1, ...edge }) - gamma * p;
    let lo = 0;
    let hi = 100;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (g(mid) > 0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /** |d/dp [basal + beta*H(p)]| at p via central finite difference. */
  function loopGainMagnitude(beta: number, p: number, edge: { K: number; n: number }): number {
    const h = 1e-5 * Math.max(1, p);
    const H = (x: number) => hillResponse(x, { sign: -1, ...edge });
    return Math.abs((beta * H(p + h) - beta * H(p - h)) / (2 * h));
  }

  it('repressilator (odd N=3): |f’(p*)|/γ exceeds the Hopf secant threshold sec(π/3) = 2', () => {
    const preset = buildPreset('repressilator');
    const g0 = preset.genes[0]!;
    const e = preset.edges[0]!; // K=1, n=4 on every edge
    const pStar = symmetricFixedPoint(g0.basal, g0.beta, g0.degradation, { K: e.K, n: e.n });
    const m = loopGainMagnitude(g0.beta, pStar, { K: e.K, n: e.n });
    const secThreshold = 1 / Math.cos(Math.PI / 3);
    expect(secThreshold).toBeCloseTo(2, 10);
    expect(m / g0.degradation).toBeGreaterThan(secThreshold);
  });

  it('toggle switch (even N=2): |f’(p*)|/γ exceeds the real-eigenvalue saddle threshold of 1 (sec(π/2) is undefined)', () => {
    const preset = buildPreset('toggleSwitch');
    const g0 = preset.genes[0]!;
    const e = preset.edges[0]!; // K=1, n=3
    const pStar = symmetricFixedPoint(g0.basal, g0.beta, g0.degradation, { K: e.K, n: e.n });
    const m = loopGainMagnitude(g0.beta, pStar, { K: e.K, n: e.n });
    // cos(pi/2) = 0 => sec(pi/2) is undefined; the odd-N Hopf formula does not
    // apply to this even-N ring. The actual instability condition is m/gamma > 1.
    expect(Math.cos(Math.PI / 2)).toBeCloseTo(0, 10);
    expect(m / g0.degradation).toBeGreaterThan(1);
  });
});

describe('custom network and validation', () => {
  it('runs a user-supplied two-node repression network', () => {
    const res = run({
      network: {
        genes: [
          { name: 'a', basal: 0.1, beta: 10, degradation: 1, y0: 2 },
          { name: 'b', basal: 0.1, beta: 10, degradation: 1, y0: 0.1 },
        ],
        edges: [
          { from: 'b', to: 'a', sign: -1, K: 1, n: 3 },
          { from: 'a', to: 'b', sign: -1, K: 1, n: 3 },
        ],
        logic: 'multiplicative',
      },
      tMax: 60,
    });
    expect(res.detail!.genes).toEqual(['a', 'b']);
    // a starts higher, so a should end higher (mutual repression).
    expect(res.detail!.finalState[0]!).toBeGreaterThan(res.detail!.finalState[1]!);
  });

  it('rejects a network with mismatched initial-condition length', () => {
    expect(() => run({ preset: 'toggleSwitch', initial: [1, 2, 3] })).toThrow();
  });

  it('rejects params with neither preset nor network', () => {
    expect(() => run({} as never)).toThrow();
  });
});

describe('determinism (seeded initial-condition jitter)', () => {
  it('same seed → byte-identical trajectories', () => {
    const a = run({
      preset: 'repressilator',
      initialNoise: 0.2,
      seed: 42,
      tMax: 40,
      outputPoints: 500,
    });
    const b = run({
      preset: 'repressilator',
      initialNoise: 0.2,
      seed: 42,
      tMax: 40,
      outputPoints: 500,
    });
    expect(a.series![0]!.y).toEqual(b.series![0]!.y);
    expect(a.metrics).toEqual(b.metrics);
  });

  it('different seeds → different trajectories (but still oscillatory)', () => {
    const a = run({
      preset: 'repressilator',
      initialNoise: 0.3,
      seed: 1,
      tMax: 60,
      outputPoints: 800,
    });
    const b = run({
      preset: 'repressilator',
      initialNoise: 0.3,
      seed: 2,
      tMax: 60,
      outputPoints: 800,
    });
    expect(a.series![0]!.y).not.toEqual(b.series![0]!.y);
    expect(detailOf(a).behavior).toBe('oscillatory');
    expect(detailOf(b).behavior).toBe('oscillatory');
  });
});

describe('engine spec metadata', () => {
  it('has the required shape', () => {
    expect(spec.slug).toBe('grn');
    expect(spec.domain).toBe('systems-biology');
    expect(spec.version).toBe('1.0.0');
    expect(spec.paramsSchema.parse(spec.example)).toBeTruthy();
    const res = spec.run(spec.example);
    expect(res.engine).toBe('grn');
    expect(res.provenance.version).toBe('1.0.0');
  });

  it('preset builders produce valid resolvable networks', () => {
    for (const p of ['repressilator', 'toggleSwitch', 'feedForwardLoop'] as const) {
      const preset = buildPreset(p);
      const net = resolveNetwork({ genes: preset.genes, edges: preset.edges, logic: preset.logic });
      expect(net.genes.length).toBeGreaterThan(0);
      expect(net.inputs.length).toBe(net.genes.length);
    }
  });
});

describe('detail.edges — the resolved network topology, by gene name', () => {
  it('the repressilator is exactly the 3-cycle of repressors g0 -> g1 -> g2 -> g0', () => {
    const r = spec.run({ preset: 'repressilator' });
    const edges = r.detail?.edges ?? [];
    expect(edges).toHaveLength(3);
    expect(edges.every((e) => e.sign === -1)).toBe(true);
    const asPairs = new Set(edges.map((e) => `${e.from}->${e.to}`));
    expect(asPairs).toEqual(new Set(['g0->g1', 'g1->g2', 'g2->g0']));
  });

  it('the toggle switch is exactly the 2 mutual-repression edges', () => {
    const r = spec.run({ preset: 'toggleSwitch' });
    const edges = r.detail?.edges ?? [];
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.sign === -1)).toBe(true);
    const asPairs = new Set(edges.map((e) => `${e.from}->${e.to}`));
    expect(asPairs).toEqual(new Set(['A->B', 'B->A']));
  });

  it('an explicit custom network round-trips to the same edge list', () => {
    const r = spec.run({
      network: {
        genes: [{ name: 'X' }, { name: 'Y' }],
        edges: [{ from: 'X', to: 'Y', sign: 1 }],
        logic: 'additive',
      },
    });
    expect(r.detail?.edges).toEqual([{ from: 'X', to: 'Y', sign: 1 }]);
  });
});
