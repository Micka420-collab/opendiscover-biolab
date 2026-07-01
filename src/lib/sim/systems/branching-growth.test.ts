import { describe, expect, it } from 'vitest';
import { createRng } from '../core/prng';
import {
  classifyRegime,
  extinctionProbability,
  meanOffspring,
  simulateLineage,
  spec,
} from './branching-growth';

describe('meanOffspring — m = s + 2b, by definition', () => {
  it('matches hand computation for a few cases', () => {
    expect(meanOffspring(0.2, 0.4)).toBeCloseTo(0.4 + 0.8, 12); // s=0.4 -> m=0.4+0.8=1.2
    expect(meanOffspring(0.5, 0.5)).toBeCloseTo(0 + 1.0, 12); // s=0 -> m=1.0 (critical)
    expect(meanOffspring(0, 1)).toBeCloseTo(0 + 2.0, 12); // s=0 -> m=2.0
    expect(meanOffspring(1, 0)).toBeCloseTo(0, 12); // everyone dies immediately -> m=0
  });
});

describe('classifyRegime', () => {
  it('classifies sub/critical/supercritical by m vs 1', () => {
    expect(classifyRegime(0.6)).toBe('subcritical');
    expect(classifyRegime(1.0)).toBe('critical');
    expect(classifyRegime(1.2)).toBe('supercritical');
  });
});

describe('extinctionProbability — the Galton-Watson theorem on hand-solved edge cases', () => {
  it('symmetric critical case (d=b=0.5, s=0, m=1): extinction is certain', () => {
    // q = 0.5 + 0.5q^2  =>  0.5q^2 - q + 0.5 = 0  =>  q^2-2q+1=0  =>  (q-1)^2=0  =>  q=1.
    expect(extinctionProbability(0.5, 0.5)).toBeCloseTo(1, 9);
  });

  it('pure deterministic doubling (d=0, b=1, s=0, m=2): extinction is impossible', () => {
    // q = q^2  =>  q(q-1)=0  =>  roots {0,1}; smallest is 0 (no death event ever occurs).
    expect(extinctionProbability(0, 1)).toBeCloseTo(0, 9);
  });

  it('subcritical case (d=0.6, b=0.2, s=0.2, m=0.6): extinction is certain', () => {
    expect(extinctionProbability(0.6, 0.2)).toBeCloseTo(1, 9);
  });

  it('a genuinely supercritical case with q strictly between 0 and 1', () => {
    // d=0.3, b=0.5, s=0.2, m=1.2. Solving b*q^2+(s-1)*q+d=0 by hand:
    // 0.5q^2 - 0.8q + 0.3 = 0  =>  q^2-1.6q+0.6=0  =>  disc=1.6^2-2.4=0.16  =>  sqrt=0.4
    // q = (1.6 ± 0.4)/2 = {1.0, 0.6}; smallest root is 0.6.
    expect(extinctionProbability(0.3, 0.5)).toBeCloseTo(0.6, 9);
  });

  it('no branching at all (b=0): extinction certain iff death is possible', () => {
    expect(extinctionProbability(0.1, 0)).toBe(1);
    expect(extinctionProbability(0, 0)).toBe(0); // d=0,b=0 -> everyone just persists forever
  });
});

describe('simulateLineage — a single stochastic realization', () => {
  it('is deterministic for a fixed seed', () => {
    const a = simulateLineage(createRng('x'), 10, 0.2, 0.4, 15, 100_000);
    const b = simulateLineage(createRng('x'), 10, 0.2, 0.4, 15, 100_000);
    expect(a.population).toEqual(b.population);
  });

  it('population is always a non-negative integer, and starts at initialCells', () => {
    const traj = simulateLineage(createRng('pop-check'), 25, 0.3, 0.3, 30, 100_000);
    expect(traj.population[0]).toBe(25);
    for (const n of traj.population) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    }
  });

  it('once extinct (0), stays at 0 forever after', () => {
    // Heavy death, no division at all -> should hit 0 well within a modest horizon.
    const rng = createRng('extinct-fast');
    const traj = simulateLineage(rng, 5, 0.9, 0, 40, 100_000);
    const firstZero = traj.population.indexOf(0);
    expect(firstZero).toBeGreaterThan(-1);
    for (let i = firstZero; i < traj.population.length; i++) {
      expect(traj.population[i]).toBe(0);
    }
  });

  it('respects maxPopulationCap and reports capped=true', () => {
    // Pure doubling with a tiny cap must trip the cap quickly.
    const traj = simulateLineage(createRng('cap-test'), 10, 0, 1, 20, 50);
    expect(traj.capped).toBe(true);
    expect(traj.population[traj.population.length - 1]).toBeGreaterThan(50);
  });
});

describe('engine — Monte-Carlo statistics agree with the exact theory', () => {
  it('mean population tracks m^n * Z0 at an early generation (before extinction dominates)', () => {
    const r = spec.run({
      initialCells: 50,
      deathProb: 0.2,
      divideProb: 0.4,
      generations: 5,
      replicates: 2000,
      seed: 'mc-mean-check',
    });
    const m = 1.2; // s=0.4, b=0.4 -> m=0.4+0.8=1.2
    const theoretical = 50 * m ** 5;
    const observed = r.detail?.meanPopulationByGeneration[5] ?? Number.NaN;
    // Monte Carlo with 2000 replicates: allow a generous relative tolerance.
    expect(Math.abs(observed - theoretical) / theoretical).toBeLessThan(0.15);
  });

  it('empirical extinction probability is close to the exact theoretical value', () => {
    const r = spec.run({
      initialCells: 5,
      deathProb: 0.6,
      divideProb: 0.2, // subcritical, m=0.6 -> theoretical extinction = 1
      generations: 60,
      replicates: 500,
      seed: 'mc-extinction-check',
    });
    expect(r.detail?.extinctionProbabilityTheory).toBeCloseTo(1, 6);
    expect(r.detail?.extinctionProbabilityEmpirical).toBeGreaterThan(0.9);
  });

  it('reports the correct regime and metrics for its own example', () => {
    const r = spec.run(spec.example);
    expect(r.detail?.regime).toBe('supercritical'); // m = 0.4+0.8 = 1.2 > 1
    expect(r.detail?.meanOffspring).toBeCloseTo(1.2, 9);
  });

  it('rejects deathProb + divideProb > 1', () => {
    expect(() => spec.run({ ...spec.example, deathProb: 0.7, divideProb: 0.5 })).toThrow();
  });

  it('is deterministic end-to-end', () => {
    const params = { ...spec.example, replicates: 20 };
    expect(spec.run(params)).toEqual(spec.run(params));
  });
});
