import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { moranFixationProbability, run } from './moran-process';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('moran-process', () => {
  it('neutral fixation probability is i/N', () => {
    expect(moranFixationProbability(10, 3, 1)).toBeCloseTo(0.3, 12);
    expect(moranFixationProbability(50, 1, 1)).toBeCloseTo(1 / 50, 12);
  });

  it('selective fixation probability matches the closed form', () => {
    expect(moranFixationProbability(10, 1, 2)).toBeCloseTo((1 - 0.5) / (1 - 0.5 ** 10), 12);
    // a deleterious mutant (r<1) almost never fixes
    expect(moranFixationProbability(10, 1, 0.5)).toBeLessThan(0.01);
    // a strongly beneficial mutant fixes far more often than neutral drift (1/N)
    expect(moranFixationProbability(100, 1, 3)).toBeGreaterThan(1 / 100);
  });

  it('boundaries: i=0 → 0, i=N → 1', () => {
    expect(moranFixationProbability(10, 0, 2)).toBe(0);
    expect(moranFixationProbability(10, 10, 2)).toBe(1);
  });

  it('the Monte-Carlo estimate matches the analytic probability (neutral, ρ=0.5)', () => {
    const r = run({
      populationSize: 10,
      initialMutants: 5,
      relativeFitness: 1,
      replicates: 3000,
      seed: 'mc',
    });
    expect(metric(r, 'analyticFixationProbability')).toBeCloseTo(0.5, 12);
    expect(metric(r, 'empiricalFixationProbability')).toBeGreaterThan(0.45);
    expect(metric(r, 'empiricalFixationProbability')).toBeLessThan(0.55);
  });

  it('the example trajectory ends at an absorbing boundary (0 or N)', () => {
    const r = run({ populationSize: 20, initialMutants: 5, relativeFitness: 1.5, replicates: 50 });
    const traj = (r.series ?? [])[0].y.mutants;
    const last = traj[traj.length - 1];
    expect(last === 0 || last === 20).toBe(true);
  });

  it('stays finite for a strongly deleterious mutant (no overflow → NaN)', () => {
    const rho = moranFixationProbability(200, 155, 0.01);
    expect(Number.isFinite(rho)).toBe(true);
    expect(rho).toBeGreaterThan(0);
    expect(rho).toBeLessThan(1e-50); // a 100×-deleterious mutant essentially never fixes
  });

  it('excludes non-absorbed (maxSteps-capped) runs from the estimate', () => {
    // maxSteps far too small for N=100 to ever reach 0 or N.
    const r = run({
      populationSize: 100,
      initialMutants: 50,
      relativeFitness: 1,
      replicates: 20,
      maxSteps: 5,
    });
    expect(metric(r, 'nonAbsorbedFraction')).toBe(1);
    expect(Number.isNaN(metric(r, 'empiricalFixationProbability'))).toBe(true);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('moran-process', { seed: 7, replicates: 100 });
    const b = runEngine('moran-process', { seed: 7, replicates: 100 });
    expect(a).toEqual(b);
  });
});
