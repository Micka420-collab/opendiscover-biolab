import { describe, expect, it } from 'vitest';
import {
  type GuideRecord,
  PROTOSPACER_LEN,
  cfdScore,
  designGuides,
  extractProtospacer,
  findPams,
  gcContent,
  hammingDistance,
  offTargetSearch,
  onTargetScore,
  rankGuides,
  revComp,
  spec,
} from './crispr';

// A 20-nt protospacer with no internal 'GG' and no poly-T, used as a fixture.
const PROTO20 = 'ACGTACGTACGTACGTACGT';

describe('sequence utilities', () => {
  it('reverse-complements DNA correctly', () => {
    expect(revComp('AAAACCCGGT')).toBe('ACCGGGTTTT');
    // Involution: revComp(revComp(x)) == x.
    expect(revComp(revComp('GATTACAGATTAC'))).toBe('GATTACAGATTAC');
  });

  it('computes GC content', () => {
    expect(gcContent('GGGGCCCC')).toBe(1);
    expect(gcContent('AAAATTTT')).toBe(0);
    expect(gcContent('ACGT')).toBe(0.5);
  });

  it('computes Hamming distance', () => {
    expect(hammingDistance('AAAA', 'AAAA')).toBe(0);
    expect(hammingDistance('AAAA', 'AATA')).toBe(1);
    expect(hammingDistance('ACGT', 'TGCA')).toBe(4);
  });
});

describe('findPams / extractProtospacer — SpCas9', () => {
  it('finds a single known NGG and yields a 20-nt protospacer at the expected position', () => {
    // Exactly one NGG in the whole construct: the trailing 'AGG'.
    // Layout: [20-nt PROTO20][A G G]  → PAM starts at index 20, spacer at 0.
    const seq = `${PROTO20}AGG`;
    const pams = findPams(seq, { enzyme: 'SpCas9' });

    expect(pams).toHaveLength(1);
    const pam = pams[0];
    expect(pam.strand).toBe('+');
    expect(pam.pam).toBe('AGG');
    expect(pam.pamPosition).toBe(20);
    expect(pam.protospacerStart).toBe(0);

    const proto = extractProtospacer(seq, pam);
    expect(proto).not.toBeNull();
    expect(proto).toHaveLength(PROTOSPACER_LEN);
    expect(proto).toBe(PROTO20);
  });

  it('detects a reverse-strand NGG and returns the reverse-complement protospacer', () => {
    // Reverse-strand NGG appears on the forward strand as 5'-CCN-3'.
    // 'CCA' at the 5' end → reverse PAM read 5'->3' is revComp('CCA') = 'TGG'.
    // The reverse protospacer is the forward window just 3' of 'CCA'.
    const fwdWindow = 'GATTACAGATTACAGATTAC'; // 20 nt, no forward 'GG'
    const seq = `CCA${fwdWindow}`;
    const pams = findPams(seq, { enzyme: 'SpCas9' });

    const minus = pams.find((p) => p.strand === '-');
    expect(minus).toBeDefined();
    expect(minus!.pam).toBe('TGG'); // NGG on the reverse strand
    expect(minus!.protospacerStart).toBe(3);

    const proto = extractProtospacer(seq, minus!);
    // Guide binds the reverse strand → it is the reverse complement of the window.
    expect(proto).toBe(revComp(fwdWindow));
  });
});

describe('findPams — Cas12a (TTTV PAM)', () => {
  it("finds a 5'-TTTV-3' PAM with the protospacer on its 3' side", () => {
    // Layout: [T T T A][20-nt PROTO20] → PAM at 0, spacer at 4.
    const seq = `TTTA${PROTO20}`;
    const pams = findPams(seq, { enzyme: 'Cas12a' });

    const fwd = pams.find((p) => p.strand === '+' && p.protospacerStart === 4);
    expect(fwd).toBeDefined();
    expect(fwd!.pam).toBe('TTTA');
    expect(fwd!.pam.slice(0, 3)).toBe('TTT');
    expect(extractProtospacer(seq, fwd!)).toBe(PROTO20);
  });

  it('rejects TTTT as a PAM (V must be A/C/G, not T)', () => {
    const seq = `TTTT${PROTO20}`;
    const pams = findPams(seq, { enzyme: 'Cas12a' });
    // 'TTTT' is not a valid PAM; the only TTTV-like motif fails the V test.
    expect(pams.find((p) => p.strand === '+' && p.pam === 'TTTT')).toBeUndefined();
  });
});

describe('onTargetScore — documented GC / feature trends', () => {
  it('is always normalised to (0,1)', () => {
    for (const s of [
      PROTO20,
      'GGGGGGGGGGGGGGGGGGGG',
      'AAAAAAAAAAAAAAAAAAAA',
      'GATTACAGATTACAGATTAC',
    ]) {
      const v = onTargetScore(s);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('favours balanced GC over GC-extreme spacers (Doench 2014 GC optimum)', () => {
    const balanced = onTargetScore('ACGTACGTACGTACGTACGG'); // ~55% GC, ends in G
    const allG = onTargetScore('GGGGGGGGGGGGGGGGGGGG'); // 100% GC
    const allA = onTargetScore('AAAAAAAAAAAAAAAAAAAA'); // 0% GC
    expect(balanced).toBeGreaterThan(allG);
    expect(balanced).toBeGreaterThan(allA);
  });

  it('penalises a poly-T (Pol-III terminator) tract', () => {
    // Same base composition family; the TTTT-containing spacer must score lower.
    const withTTTT = onTargetScore('ACGTTTTACGTACGTACGCA');
    const withoutTTTT = onTargetScore('ACGTATATACGTACGTACGCA'.slice(0, 20));
    expect(withTTTT).toBeLessThan(withoutTTTT);
  });
});

describe('cfdScore — CFD-like seed vs distal mismatch penalty (Doench 2016)', () => {
  it('scores a perfect match as 1.0', () => {
    expect(cfdScore(PROTO20, PROTO20)).toBe(1);
  });

  it("penalises a PAM-proximal (seed) mismatch far more than a 5'-distal one", () => {
    const distal = PROTO20.split('');
    distal[0] = distal[0] === 'A' ? 'C' : 'A'; // mismatch at 5' end (index 0)
    const seed = PROTO20.split('');
    seed[19] = seed[19] === 'A' ? 'C' : 'A'; // mismatch at PAM-proximal end (index 19)

    const cfdDistal = cfdScore(PROTO20, distal.join(''));
    const cfdSeed = cfdScore(PROTO20, seed.join(''));

    // A single distal mismatch keeps activity high; a seed mismatch abolishes it.
    expect(cfdDistal).toBeGreaterThan(cfdSeed);
    expect(cfdDistal).toBeGreaterThan(0.8);
    expect(cfdSeed).toBeLessThan(0.2);
  });

  it('multiplies penalties for multiple mismatches (≤ any single-mismatch score)', () => {
    const two = PROTO20.split('');
    two[0] = 'C';
    two[1] = two[1] === 'A' ? 'G' : 'A';
    const single = PROTO20.split('');
    single[0] = 'C';
    expect(cfdScore(PROTO20, two.join(''))).toBeLessThan(cfdScore(PROTO20, single.join('')));
  });
});

describe('offTargetSearch — exact-copy detection & specificity', () => {
  const GUIDE = 'GATTACAGATTACAGATTAC'; // non-palindromic 20-mer
  const FILLER = 'TTTTTTTTTT'; // 10-nt spacer that cannot near-match GUIDE

  it('reports an exact-match off-target when the genome contains an exact copy', () => {
    const genome = `${FILLER}${GUIDE}${FILLER}`;
    const res = offTargetSearch(GUIDE, genome, { maxMismatch: 3 });

    const exact = res.sites.find((s) => s.mismatches === 0);
    expect(exact).toBeDefined();
    expect(exact!.strand).toBe('+');
    expect(exact!.position).toBe(FILLER.length); // guide sits right after the filler
    expect(exact!.cfd).toBe(1);
  });

  it('gives a unique guide higher specificity than a repeated one', () => {
    const genomeUnique = `${FILLER}${GUIDE}${FILLER}`;
    const genomeRepeated = `${FILLER}${GUIDE}${FILLER}${GUIDE}${FILLER}`;

    const unique = offTargetSearch(GUIDE, genomeUnique, { maxMismatch: 3 });
    const repeated = offTargetSearch(GUIDE, genomeRepeated, { maxMismatch: 3 });

    expect(unique.offTargetCount).toBe(1);
    expect(repeated.offTargetCount).toBe(2);
    // 1/(1+1)=0.5  vs  1/(1+2)≈0.333.
    expect(unique.specificity).toBeGreaterThan(repeated.specificity);
    expect(unique.specificity).toBeCloseTo(0.5, 10);
    expect(repeated.specificity).toBeCloseTo(1 / 3, 10);
  });

  it('excludes the intended on-target site from the off-target tally', () => {
    const genome = `${FILLER}${GUIDE}${FILLER}`;
    const withExclusion = offTargetSearch(GUIDE, genome, {
      maxMismatch: 3,
      onTargetPosition: FILLER.length,
      onTargetStrand: '+',
    });
    // The only perfect match is the on-target → no off-targets → specificity 1.0.
    expect(withExclusion.offTargetCount).toBe(0);
    expect(withExclusion.specificity).toBe(1);
  });
});

describe('rankGuides', () => {
  it('orders guides by on-target × specificity, best first', () => {
    const mk = (position: number, onTarget: number, specificity: number): GuideRecord => ({
      protospacer: PROTO20,
      pam: 'AGG',
      strand: '+',
      position,
      onTarget,
      offTargetCount: 0,
      specificity,
    });
    const ranked = rankGuides([
      mk(0, 0.5, 0.5), // product 0.25
      mk(1, 0.9, 0.9), // product 0.81  → best
      mk(2, 0.9, 0.2), // product 0.18
    ]);
    expect(ranked.map((g) => g.position)).toEqual([1, 0, 2]);
  });
});

describe('designGuides — self-search excludes own origin', () => {
  it('gives a unique in-sequence guide specificity 1.0', () => {
    // Non-palindromic spacer (revComp != self) with no internal 'GG', so the
    // construct has exactly one PAM and the guide is genuinely unique.
    const spacer = 'GATTACAGATTACAGATTAC';
    const seq = `${spacer}AGG`;
    const guides = designGuides(seq, { enzyme: 'SpCas9' });
    expect(guides).toHaveLength(1);
    expect(guides[0].protospacer).toBe(spacer);
    expect(guides[0].specificity).toBe(1); // own site excluded → no off-targets
  });
});

describe('spec.run — end-to-end contract', () => {
  it('returns metrics, detail and provenance in the canonical shape', () => {
    const res = spec.run(spec.example);
    expect(res.engine).toBe('crispr');

    const keys = res.metrics.map((m) => m.key);
    expect(keys).toEqual(['guideCount', 'bestOnTarget', 'bestSpecificity']);

    const guideCount = res.metrics.find((m) => m.key === 'guideCount')!.value;
    expect(guideCount).toBeGreaterThan(0);
    expect(res.detail!.guides).toHaveLength(guideCount);

    const bestOn = res.metrics.find((m) => m.key === 'bestOnTarget')!.value;
    const bestSpec = res.metrics.find((m) => m.key === 'bestSpecificity')!.value;
    for (const v of [bestOn, bestSpec]) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    }

    // Every reported guide is internally consistent.
    for (const g of res.detail!.guides) {
      expect(g.protospacer).toHaveLength(PROTOSPACER_LEN);
      expect(g.onTarget).toBeGreaterThan(0);
      expect(g.onTarget).toBeLessThan(1);
      expect(g.specificity).toBeGreaterThan(0);
      expect(g.specificity).toBeLessThanOrEqual(1);
    }

    expect(res.provenance.engine).toBe('crispr');
    expect(res.provenance.version).toBe('1.0.0');
  });

  it('is deterministic: identical params give byte-identical results', () => {
    const a = spec.run(spec.example);
    const b = spec.run(spec.example);
    expect(a).toEqual(b);
  });

  it('finds Cas12a guides when the enzyme is switched', () => {
    const seq = `TTTA${PROTO20}TTTC${PROTO20}`;
    const res = spec.run({ sequence: seq, enzyme: 'Cas12a', maxMismatch: 3, seed: 'crispr' });
    expect(res.detail!.guides.length).toBeGreaterThan(0);
    for (const g of res.detail!.guides) expect(g.pam.slice(0, 3)).toBe('TTT');
  });

  it('rejects non-DNA sequences via the zod schema', () => {
    expect(() =>
      spec.run({ sequence: 'ACGTX', enzyme: 'SpCas9', maxMismatch: 3, seed: 'crispr' } as never),
    ).toThrow();
  });
});
