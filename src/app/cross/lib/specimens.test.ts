import { breedingParams } from '@/lib/sim/genetics/breeding';
import { describe, expect, it } from 'vitest';
import { buildBreedingParams, solveCross } from './solve';
import {
  CROSS_POOL,
  type Cross,
  DAILY_ROUNDS,
  crossById,
  dailyCrosses,
  endlessCross,
} from './specimens';

describe('cross specimen catalog', () => {
  it('has a non-trivial, uniquely-identified pool', () => {
    expect(CROSS_POOL.length).toBeGreaterThanOrEqual(DAILY_ROUNDS);
    const ids = CROSS_POOL.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every cross is a VALID set of breeding-engine params', () => {
    for (const c of CROSS_POOL) {
      // The engine's own Zod schema is the gate — a malformed cross throws here.
      expect(() => breedingParams.parse(buildBreedingParams(c))).not.toThrow();
    }
  });

  it('every cross solves to a clean, beginner-legible multiple choice', () => {
    for (const c of CROSS_POOL) {
      const s = solveCross(c);
      // At least two distinct looks to choose between, and a well-defined answer.
      expect(s.options.length).toBeGreaterThanOrEqual(2);
      expect(s.mostCommon.length).toBeGreaterThanOrEqual(1);
      // The most-common answer is always one of the offered options.
      for (const m of s.mostCommon) {
        expect(s.options.map((o) => o.label)).toContain(m);
      }
      // Probabilities are a valid distribution.
      const sum = s.options.reduce((a, o) => a + o.probability, 0);
      expect(sum).toBeCloseTo(1, 9);
      // The litter is the full requested size.
      expect(s.litter.length).toBe(16);
    }
  });

  it('single-locus crosses expose a Punnett square; multi-locus do not', () => {
    for (const c of CROSS_POOL) {
      const s = solveCross(c);
      if (c.genes.length === 1) {
        expect(s.punnett).not.toBeNull();
        const p = s.punnett as NonNullable<typeof s.punnett>;
        // Every Punnett cell's phenotype is one of the real distribution's looks.
        const looks = new Set(s.options.map((o) => o.label));
        for (const row of p.cells)
          for (const cell of row) expect(looks.has(cell.phenotype)).toBe(true);
      } else {
        expect(s.punnett).toBeNull();
      }
    }
  });

  it('carries at least one classic recessive "surprise" (a hidden look neither parent shows)', () => {
    const surprises = CROSS_POOL.filter((c) => solveCross(c).hiddenLooks.length > 0);
    expect(surprises.length).toBeGreaterThan(0);
  });
});

describe('deterministic daily gauntlet', () => {
  it('is a pure function of the date (any time on a day maps to the same set)', () => {
    const a = dailyCrosses('2026-07-03');
    const b = dailyCrosses('2026-07-03T23:59:59Z');
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(dailyCrosses('2026-07-03').map((c) => c.id)).toEqual(a.map((c) => c.id));
  });

  it('serves DAILY_ROUNDS distinct crosses', () => {
    for (const date of ['2026-01-01', '2026-07-03', '2026-12-31', '2027-02-14']) {
      const day = dailyCrosses(date);
      expect(day.length).toBe(DAILY_ROUNDS);
      expect(new Set(day.map((c) => c.id)).size).toBe(DAILY_ROUNDS);
    }
  });

  it('varies across days', () => {
    const days = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'].map((d) =>
      dailyCrosses(d)
        .map((c) => c.id)
        .join(','),
    );
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it('endless mode is deterministic per index', () => {
    expect(endlessCross(0).id).toBe(endlessCross(0).id);
    expect(endlessCross(7).id).toBe(endlessCross(7).id);
    for (let i = 0; i < 20; i++) expect(CROSS_POOL).toContain(endlessCross(i) as Cross);
  });

  it('crossById round-trips every pool entry', () => {
    for (const c of CROSS_POOL) expect(crossById(c.id)).toBe(c);
    expect(crossById('nope')).toBeUndefined();
  });
});
