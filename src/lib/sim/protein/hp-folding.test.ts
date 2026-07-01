import { describe, expect, it } from 'vitest';
import {
  type Point,
  countHHContacts,
  energy,
  foldHP,
  isSelfAvoiding,
  parseSequence,
  spec,
  straightConformation,
} from './hp-folding';

const hp = (s: string) => parseSequence(s);

describe('HP energy scoring (analytical, hand-built conformations)', () => {
  it('counts a single H–H contact in a 2x2 square of four H residues', () => {
    // HHHH folded into a unit square:  0(0,0)-1(1,0)-2(1,1)-3(0,1)
    // Only non-sequence-adjacent lattice-adjacent H pair is (0,3): one contact.
    const coords: Point[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(countHHContacts(coords, hp('HHHH'))).toBe(1);
    expect(energy(coords, hp('HHHH'))).toBe(-1);
  });

  it('ignores sequence-adjacent pairs — a straight chain has zero contacts', () => {
    const coords = straightConformation(4);
    expect(countHHContacts(coords, hp('HHHH'))).toBe(0);
    expect(energy(coords, hp('HHHH'))).toBe(0);
  });

  it('counts only H–H pairs, never H–P or P–P', () => {
    // HPPH square: only the two H termini (0 and 3) touch -> exactly one contact.
    const coords: Point[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    expect(countHHContacts(coords, hp('HPPH'))).toBe(1);
    // Same geometry, all P: no H–H contacts at all.
    expect(countHHContacts(coords, hp('PPPP'))).toBe(0);
  });

  it('scores the HHPPHH hairpin at its optimum of two contacts', () => {
    // U-shape:  0(0,0) 1(0,1) 2(0,2) 3(1,2) 4(1,1) 5(1,0)
    // Contacts: (0,5) and (1,4). Both H, non-sequence-adjacent -> 2 contacts.
    const coords: Point[] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [1, 1],
      [1, 0],
    ];
    expect(isSelfAvoiding(coords)).toBe(true);
    expect(countHHContacts(coords, hp('HHPPHH'))).toBe(2);
    expect(energy(coords, hp('HHPPHH'))).toBe(-2);
  });
});

describe('self-avoidance detection', () => {
  it('accepts a genuine self-avoiding walk', () => {
    expect(isSelfAvoiding(straightConformation(10))).toBe(true);
  });

  it('rejects a walk that revisits a site', () => {
    const coords: Point[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0], // collision with residue 0
    ];
    expect(isSelfAvoiding(coords)).toBe(false);
  });
});

describe('Monte-Carlo folding reaches known ground states', () => {
  it('folds HHPPHH to its optimal energy of -2', () => {
    const r = foldHP({ sequence: 'HHPPHH', steps: 5000, temperature: 2.0, seed: 42 });
    expect(r.bestEnergy).toBe(-2); // known optimum; cannot do better on the lattice
    expect(r.hhContacts).toBe(2);
    expect(r.hhContacts).toBe(-r.bestEnergy);
  });

  it('folds the fully hydrophobic HHHHHH to its compact optimum of -2', () => {
    // Best 6-mer packs into a 2x3 block: 7 lattice adjacencies - 5 bonds = 2 contacts.
    const r = foldHP({ sequence: 'HHHHHH', steps: 5000, temperature: 2.0, seed: 7 });
    expect(r.bestEnergy).toBe(-2);
  });

  it('folds the Unger–Moult 20-mer to its published ground state of -9', () => {
    // HPHPPHHPHPPHPHHPPHPH is a standard 2D-HP benchmark with optimum E* = -9.
    const seq = 'HPHPPHHPHPPHPHHPPHPH';
    const r = foldHP({ sequence: seq, steps: 150_000, temperature: 2.5, seed: 42 });
    expect(r.bestEnergy).toBeLessThanOrEqual(-9); // -9 is optimal; never below
    // Independently re-score the returned conformation to guard the optimiser.
    expect(countHHContacts(r.bestCoords, hp(seq))).toBe(r.hhContacts);
  });

  it('every returned best conformation is a valid self-avoiding walk', () => {
    for (const seq of ['HHPPHH', 'HHHHHH', 'HPHPPHHPHPPHPHHPPHPH']) {
      const r = foldHP({ sequence: seq, steps: 20_000, temperature: 2.0, seed: 3 });
      expect(r.bestCoords.length).toBe(seq.length);
      expect(isSelfAvoiding(r.bestCoords)).toBe(true);
      // Set of distinct sites must equal chain length (no overlap).
      const distinct = new Set(r.bestCoords.map(([x, y]) => `${x},${y}`));
      expect(distinct.size).toBe(seq.length);
    }
  });

  it('reports an acceptance rate in [0, 1]', () => {
    const r = foldHP({ sequence: 'HHPPHH', steps: 5000, temperature: 2.0, seed: 1 });
    expect(r.acceptanceRate).toBeGreaterThanOrEqual(0);
    expect(r.acceptanceRate).toBeLessThanOrEqual(1);
  });

  it('does not throw on a degenerate 1-residue chain (no bonds, no contacts possible)', () => {
    // A single residue has no partner for the end-move, and no internal residue
    // for corner-flip/pivot; the proposal-selection logic must skip all moves
    // rather than dereference an out-of-bounds neighbour.
    const r = foldHP({ sequence: 'H', steps: 50, temperature: 2.0, seed: 42 });
    expect(r.bestEnergy).toBe(0);
    expect(r.hhContacts).toBe(0);
    expect(r.bestCoords).toEqual([[0, 0]]);
  });

  it('never yields a negative-zero hhContacts for a zero-contact fold', () => {
    // All-P sequences can never form an H–H contact, so the true optimum is
    // exactly 0 (not attainable as a *negative* value). hhContacts mirrors the
    // -0 -> 0 normalisation `energy()` documents; without it, `-bestE` on a
    // best energy of (normalised) +0 would silently produce IEEE -0.
    const r = foldHP({ sequence: 'PPPPPP', steps: 200, temperature: 2.0, seed: 1 });
    expect(r.bestEnergy).toBe(0);
    expect(r.hhContacts).toBe(0);
    expect(Object.is(r.hhContacts, 0)).toBe(true);
    expect(Object.is(r.hhContacts, -0)).toBe(false);
  });
});

describe('determinism (same seed -> identical result)', () => {
  it('reproduces bestEnergy and coordinates byte-for-byte for a fixed seed', () => {
    const cfg = {
      sequence: 'HPHPPHHPHPPHPHHPPHPH',
      steps: 40_000,
      temperature: 2.0,
      seed: 42,
    } as const;
    const a = foldHP({ ...cfg });
    const b = foldHP({ ...cfg });
    expect(a.bestEnergy).toBe(b.bestEnergy);
    expect(JSON.stringify(a.bestCoords)).toBe(JSON.stringify(b.bestCoords));
  });

  it('different seeds explore differently but both stay valid', () => {
    const s1 = foldHP({ sequence: 'HHPPHH', steps: 5000, temperature: 2.0, seed: 1 });
    const s2 = foldHP({ sequence: 'HHPPHH', steps: 5000, temperature: 2.0, seed: 2 });
    expect(isSelfAvoiding(s1.bestCoords)).toBe(true);
    expect(isSelfAvoiding(s2.bestCoords)).toBe(true);
    // The whole point of a seeded PRNG is that distinct seeds explore distinct
    // trajectories; assert the runs actually diverge so a regression that made
    // `foldHP` ignore `seed` (e.g. always constructing the RNG identically)
    // would be caught rather than silently passing via two individually-valid
    // but coincidentally-identical conformations.
    expect(JSON.stringify(s1.bestCoords)).not.toBe(JSON.stringify(s2.bestCoords));
    expect(s1.acceptanceRate).not.toBe(s2.acceptanceRate);
  });
});

describe('engine spec surface', () => {
  it('validates and rejects sequences via the zod schema', () => {
    expect(spec.paramsSchema.safeParse({ sequence: 'HHPPHH' }).success).toBe(true);
    expect(spec.paramsSchema.safeParse({ sequence: 'HHXPPH' }).success).toBe(false);
    expect(() => parseSequence('HHXP')).toThrow();
  });

  it('run() returns a well-formed SimResult with the required metrics', () => {
    const res = spec.run({ sequence: 'HHPPHH', steps: 5000, temperature: 2.0, seed: 42 });
    expect(res.engine).toBe('hp-folding');
    expect(res.provenance.version).toBe('1.0.0');
    expect(res.provenance.seed).toBe(42);

    const keys = res.metrics.map((m) => m.key);
    expect(keys).toContain('bestEnergy');
    expect(keys).toContain('hhContacts');
    expect(keys).toContain('acceptanceRate');

    const best = res.metrics.find((m) => m.key === 'bestEnergy');
    expect(best?.value).toBe(-2);
    expect(res.detail?.sequence).toBe('HHPPHH');
    expect(res.detail?.coordinates.length).toBe(6);
    expect(res.summary).toContain('E = -2');
  });

  it('accepts lowercase sequences and applies schema defaults', () => {
    const res = spec.run({ sequence: 'hhpphh', seed: 42 });
    expect(res.detail?.sequence).toBe('HHPPHH');
    const best = res.metrics.find((m) => m.key === 'bestEnergy');
    expect(best?.value).toBe(-2);
  });
});
