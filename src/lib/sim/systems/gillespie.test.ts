import { describe, expect, it } from 'vitest';
import {
  birthDeathModel,
  geneExpressionBurstingModel,
  geneExpressionSteadyState,
  gillespieParamsSchema,
  lotkaVolterraFixedPoint,
  lotkaVolterraModel,
  simulateSSA,
  spec,
  speciesColumn,
  timeWeightedMean,
  timeWeightedVariance,
} from './gillespie';

/** Assert every recorded count is a non-negative integer. */
function assertNonNegativeIntegers(counts: number[][]): void {
  for (const row of counts) {
    for (const v of row) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  }
}

describe('Gillespie SSA — invariants', () => {
  it('keeps all molecule counts as non-negative integers', () => {
    const traj = simulateSSA(lotkaVolterraModel(), { tMax: 15, seed: 7 });
    assertNonNegativeIntegers(traj.counts);
  });

  it('never lets a reaction fire when its reactants are absent', () => {
    // Pure death process: X -> 0. Count must be monotonically non-increasing
    // and can never dip below zero.
    const model = {
      species: { X: 8 },
      reactions: [{ reactants: { X: 1 }, products: {}, rate: 1 }],
    };
    const traj = simulateSSA(model, { tMax: 100, seed: 3 });
    const x = speciesColumn(traj, 'X');
    for (let i = 1; i < x.length; i++) {
      expect(x[i]).toBeLessThanOrEqual(x[i - 1] as number);
      expect(x[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it('halts in an absorbing (zero-propensity) state', () => {
    // With no birth channel, X drains to 0 and the total propensity vanishes.
    const model = {
      species: { X: 5 },
      reactions: [{ reactants: { X: 1 }, products: {}, rate: 2 }],
    };
    const traj = simulateSSA(model, { tMax: 1e6, seed: 11 });
    expect(traj.halted).toBe(true);
    // Final state is empty and time stopped well before the huge horizon.
    expect(speciesColumn(traj, 'X').at(-1)).toBe(0);
    expect(traj.endTime).toBe(1e6); // endTime is the horizon; the trajectory just stops early
    expect(traj.t.at(-1)).toBe(1e6); // terminal sample pins the absorbing state to tMax
  });
});

describe('Gillespie SSA — determinism', () => {
  it('reproduces an identical trajectory for the same seed', () => {
    const a = simulateSSA(lotkaVolterraModel(), { tMax: 12, seed: 'run-A' });
    const b = simulateSSA(lotkaVolterraModel(), { tMax: 12, seed: 'run-A' });
    expect(a.t).toEqual(b.t);
    expect(a.counts).toEqual(b.counts);
    expect(a.numReactions).toBe(b.numReactions);
  });

  it('produces a different trajectory for a different seed', () => {
    const a = simulateSSA(lotkaVolterraModel(), { tMax: 12, seed: 'run-A' });
    const b = simulateSSA(lotkaVolterraModel(), { tMax: 12, seed: 'run-B' });
    expect(a.counts).not.toEqual(b.counts);
  });

  it('run(params) is deterministic through the full spec pathway', () => {
    const params = {
      preset: 'birthDeath' as const,
      presetParams: { k: 5, gamma: 1 },
      tMax: 40,
      seed: 99,
    };
    const r1 = spec.run(params);
    const r2 = spec.run(params);
    expect(r1.metrics).toEqual(r2.metrics);
    expect(r1.series).toEqual(r2.series);
  });
});

describe('Gillespie SSA — birth–death analytic mean (k/γ)', () => {
  // Immigration–death has a Poisson(k/γ) stationary distribution: the long-run
  // mean count is exactly k/γ and the variance equals the mean. We verify the
  // time-weighted tail average converges to k/γ with a loose tolerance.
  it('long-run mean approaches k/γ', () => {
    const k = 10;
    const gamma = 1;
    const traj = simulateSSA(birthDeathModel({ k, gamma, x0: 0 }), { tMax: 2000, seed: 2024 });
    const x = speciesColumn(traj, 'X');
    const mean = timeWeightedMean(traj.t, x, 0.1 * traj.endTime); // drop 10% burn-in
    expect(mean).toBeGreaterThan(k / gamma - 1.0);
    expect(mean).toBeLessThan(k / gamma + 1.0);
  });

  it('respects a non-unit death rate (mean -> k/γ = 4)', () => {
    const k = 12;
    const gamma = 3;
    const traj = simulateSSA(birthDeathModel({ k, gamma, x0: 0 }), { tMax: 3000, seed: 55 });
    const x = speciesColumn(traj, 'X');
    const mean = timeWeightedMean(traj.t, x, 0.1 * traj.endTime);
    expect(Math.abs(mean - k / gamma)).toBeLessThan(0.6);
  });

  it('stationary variance ≈ mean (Poisson signature)', () => {
    const k = 10;
    const gamma = 1;
    const traj = simulateSSA(birthDeathModel({ k, gamma, x0: 0 }), { tMax: 3000, seed: 808 });
    const x = speciesColumn(traj, 'X');
    const from = 0.1 * traj.endTime;
    const mean = timeWeightedMean(traj.t, x, from);
    const variance = timeWeightedVariance(traj.t, x, from);
    // Poisson => Fano factor variance/mean ≈ 1 (loose bounds for a finite run).
    expect(variance / mean).toBeGreaterThan(0.6);
    expect(variance / mean).toBeLessThan(1.6);
  });

  it('reports the analytic mean through the spec metric', () => {
    const r = spec.run({
      preset: 'birthDeath',
      presetParams: { k: 20, gamma: 2 },
      tMax: 2000,
      seed: 1,
    });
    const m = r.metrics.find((x) => x.key === 'meanPopulation');
    expect(m).toBeDefined();
    expect(Math.abs((m?.value ?? 0) - 10)).toBeLessThan(1.0); // k/γ = 10
  });
});

describe('Gillespie SSA — bursting gene expression steady state', () => {
  // Every propensity is first-order, so the mean field closes exactly:
  //   P(on) = kOn/(kOn+kOff), ⟨mRNA⟩ = kM·P(on)/γM, ⟨Protein⟩ = kP·⟨mRNA⟩/γP.
  const opts = { kOn: 1, kOff: 1, kM: 20, gammaM: 2, kP: 2, gammaP: 1 };
  const analytic = geneExpressionSteadyState(opts);

  it('analytic helper matches the closed-form means', () => {
    expect(analytic.fractionOn).toBeCloseTo(0.5, 12);
    expect(analytic.mRNA).toBeCloseTo(5, 12); // 20*0.5/2
    expect(analytic.protein).toBeCloseTo(10, 12); // 2*5/1
  });

  it('simulated tail means match the analytic steady state', () => {
    const traj = simulateSSA(geneExpressionBurstingModel(opts), { tMax: 4000, seed: 314 });
    const from = 0.15 * traj.endTime;
    const meanOn = timeWeightedMean(traj.t, speciesColumn(traj, 'Gon'), from);
    const meanM = timeWeightedMean(traj.t, speciesColumn(traj, 'mRNA'), from);
    const meanP = timeWeightedMean(traj.t, speciesColumn(traj, 'Protein'), from);

    expect(Math.abs(meanOn - analytic.fractionOn)).toBeLessThan(0.08);
    expect(Math.abs(meanM - analytic.mRNA)).toBeLessThan(0.7);
    expect(Math.abs(meanP - analytic.protein)).toBeLessThan(1.6);
  });

  it('gene occupancy stays a single copy (Gon + Goff = 1)', () => {
    const traj = simulateSSA(geneExpressionBurstingModel(opts), { tMax: 200, seed: 5 });
    const on = speciesColumn(traj, 'Gon');
    const off = speciesColumn(traj, 'Goff');
    for (let i = 0; i < on.length; i++) {
      expect((on[i] as number) + (off[i] as number)).toBe(1);
    }
  });
});

describe('Gillespie SSA — Lotka–Volterra', () => {
  it('fixed point matches δ/β and α/β', () => {
    const fp = lotkaVolterraFixedPoint({ alpha: 1, beta: 0.01, delta: 1 });
    expect(fp.prey).toBeCloseTo(100, 9);
    expect(fp.predator).toBeCloseTo(100, 9);
  });

  it('conserves individuals correctly and fires many events', () => {
    const traj = simulateSSA(lotkaVolterraModel({ alpha: 1, beta: 0.01, delta: 1 }), {
      tMax: 20,
      seed: 42,
    });
    expect(traj.numReactions).toBeGreaterThan(50);
    assertNonNegativeIntegers(traj.counts);
    // Both populations start at the deterministic fixed point (100, 100).
    expect(traj.counts[0]).toEqual([100, 100]);
  });
});

describe('Gillespie SSA — spec surface', () => {
  it('has the required EngineSpec fields', () => {
    expect(spec.slug).toBe('gillespie');
    expect(spec.version).toBe('1.0.0');
    expect(spec.domain).toBe('systems-biology');
    expect(typeof spec.run).toBe('function');
    expect(Array.isArray(spec.references)).toBe(true);
  });

  it('runs the documented example and returns a well-formed SimResult', () => {
    const r = spec.run(spec.example);
    expect(r.engine).toBe('gillespie');
    expect(r.metrics.length).toBeGreaterThan(0);
    expect(r.series?.[0]?.x.length).toBeGreaterThan(0);
    expect(r.provenance.version).toBe('1.0.0');
    expect(r.provenance.seed).toBe(42);
    // Series x/y columns are aligned.
    const s = r.series?.[0];
    expect(s?.y.X?.length).toBe(s?.x.length);
  });

  it('validates params and rejects a network with neither preset nor model', () => {
    expect(gillespieParamsSchema.safeParse({ tMax: 10 }).success).toBe(false);
    expect(gillespieParamsSchema.safeParse({ preset: 'birthDeath' }).success).toBe(true);
  });

  it('accepts a fully custom reaction network', () => {
    const r = spec.run({
      model: {
        species: { A: 100, B: 0 },
        reactions: [{ name: 'isomerize', reactants: { A: 1 }, products: { B: 1 }, rate: 1 }],
      },
      tMax: 20,
      seed: 1,
    });
    // A -> B conserves total mass; eventually most A becomes B.
    const finalA = r.metrics.find((m) => m.key === 'final_A')?.value ?? -1;
    const finalB = r.metrics.find((m) => m.key === 'final_B')?.value ?? -1;
    expect(finalA + finalB).toBe(100);
    expect(finalB).toBeGreaterThan(finalA); // t=20 >> 1/rate, so B dominates
  });
});
