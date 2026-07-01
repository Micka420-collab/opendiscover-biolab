import { describe, expect, it } from 'vitest';
import { alignmentParams, needlemanWunsch, smithWaterman, spec } from './alignment';

const sc = { match: 1, mismatch: -1, gap: -1 };
const metric = (r: ReturnType<typeof spec.run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('Needleman–Wunsch global alignment', () => {
  it('identical sequences: full-match score, 100% identity, no gaps', () => {
    const a = needlemanWunsch('ACGT', 'ACGT', sc);
    expect(a.score).toBe(4);
    expect(a.alignedA).toBe('ACGT');
    expect(a.alignedB).toBe('ACGT');
  });

  it('single substitution costs one mismatch', () => {
    const a = needlemanWunsch('ACGT', 'ACTT', sc);
    // 3 matches (+3) + 1 mismatch (-1) = 2, aligned without gaps
    expect(a.score).toBe(2);
    expect(a.alignedA.length).toBe(4);
    expect(a.alignedA.includes('-')).toBe(false);
  });

  it('a deletion introduces exactly one gap', () => {
    const a = needlemanWunsch('ACGT', 'AGT', sc);
    // A-A, C-gap, G-G, T-T → 3 matches (+3) + 1 gap (-1) = 2
    expect(a.score).toBe(2);
    expect(a.alignedA).toBe('ACGT');
    expect(a.alignedB).toBe('A-GT');
  });

  it('score is symmetric', () => {
    const ab = needlemanWunsch('GATTACA', 'GCATGCU', sc).score;
    const ba = needlemanWunsch('GCATGCU', 'GATTACA', sc).score;
    expect(ab).toBe(ba);
  });

  it('pays one gap penalty per unit of length difference (boundary row/column init)', () => {
    // 'AAAAA' vs 'A': one match (+1) plus four gap columns for the extra A's
    // (4 × -1 = -4) ⇒ -3. A broken/missing F[i][0]/F[0][j] boundary
    // initialization would instead let the DP find a spurious +1 (score of a
    // single match with the leftover row/column left at 0), so this exercises
    // a length gap the other fixtures (max diff of 1 char) never reach.
    const a = needlemanWunsch('AAAAA', 'A', sc);
    expect(a.score).toBe(-3);
    expect(a.alignedA).toBe('AAAAA');
    expect(a.alignedB).toBe('----A');
  });
});

describe('Smith–Waterman local alignment', () => {
  it('extracts the best-scoring common substring', () => {
    const local = { match: 2, mismatch: -1, gap: -2 };
    const a = smithWaterman('TTTGGGCCC', 'AAAGGGTTT', local);
    // The best shared run is length 3 (GGG or TTT, tied) scoring 3 × 2 = 6.
    expect(a.score).toBe(6);
    expect(a.alignedA).toBe(a.alignedB); // a perfect, gapless local match
    expect(a.alignedA.length).toBe(3);
    expect(a.alignedA.includes('-')).toBe(false);
  });

  it('never scores below zero', () => {
    const a = smithWaterman('AAAA', 'TTTT', { match: 1, mismatch: -1, gap: -1 });
    expect(a.score).toBe(0);
  });

  it('floors the H-matrix at zero so a divergent prefix does not drag down a later local match', () => {
    // CCCC/GGGG is all-mismatch (would drive an un-floored score to -4 by the
    // time the AAAA/AAAA run starts), but Smith–Waterman resets to 0 at every
    // cell whose best predecessor score would go negative (Smith & Waterman
    // 1981, J. Mol. Biol. 147:195, eq. for H_ij = max(0, ...)), so the trailing
    // perfect match is recovered as its own local alignment.
    const a = smithWaterman('CCCCAAAA', 'GGGGAAAA', { match: 1, mismatch: -1, gap: -1 });
    expect(a.score).toBe(4);
    expect(a.alignedA).toBe('AAAA');
    expect(a.alignedB).toBe('AAAA');
    // Traceback must stop at the reset point, not extend into the mismatched prefix.
    expect(a.aStart).toBe(4);
    expect(a.bStart).toBe(4);
  });

  it('local score ≥ global score when similarity is only local', () => {
    const local = { match: 2, mismatch: -1, gap: -2 };
    const g = needlemanWunsch('ZZZGGGZZZ', 'QQGGGQQ', local).score;
    const l = smithWaterman('ZZZGGGZZZ', 'QQGGGQQ', local).score;
    expect(l).toBeGreaterThanOrEqual(g);
    expect(l).toBe(6);
  });
});

describe('alignment engine', () => {
  it('reports identity, matches, gaps consistent with the match line', () => {
    const r = spec.run({ seqA: 'ACGT', seqB: 'AGT', match: 1, mismatch: -1, gap: -1 });
    expect(metric(r, 'score')).toBe(2);
    expect(metric(r, 'matches')).toBe(3);
    expect(metric(r, 'gaps')).toBe(1);
    const detail = r.detail;
    expect(detail?.matchLine.length).toBe(detail?.alignedA.length);
    const bars = (detail?.matchLine.match(/\|/g) ?? []).length;
    expect(bars).toBe(3);
  });

  it('identity is 1.0 for identical inputs and case-insensitive by default', () => {
    const r = spec.run({ seqA: 'acgtac', seqB: 'ACGTAC' });
    expect(metric(r, 'identity')).toBeCloseTo(1, 10);
  });

  it('is deterministic', () => {
    const p = { seqA: 'GATTACAGTC', seqB: 'GCATGCAGTC' };
    expect(spec.run(p)).toEqual(spec.run(p));
  });

  it('rejects a positive (non-penalty) gap score', () => {
    // gap must be <= 0: a positive gap turns the DP's whole rationale upside
    // down (it would prefer inserting gaps over matching identical residues),
    // e.g. gap=5 with match=1 aligns identical 'AC'/'AC' as '--AC'/'AC--'
    // instead of reporting 100% identity.
    expect(() =>
      alignmentParams.parse({ seqA: 'AC', seqB: 'AC', match: 1, mismatch: -1, gap: 5 }),
    ).toThrow();
  });

  it('rejects a mismatch score better than a match score', () => {
    expect(() =>
      alignmentParams.parse({ seqA: 'AC', seqB: 'AC', match: 1, mismatch: 2, gap: -1 }),
    ).toThrow();
  });

  it('accepts the documented default penalties', () => {
    expect(() => alignmentParams.parse({ seqA: 'AC', seqB: 'AC' })).not.toThrow();
  });
});
