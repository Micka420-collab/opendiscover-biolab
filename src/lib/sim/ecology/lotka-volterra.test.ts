import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { conservedQuantity, paramsSchema, run } from './lotka-volterra';

/** Trapezoidal mean of `v` over the index window [i0, i1] on the time grid `t`. */
function meanOverWindow(t: number[], v: number[], i0: number, i1: number): number {
  let area = 0;
  for (let i = i0 + 1; i <= i1; i++) {
    area += 0.5 * ((t[i] ?? 0) - (t[i - 1] ?? 0)) * ((v[i] ?? 0) + (v[i - 1] ?? 0));
  }
  const span = (t[i1] ?? 0) - (t[i0] ?? 0);
  return span > 0 ? area / span : 0;
}

/** Indices of strict local maxima of `v`. */
function peakIndices(v: number[]): number[] {
  const peaks: number[] = [];
  for (let i = 1; i < v.length - 1; i++) {
    if ((v[i] ?? 0) > (v[i - 1] ?? 0) && (v[i] ?? 0) > (v[i + 1] ?? 0)) peaks.push(i);
  }
  return peaks;
}

describe('lotka-volterra', () => {
  it('places the coexistence equilibrium at (γ/δ, α/β)', () => {
    const r = run({ alpha: 1.1, beta: 0.4, delta: 0.1, gamma: 0.4 });
    const preyEq = r.metrics.find((m) => m.key === 'preyEquilibrium')?.value;
    const predEq = r.metrics.find((m) => m.key === 'predatorEquilibrium')?.value;
    expect(preyEq).toBeCloseTo(0.4 / 0.1, 10); // γ/δ = 4
    expect(predEq).toBeCloseTo(1.1 / 0.4, 10); // α/β = 2.75
  });

  it('stays on its orbit — the conserved quantity barely drifts', () => {
    const r = run({});
    const drift = r.metrics.find((m) => m.key === 'conservedDriftPct')?.value ?? 999;
    expect(drift).toBeLessThan(0.5); // %
  });

  it('keeps both populations strictly positive', () => {
    const r = run({});
    for (const s of r.series ?? []) {
      for (const key of Object.keys(s.y)) {
        expect(Math.min(...s.y[key])).toBeGreaterThan(0);
      }
    }
  });

  it("obeys Volterra's law of averages: ⟨x⟩ = x*, ⟨y⟩ = y* over whole periods", () => {
    // High-resolution run so peak detection is accurate.
    const p = paramsSchema.parse({ tEnd: 60, steps: 6000, outputPoints: 2000 });
    const r = run(p);
    const [timeSeries] = r.series ?? [];
    const t = timeSeries.x;
    const prey = timeSeries.y.prey;
    const pred = timeSeries.y.predator;

    const peaks = peakIndices(prey);
    expect(peaks.length).toBeGreaterThanOrEqual(2);

    // Window spanning an integer number of periods (first prey peak → last prey peak).
    const i0 = peaks[0];
    const i1 = peaks[peaks.length - 1];
    const meanPrey = meanOverWindow(t, prey, i0, i1);
    const meanPred = meanOverWindow(t, pred, i0, i1);

    const preyEq = p.gamma / p.delta;
    const predEq = p.alpha / p.beta;
    expect(Math.abs(meanPrey - preyEq) / preyEq).toBeLessThan(0.02);
    expect(Math.abs(meanPred - predEq) / predEq).toBeLessThan(0.02);
  });

  it('the conserved quantity is invariant at the equilibrium point (dV = 0 there)', () => {
    const p = paramsSchema.parse({});
    // At equilibrium the value is a strict minimum of V; perturbing raises it.
    const vEq = conservedQuantity(p, p.gamma / p.delta, p.alpha / p.beta);
    const vOff = conservedQuantity(p, p.gamma / p.delta + 1, p.alpha / p.beta + 1);
    expect(vOff).toBeGreaterThan(vEq);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('lotka-volterra', { alpha: 1.2, beta: 0.3, delta: 0.1, gamma: 0.5 });
    const b = runEngine('lotka-volterra', { alpha: 1.2, beta: 0.3, delta: 0.1, gamma: 0.5 });
    expect(a).toEqual(b);
  });

  it('does not overflow the stack on a large (schema-max) trajectory', () => {
    // peakPrey/peakPredator must not spread a 200k-element array into Math.max.
    const r = run({ steps: 200_000, tEnd: 40, outputPoints: 200 });
    expect(Number.isFinite(r.metrics.find((m) => m.key === 'peakPrey')?.value ?? Number.NaN)).toBe(
      true,
    );
  });

  it('produces finite series points even at outputPoints=1', () => {
    const r = run({ outputPoints: 1 });
    for (const s of r.series ?? []) {
      for (const xv of s.x) expect(Number.isFinite(xv)).toBe(true);
      for (const key of Object.keys(s.y)) {
        for (const v of s.y[key]) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
