import { describe, expect, it } from 'vitest';
import {
  type BasePair,
  canPair,
  cleanRna,
  foldRNA,
  nussinovMatrix,
  pairEnergy,
  pairsToDotBracket,
  paramsSchema,
  run,
  spec,
  stackingEnergy,
  traceback,
} from './rna-fold';

/** Assert a dot-bracket string is balanced and well-formed. */
function isBalanced(db: string): boolean {
  let depth = 0;
  for (const ch of db) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch !== '.') return false;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/** Verify every reported pair is non-crossing (nested) — a Nussinov invariant. */
function isNested(pairs: BasePair[]): boolean {
  for (const [a, b] of pairs) {
    for (const [c, d] of pairs) {
      if (a < c && c < b && b < d) return false; // crossing a<c<b<d
    }
  }
  return true;
}

describe('base-pairing rules', () => {
  it('accepts Watson–Crick pairs in both orientations', () => {
    expect(canPair('A', 'U')).toBe(true);
    expect(canPair('U', 'A')).toBe(true);
    expect(canPair('G', 'C')).toBe(true);
    expect(canPair('C', 'G')).toBe(true);
  });

  it('gates the G·U wobble pair on the allowWobble flag', () => {
    expect(canPair('G', 'U', true)).toBe(true);
    expect(canPair('U', 'G', true)).toBe(true);
    expect(canPair('G', 'U', false)).toBe(false);
    expect(canPair('U', 'G', false)).toBe(false);
  });

  it('rejects non-complementary pairs', () => {
    expect(canPair('A', 'A')).toBe(false);
    expect(canPair('A', 'G')).toBe(false);
    expect(canPair('C', 'U')).toBe(false);
    expect(canPair('A', 'C')).toBe(false);
  });

  it('ranks pair energies by hydrogen-bond count (GC < AU < GU < 0)', () => {
    expect(pairEnergy('G', 'C')).toBe(-3);
    expect(pairEnergy('A', 'U')).toBe(-2);
    expect(pairEnergy('G', 'U')).toBe(-1);
    expect(pairEnergy('A', 'A')).toBe(0);
  });
});

describe('sequence normalisation', () => {
  it('uppercases, transcribes T→U, and strips invalid characters', () => {
    expect(cleanRna('gggg aaaa cccc')).toBe('GGGGAAAACCCC');
    expect(cleanRna('ATGC')).toBe('AUGC'); // DNA input transcribed
    expect(cleanRna('GGN-UU 12')).toBe('GGUU'); // N, punctuation, digits dropped
  });
});

describe('Nussinov fold — perfect palindrome GGGGAAAACCCC', () => {
  const seq = 'GGGGAAAACCCC';
  const fold = foldRNA(seq);

  it('forms a 4-bp G·C stem closing a hairpin loop', () => {
    // Four G·C pairs are the only structure that maximises pairing here.
    expect(fold.basePairs).toBe(4);
    // Nested stem: G0-C11, G1-C10, G2-C9, G3-C8.
    expect(fold.pairs).toEqual([
      [0, 11],
      [1, 10],
      [2, 9],
      [3, 8],
    ]);
  });

  it('produces the canonical stem-loop dot-bracket', () => {
    expect(fold.dotBracket).toBe('((((....))))');
  });

  it('yields a balanced bracket string with equal ( and ) of input length', () => {
    const opens = [...fold.dotBracket].filter((c) => c === '(').length;
    const closes = [...fold.dotBracket].filter((c) => c === ')').length;
    expect(opens).toBe(closes);
    expect(opens).toBe(4);
    expect(fold.dotBracket).toHaveLength(seq.length);
    expect(isBalanced(fold.dotBracket)).toBe(true);
    expect(isNested(fold.pairs)).toBe(true);
  });

  it('reports a stacking energy of −9 kcal/mol (3 G·C stacks)', () => {
    // 4 stacked G·C pairs => 3 consecutive stacks, each mean(−3,−3) = −3.
    expect(fold.stacks).toBe(3);
    expect(fold.stackingEnergy).toBeCloseTo(-9, 10);
  });
});

describe('Nussinov fold — unpairable sequence AAAAAAA', () => {
  const fold = foldRNA('AAAAAAA');

  it('finds zero base pairs', () => {
    expect(fold.basePairs).toBe(0);
    expect(fold.pairs).toEqual([]);
  });

  it('renders an all-dots structure of the same length', () => {
    expect(fold.dotBracket).toBe('.......');
    expect(fold.dotBracket).toHaveLength(7);
    expect(fold.stackingEnergy).toBe(0);
  });
});

describe('wobble toggling on a G/U-rich sequence GGGGAAAAUUUU', () => {
  const seq = 'GGGGAAAAUUUU';

  it('increases the base-pair count when G·U wobble is allowed', () => {
    // Without wobble only A·U pairs are possible: A4-U11, A5-U10 (min loop 3
    // forbids A6-U9 and A7-U8) => 2 pairs.
    const noWobble = foldRNA(seq, { allowWobble: false });
    expect(noWobble.basePairs).toBe(2);

    // With wobble the G's can now pair the U's across the AAAA loop, lifting the
    // optimum to 4 pairs (one such optimum is the G·U stem G0-U11…G3-U8; the
    // tie-break may instead close with an A·U pair, but the *count* is the
    // invariant). The structure stays balanced and full-length either way.
    const withWobble = foldRNA(seq, { allowWobble: true });
    expect(withWobble.basePairs).toBe(4);
    expect(withWobble.dotBracket).toHaveLength(seq.length);
    expect(isBalanced(withWobble.dotBracket)).toBe(true);
    expect(isNested(withWobble.pairs)).toBe(true);

    expect(withWobble.basePairs).toBeGreaterThan(noWobble.basePairs);
  });

  it('a pure G/U hairpin pairs only with wobble enabled', () => {
    // GGGGUUUU: with wobble G0-U7, G1-U6 (loop GGUU) => 2 pairs; without => 0.
    expect(foldRNA('GGGGUUUU', { allowWobble: true }).basePairs).toBe(2);
    expect(foldRNA('GGGGUUUU', { allowWobble: false }).basePairs).toBe(0);
  });
});

describe('minimum-loop constraint', () => {
  it('forbids pairs that would create too-tight a hairpin', () => {
    // GCGC: G0 could pair C3 but only 2 unpaired between => blocked at minLoop=3.
    expect(foldRNA('GCGC', { minLoop: 3 }).basePairs).toBe(0);
    // Relaxing the constraint to 2 unpaired lets G0·C3 form.
    expect(foldRNA('GCGC', { minLoop: 2 }).basePairs).toBe(1);
    // A canonical minimal hairpin needs exactly minLoop unpaired bases.
    expect(foldRNA('GAAAC', { minLoop: 3 }).basePairs).toBe(1); // G0·C4, loop AAA
    expect(foldRNA('GAAC', { minLoop: 3 }).basePairs).toBe(0); // only 2 unpaired
  });
});

describe('DP matrix and traceback are internally consistent', () => {
  it('the matrix optimum equals the number of pairs recovered by traceback', () => {
    const seq = cleanRna('GGGCUUUAGCAAAGCUCCC');
    const dp = nussinovMatrix(seq, 3, true);
    const optimum = dp[0]![seq.length - 1]!;
    const pairs = traceback(dp, seq, 3, true);
    expect(pairs.length).toBe(optimum);
    expect(isNested(pairs)).toBe(true);
    expect(isBalanced(pairsToDotBracket(pairs, seq.length))).toBe(true);
  });

  it('is monotone: dp[0][n-1] never decreases as the span grows', () => {
    const seq = 'GGGGAAAACCCC';
    const dp = nussinovMatrix(seq, 3, true);
    // A well-known small identity: adjacent diagonals are non-decreasing.
    for (let i = 0; i + 1 < seq.length; i++) {
      expect(dp[i]![seq.length - 1]!).toBeGreaterThanOrEqual(dp[i + 1]![seq.length - 1]!);
    }
  });
});

describe('stacking-energy helper', () => {
  it('scores an isolated pair as zero (no stack) and a 2-bp helix by its step', () => {
    // Single pair, no neighbour => no stack.
    expect(stackingEnergy([[0, 5]], 'GAAAAC').energy).toBe(0);
    // Two nested G·C pairs (0,7)&(1,6) => one stack of mean(−3,−3) = −3.
    const two = stackingEnergy(
      [
        [0, 7],
        [1, 6],
      ],
      'GGAAAACC',
    );
    expect(two.stacks).toBe(1);
    expect(two.energy).toBeCloseTo(-3, 10);
  });
});

describe('determinism', () => {
  it('produces identical output across repeated runs (pure function)', () => {
    const a = foldRNA('GGGCUUUAGCAAAGCUCCC');
    const b = foldRNA('GGGCUUUAGCAAAGCUCCC');
    expect(a).toEqual(b);
  });
});

describe('EngineSpec wrapper', () => {
  it('exposes correctly-typed metadata', () => {
    expect(spec.slug).toBe('rna-fold');
    expect(spec.domain).toBe('structural');
    expect(spec.version).toBe('1.0.0');
    expect(typeof spec.run).toBe('function');
    expect(spec.paramsSchema).toBe(paramsSchema);
  });

  it('validates the example parameters', () => {
    expect(() => paramsSchema.parse(spec.example)).not.toThrow();
  });

  it('run() returns a well-formed SimResult with the required metrics', () => {
    const result = run({ sequence: 'GGGGAAAACCCC' });
    expect(result.engine).toBe('rna-fold');

    const byKey = Object.fromEntries(result.metrics.map((m) => [m.key, m.value]));
    expect(byKey.basePairs).toBe(4);
    expect(byKey.sequenceLength).toBe(12);
    expect(byKey.pairedFraction).toBeCloseTo(8 / 12, 10); // 2·4 / 12
    expect(byKey.stackingEnergy).toBeCloseTo(-9, 10);

    expect(result.detail?.dotBracket).toBe('((((....))))');
    expect(result.detail?.pairs).toHaveLength(4);
    expect(result.provenance).toEqual({
      engine: 'rna-fold',
      version: '1.0.0',
      params: { sequence: 'GGGGAAAACCCC', minLoop: 3, allowWobble: true },
    });
  });

  it('accepts DNA input by transcribing it', () => {
    const result = run({ sequence: 'GGGGAAAACCCC'.replace(/U/g, 'T') });
    expect(result.metrics.find((m) => m.key === 'sequenceLength')?.value).toBe(12);
  });

  it('throws on a sequence with no valid nucleotides', () => {
    expect(() => run({ sequence: '1234 ???' })).toThrow();
  });
});
