import { describe, expect, it } from 'vitest';
import { createRng } from '../core/prng';
import {
  type Fitness,
  NEUTRAL_FITNESS,
  NO_MUTATION,
  deterministicTrajectory,
  expectedNextFrequency,
  frequencyAfterMutation,
  frequencyAfterSelection,
  hardyWeinberg,
  initialAlleleCount,
  meanFitness,
  moranFixationProbability,
  neutralFixationProbability,
  paramsSchema,
  runWrightFisher,
  simulateMoran,
  simulateReplicate,
  spec,
} from './wright-fisher';

describe('Hardy-Weinberg genotype frequencies', () => {
  it('p=0.5 gives 0.25 / 0.5 / 0.25', () => {
    const hw = hardyWeinberg(0.5);
    expect(hw.AA).toBeCloseTo(0.25, 12);
    expect(hw.Aa).toBeCloseTo(0.5, 12);
    expect(hw.aa).toBeCloseTo(0.25, 12);
  });

  it('genotype frequencies sum to 1 for arbitrary p', () => {
    for (const p of [0, 0.1, 0.37, 0.6, 0.99, 1]) {
      const hw = hardyWeinberg(p);
      expect(hw.AA + hw.Aa + hw.aa).toBeCloseTo(1, 12);
      // p^2 and q^2 identities
      expect(hw.AA).toBeCloseTo(p * p, 12);
      expect(hw.aa).toBeCloseTo((1 - p) * (1 - p), 12);
    }
  });
});

describe('deterministic selection / mutation recursion', () => {
  it('neutral fitness is the identity map and mean fitness is 1', () => {
    for (const p of [0.1, 0.4, 0.85]) {
      expect(meanFitness(p, NEUTRAL_FITNESS)).toBeCloseTo(1, 12);
      expect(frequencyAfterSelection(p, NEUTRAL_FITNESS)).toBeCloseTo(p, 12);
      expect(expectedNextFrequency(p, NEUTRAL_FITNESS, NO_MUTATION)).toBeCloseTo(p, 12);
    }
  });

  it('selection against a recessive matches the textbook increment', () => {
    // wAA = wAa = 1, waa = 1 - s with s = 0.1, p = 0.5.
    // p' = (p^2 wAA + p q wAa) / w̄ = 0.5 / 0.975 = 0.5128205...
    const f: Fitness = { wAA: 1, wAa: 1, waa: 0.9 };
    expect(frequencyAfterSelection(0.5, f)).toBeCloseTo(0.5 / 0.975, 10);
  });

  it('overdominance has a stable internal equilibrium p* = s2/(s1+s2)', () => {
    // wAA = 1-s1, wAa = 1, waa = 1-s2. s1=0.2, s2=0.3 -> p* = 0.3/0.5 = 0.6.
    const f: Fitness = { wAA: 0.8, wAa: 1, waa: 0.7 };
    const pStar = 0.3 / (0.2 + 0.3);
    expect(frequencyAfterSelection(pStar, f)).toBeCloseTo(pStar, 12);
  });

  it('mutation pushes frequency toward its mutational equilibrium ν/(μ+ν)', () => {
    // p'' = p(1-μ) + (1-p)ν. Fixed point p* = ν/(μ+ν).
    const m = { forward: 0.01, back: 0.03 };
    const pStar = m.back / (m.forward + m.back);
    expect(frequencyAfterMutation(pStar, m)).toBeCloseTo(pStar, 12);
    // From below the equilibrium, mutation increases p toward p*.
    expect(frequencyAfterMutation(0.1, m)).toBeGreaterThan(0.1);
  });

  it('strong directional selection drives the deterministic trajectory to fixation', () => {
    const f: Fitness = { wAA: 2, wAa: 1.5, waa: 1 };
    const traj = deterministicTrajectory(0.1, 100, f, NO_MUTATION);
    expect(traj[traj.length - 1]).toBeGreaterThan(0.999);
    // Monotone increase for a favoured additive allele.
    for (let i = 1; i < traj.length; i++) {
      expect(traj[i]!).toBeGreaterThanOrEqual(traj[i - 1]!);
    }
  });
});

describe('neutral Wright-Fisher drift (analytical checks)', () => {
  it('mean final frequency ≈ p0 and empirical fixation probability ≈ p0', () => {
    const p0 = 0.3;
    // Small population + long horizon => essentially all replicates absorb.
    const stats = runWrightFisher({
      popSize: 20,
      initFreq: p0,
      generations: 2000,
      replicates: 1000,
      fitness: NEUTRAL_FITNESS,
      mutation: NO_MUTATION,
      rng: createRng('neutral-drift'),
    });

    // E[p_t] = p0 for all t under neutral drift (martingale).
    expect(stats.meanFinalFreq).toBeCloseTo(p0, 1); // within ~0.05
    // P(fixation) = p0 for a neutral allele.
    expect(Math.abs(stats.fixationProbability - p0)).toBeLessThan(0.06);
    // Almost everything should have absorbed given the long horizon.
    expect(stats.fixationProbability + stats.lossProbability).toBeGreaterThan(0.98);
    expect(neutralFixationProbability(p0)).toBe(p0);
  });

  it('fixation + loss probabilities are consistent (fix ≈ p0, loss ≈ 1-p0) at p0=0.5', () => {
    const stats = runWrightFisher({
      popSize: 15,
      initFreq: 0.5,
      generations: 2000,
      replicates: 1200,
      fitness: NEUTRAL_FITNESS,
      mutation: NO_MUTATION,
      rng: createRng('neutral-half'),
    });
    expect(Math.abs(stats.fixationProbability - 0.5)).toBeLessThan(0.06);
    expect(Math.abs(stats.lossProbability - 0.5)).toBeLessThan(0.06);
  });
});

describe('fixed/lost classification with permeable boundaries (mutation)', () => {
  // Regression test for a bug where fixationTime/absorptionTime latched
  // permanently the first time a replicate's count ever touched a boundary
  // (0 or 2N) and `fixed`/`lost` were derived from that latch. With mutation
  // present the boundaries are only *permeable* (documented at the top of
  // simulateReplicate's docstring), so a replicate can touch a boundary and
  // later drift back to an interior, still-segregating frequency. `fixed`
  // and `lost` must reflect the actual final state, not the historical latch.
  it('a replicate that touches loss/fixation then drifts back to an interior frequency is reported as segregating, not fixed/lost', () => {
    const mutation = { forward: 0.2, back: 0.2 };
    // This exact popSize/initFreq/generations/seed combination is known to
    // produce (with the pre-fix latch logic) a replicate whose trajectory
    // touches count=0 at generation 13 and later mutates back up to a
    // final frequency of 0.55 — clearly segregating, yet previously
    // reported as lost=true.
    const rng = createRng('neutral-drift');
    let sawBoundaryTouchWithInteriorFinal = false;
    for (let r = 0; r < 200; r++) {
      const rep = simulateReplicate(10, 0.5, 60, NEUTRAL_FITNESS, mutation, rng);
      const interiorFinal = rep.finalFreq > 0 && rep.finalFreq < 1;
      // Invariant: fixed/lost must always agree with the actual final state.
      expect(rep.fixed).toBe(rep.finalFreq === 1);
      expect(rep.lost).toBe(rep.finalFreq === 0);
      // A replicate cannot be simultaneously fixed and lost, nor both
      // fixed/lost and segregating.
      expect(rep.fixed && rep.lost).toBe(false);
      if ((rep.everReachedFixation || rep.everReachedLoss) && interiorFinal) {
        sawBoundaryTouchWithInteriorFinal = true;
        // Touched a boundary at some point (so the old latch-based logic
        // would have called this fixed/lost)...
        expect(rep.everReachedFixation || rep.everReachedLoss).toBe(true);
        // ...but the corrected classification must NOT call it lost/fixed,
        // since it drifted back to an interior, segregating frequency.
        expect(rep.fixed).toBe(false);
        expect(rep.lost).toBe(false);
      }
    }
    // Sanity check: this seed/config combination must actually exercise the
    // boundary-touch-then-drift-back scenario, otherwise the assertions
    // above would trivially pass without ever having caught the bug.
    expect(sawBoundaryTouchWithInteriorFinal).toBe(true);
  });

  it('numFixed + numLost + numSegregating reflects actual final trajectory states under mutation', () => {
    const stats = runWrightFisher({
      popSize: 10,
      initFreq: 0.5,
      generations: 60,
      replicates: 200,
      fitness: NEUTRAL_FITNESS,
      mutation: { forward: 0.2, back: 0.2 },
      rng: createRng('mutation-classification'),
    });
    const numFixed = stats.replicates.filter((r) => r.fixed).length;
    const numLost = stats.replicates.filter((r) => r.lost).length;
    const numSegregating = stats.replicates.length - numFixed - numLost;
    for (const rep of stats.replicates) {
      expect(rep.fixed).toBe(rep.finalFreq === 1);
      expect(rep.lost).toBe(rep.finalFreq === 0);
    }
    // With substantial two-way mutation (0.2 each direction) on a tiny
    // population, the vast majority of replicates should remain segregating
    // at generation 60 rather than sitting at an exact boundary.
    expect(numSegregating).toBeGreaterThan(0);
    expect(numFixed + numLost + numSegregating).toBe(stats.replicates.length);
  });
});

describe('initialAlleleCount rounding of small/unrepresentable frequencies', () => {
  it('rounds to the nearest achievable count for representable frequencies', () => {
    // popSize=20 -> 2N=40, so 1/40 = 0.025 steps; 0.3 is exactly representable.
    expect(initialAlleleCount(20, 0.3)).toBe(12);
    expect(initialAlleleCount(50, 0.5)).toBe(50);
  });

  it('does not silently collapse a nonzero rare-allele frequency to count 0', () => {
    // popSize=5 -> 2N=10. Naive Math.round(0.04 * 10) = Math.round(0.4) = 0,
    // which would guarantee loss for every replicate before any drift, even
    // though the requested frequency (0.04) is nonzero. At least 1 copy of A
    // must be simulated so the scenario stays qualitatively "segregating",
    // matching what was requested.
    const count = initialAlleleCount(5, 0.04);
    expect(count).toBe(1);
    expect(count).toBeGreaterThan(0);
  });

  it('does not silently collapse a sub-1 rare-allele frequency to count 2N', () => {
    const count = initialAlleleCount(5, 0.96);
    expect(count).toBe(9); // 2N - 1, not 2N=10.
    expect(count).toBeLessThan(2 * 5);
  });

  it('true boundary requests (p0=0 or p0=1) are respected exactly', () => {
    expect(initialAlleleCount(5, 0)).toBe(0);
    expect(initialAlleleCount(5, 1)).toBe(10);
  });

  it('reported hardyWeinbergAtStart/neutralFixationProbability stay consistent with what was actually simulated', () => {
    // popSize=5, initFreq=0.04: the naive rounded count would be 0 (guaranteed
    // loss for every replicate), but the engine must report Hardy-Weinberg and
    // neutral-fixation-probability figures for the frequency it *actually*
    // simulated (1/10 = 0.1), not the raw, unrepresentable 0.04 request.
    const result = spec.run({
      popSize: 5,
      initFreq: 0.04,
      generations: 5,
      replicates: 10,
      seed: 'small-pop-rounding',
    });
    const detail = result.detail as {
      actualInitFreq: number;
      hardyWeinbergAtStart: { AA: number; Aa: number; aa: number };
      neutralFixationProbability: number;
    };
    expect(detail.actualInitFreq).toBeCloseTo(0.1, 12);
    expect(detail.neutralFixationProbability).toBeCloseTo(0.1, 12);
    expect(detail.hardyWeinbergAtStart.AA).toBeCloseTo(0.01, 12);
    expect(detail.hardyWeinbergAtStart.Aa).toBeCloseTo(0.18, 12);
    expect(detail.hardyWeinbergAtStart.aa).toBeCloseTo(0.81, 12);
  });
});

describe('directional selection in a finite population', () => {
  it('strong positive selection drives the favoured allele toward fixation', () => {
    const stats = runWrightFisher({
      popSize: 100,
      initFreq: 0.2,
      generations: 200,
      replicates: 120,
      fitness: { wAA: 2, wAa: 1.5, waa: 1 },
      mutation: NO_MUTATION,
      rng: createRng('positive-selection'),
    });
    expect(stats.meanFinalFreq).toBeGreaterThan(0.95);
    expect(stats.fixationProbability).toBeGreaterThan(0.9);
  });
});

describe('Moran model variant', () => {
  it('neutral Moran fixation probability ≈ i/N', () => {
    const size = 20;
    const initCount = 6; // i/N = 0.3
    const reps = 2000;
    const rng = createRng('moran-neutral');
    let fixed = 0;
    for (let r = 0; r < reps; r++) {
      const res = simulateMoran(size, initCount, 1, 1, size * size * 100, rng);
      if (res.fixed) fixed++;
    }
    const empirical = fixed / reps;
    expect(moranFixationProbability(initCount, size, 1, 1)).toBeCloseTo(0.3, 12);
    expect(Math.abs(empirical - 0.3)).toBeLessThan(0.05);
  });

  it('selective Moran fixation probability matches (1 - r^-i)/(1 - r^-N)', () => {
    const size = 20;
    const i = 1;
    const fA = 1.1;
    const fa = 1.0;
    const analytic = moranFixationProbability(i, size, fA, fa); // ≈ 0.1068
    expect(analytic).toBeGreaterThan(0.1);
    expect(analytic).toBeLessThan(0.115);

    const reps = 4000;
    const rng = createRng('moran-selection');
    let fixed = 0;
    for (let r = 0; r < reps; r++) {
      const res = simulateMoran(size, i, fA, fa, size * size * 100, rng);
      if (res.fixed) fixed++;
    }
    expect(Math.abs(fixed / reps - analytic)).toBeLessThan(0.03);
  });
});

describe('engine spec & determinism', () => {
  it('paramsSchema parses the example and applies defaults', () => {
    const parsed = paramsSchema.parse(spec.example);
    expect(parsed.popSize).toBe(100);
    expect(parsed.generations).toBe(200);
    expect(parsed.seed).toBe(1);
  });

  it('spec has the required metadata', () => {
    expect(spec.slug).toBe('wright-fisher');
    expect(spec.version).toBe('1.0.0');
    expect(spec.domain).toBe('population-genetics');
    expect(typeof spec.run).toBe('function');
  });

  it('run() returns well-formed metrics and series', () => {
    const result = spec.run({
      popSize: 30,
      initFreq: 0.5,
      generations: 60,
      replicates: 40,
      seed: 'demo',
    });
    expect(result.engine).toBe('wright-fisher');
    const keys = result.metrics.map((m) => m.key);
    expect(keys).toContain('meanFinalFreq');
    expect(keys).toContain('fixationProbability');
    expect(keys).toContain('meanTimeToFixation');
    // Series x runs 0..generations and every trajectory has matching length.
    const series = result.series?.[0];
    expect(series).toBeDefined();
    expect(series!.x.length).toBe(61);
    for (const arr of Object.values(series!.y)) {
      expect(arr.length).toBe(61);
    }
    expect(result.provenance.engine).toBe('wright-fisher');
    expect(result.provenance.version).toBe('1.0.0');
  });

  it('is deterministic: same seed → identical result', () => {
    const params = {
      popSize: 40,
      initFreq: 0.35,
      generations: 80,
      replicates: 50,
      selection: { wAA: 1.1, wAa: 1.05, waa: 1 },
      seed: 'repro',
    };
    const a = spec.run(params);
    const b = spec.run(params);
    expect(b).toEqual(a);
  });

  it('differs across seeds (sanity: RNG actually drives the result)', () => {
    const base = { popSize: 40, initFreq: 0.35, generations: 80, replicates: 50 };
    const a = spec.run({ ...base, seed: 'seedA' });
    const b = spec.run({ ...base, seed: 'seedB' });
    // Metric vectors should not be byte-identical across independent seeds.
    const ma = a.metrics.map((m) => m.value).join(',');
    const mb = b.metrics.map((m) => m.value).join(',');
    expect(ma).not.toBe(mb);
  });
});
