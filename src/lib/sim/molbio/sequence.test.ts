import { describe, expect, it } from 'vitest';
import {
  RNA_CODON_TABLE,
  aminoAcidComposition,
  complement,
  findORFs,
  gcContent,
  meltingTemp,
  molecularWeight,
  reverseComplement,
  sixFrameTranslations,
  spec,
  transcribe,
  translate,
} from './sequence';

// ---------------------------------------------------------------------------
// Complement / reverse complement — Watson–Crick pairing.
// ---------------------------------------------------------------------------
describe('complement / reverseComplement', () => {
  it('complements each base A/T/G/C', () => {
    expect(complement('A')).toBe('T');
    expect(complement('T')).toBe('A');
    expect(complement('G')).toBe('C');
    expect(complement('C')).toBe('G');
  });

  it('complements a full strand 5→3 (not reversed)', () => {
    expect(complement('ATGC')).toBe('TACG');
  });

  it('reverse complements ATGC to GCAT', () => {
    expect(reverseComplement('ATGC')).toBe('GCAT');
  });

  it('reverse complement is an involution', () => {
    const s = 'ATGCTTACGGGATCCA';
    expect(reverseComplement(reverseComplement(s))).toBe(s);
  });
});

// ---------------------------------------------------------------------------
// Transcription: DNA coding strand -> mRNA (T -> U).
// ---------------------------------------------------------------------------
describe('transcribe', () => {
  it('replaces T with U', () => {
    expect(transcribe('ATGC')).toBe('AUGC');
    expect(transcribe('TTTT')).toBe('UUUU');
    expect(transcribe('GGCC')).toBe('GGCC');
  });
});

// ---------------------------------------------------------------------------
// Translation via the full standard genetic code.
// ---------------------------------------------------------------------------
describe('translate', () => {
  it('translates AUGUUUUAA to MF* (stop kept as *)', () => {
    expect(translate('AUGUUUUAA')).toBe('MF*');
  });

  it('handles the DNA form too (T normalised to U)', () => {
    expect(translate('ATGTGGTAA')).toBe('MW*');
  });

  it('verifies specific canonical codons', () => {
    expect(translate('AUG')).toBe('M'); // start / Met
    expect(translate('UGG')).toBe('W'); // Trp — the only W codon
    expect(translate('UAA')).toBe('*'); // ochre stop
    expect(translate('UAG')).toBe('*'); // amber stop
    expect(translate('UGA')).toBe('*'); // opal stop
  });

  it('renders unknown codons (with N) as X and ignores partial codons', () => {
    expect(translate('AUGNNN')).toBe('MX');
    expect(translate('AUGU')).toBe('M'); // trailing single base dropped
  });

  it('has a complete 64-codon table with exactly 3 stops', () => {
    expect(Object.keys(RNA_CODON_TABLE)).toHaveLength(64);
    const stops = Object.values(RNA_CODON_TABLE).filter((a) => a === '*');
    expect(stops).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// GC content.
// ---------------------------------------------------------------------------
describe('gcContent', () => {
  it('is 100% for all-GC', () => {
    expect(gcContent('GGCC')).toBe(100);
  });
  it('is 0% for all-AT', () => {
    expect(gcContent('ATAT')).toBe(0);
  });
  it('is 50% for a balanced sequence', () => {
    expect(gcContent('ATGC')).toBe(50);
  });
  it('returns 0 for an empty sequence', () => {
    expect(gcContent('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Melting temperature.
// ---------------------------------------------------------------------------
describe('meltingTemp', () => {
  it('uses the Wallace rule for short oligos (< 14 nt)', () => {
    // ATGC: 2*(A+T) + 4*(G+C) = 2*2 + 4*2 = 12
    expect(meltingTemp('ATGC')).toBe(12);
    // AAAA: 2*4 + 0 = 8
    expect(meltingTemp('AAAA')).toBe(8);
  });

  it('uses the %GC formula for length >= 14 nt', () => {
    // 14-mer with nGC = 6, N = 14: 64.9 + 41*(6-16.4)/14 = 34.442857...
    const tm = meltingTemp('ATGCATGCATGCAT');
    expect(tm).toBeCloseTo(64.9 + (41 * (6 - 16.4)) / 14, 6);
    expect(tm).toBeCloseTo(34.4429, 3);
  });
});

// ---------------------------------------------------------------------------
// ssDNA molecular weight (IDT residue weights).
// ---------------------------------------------------------------------------
describe('molecularWeight', () => {
  it('matches the IDT ssDNA formula for one of each base', () => {
    // 313.21 + 304.2 + 289.18 + 329.21 - 61.96 = 1173.84
    expect(molecularWeight('ATCG')).toBeCloseTo(1173.84, 2);
  });

  it('scales with composition', () => {
    // Four A's: 4*313.21 - 61.96 = 1190.88
    expect(molecularWeight('AAAA')).toBeCloseTo(4 * 313.21 - 61.96, 2);
  });

  it('returns 0 for empty', () => {
    expect(molecularWeight('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Amino-acid composition.
// ---------------------------------------------------------------------------
describe('aminoAcidComposition', () => {
  it('counts residues, ignoring stops', () => {
    expect(aminoAcidComposition('MKFW')).toEqual({ M: 1, K: 1, F: 1, W: 1 });
    expect(aminoAcidComposition('MKFWM')).toEqual({ M: 2, K: 1, F: 1, W: 1 });
    expect(aminoAcidComposition('MF*')).toEqual({ M: 1, F: 1 });
  });
});

// ---------------------------------------------------------------------------
// ORF discovery across six frames.
// ---------------------------------------------------------------------------
describe('findORFs', () => {
  // ORF: ATG AAA TTT TGG TAA = M K F W stop, flanked by CCC ... GGG
  const forwardSeq = 'CCCATGAAATTTTGGTAAGGG';

  it('finds a known ORF on the sense strand', () => {
    const orfs = findORFs(forwardSeq, 1);
    const mkfw = orfs.find((o) => o.protein === 'MKFW');
    expect(mkfw).toBeDefined();
    expect(mkfw?.strand).toBe('+');
    expect(mkfw?.aaLength).toBe(4);
    expect(mkfw?.start).toBe(3); // ATG index in "CCCATG..."
    expect(mkfw?.dna).toBe('ATGAAATTTTGGTAA'); // ATG..stop inclusive
  });

  it('finds the same ORF on the antisense strand when reverse-complemented', () => {
    const rc = reverseComplement(forwardSeq);
    const orfs = findORFs(rc, 1);
    const mkfw = orfs.find((o) => o.protein === 'MKFW');
    expect(mkfw).toBeDefined();
    expect(mkfw?.strand).toBe('-');
  });

  it('respects the minimum-length filter', () => {
    // MKFW is 4 aa; requiring 5 should drop it.
    const orfs = findORFs(forwardSeq, 5);
    expect(orfs.find((o) => o.protein === 'MKFW')).toBeUndefined();
  });

  it('requires an in-frame stop (no runaway ORFs)', () => {
    // ATG with no downstream in-frame stop -> not a complete ORF.
    expect(findORFs('ATGAAAAAAAAA', 1).some((o) => o.strand === '+')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Six-frame translation sanity.
// ---------------------------------------------------------------------------
describe('sixFrameTranslations', () => {
  it('produces all six frames with frame +1 matching direct translation', () => {
    const seq = 'ATGAAATTTTGGTAA';
    const frames = sixFrameTranslations(seq);
    expect(Object.keys(frames).sort()).toEqual(['+1', '+2', '+3', '-1', '-2', '-3']);
    expect(frames['+1']).toBe(translate(seq)); // MKFW*
    expect(frames['+1']).toBe('MKFW*');
  });
});

// ---------------------------------------------------------------------------
// Engine spec.run integration.
// ---------------------------------------------------------------------------
describe('spec.run', () => {
  it('reports the required metrics and detail for a nucleotide sequence', () => {
    const res = spec.run({ sequence: 'CCCATGAAATTTTGGTAAGGG', minOrfCodons: 1 });
    const keys = res.metrics.map((m) => m.key);
    expect(keys).toContain('length');
    expect(keys).toContain('gcPercent');
    expect(keys).toContain('meltingTempC');
    expect(keys).toContain('orfCount');

    const length = res.metrics.find((m) => m.key === 'length');
    expect(length?.value).toBe(21);

    expect(res.detail?.longestOrf).not.toBeNull();
    expect(res.detail?.orfs.some((o) => o.protein === 'MKFW')).toBe(true);
    expect(res.detail?.translationFrames['+1']).toBeDefined();
    expect(res.summary).toContain('ORF');
    expect(res.provenance.engine).toBe('sequence');
    expect(res.provenance.version).toBe('1.0.0');
  });

  it('finds the 20-aa ORF in the bundled example', () => {
    const res = spec.run(spec.example);
    const orfCount = res.metrics.find((m) => m.key === 'orfCount');
    expect(orfCount?.value).toBeGreaterThanOrEqual(1);
    expect(res.detail?.longestOrf?.protein).toBe('MASKDLFWHPVMEKLSDFWH');
    expect(res.detail?.longestOrf?.aaLength).toBe(20);
  });

  it('handles a protein sequence: zeroed nucleotide metrics + composition', () => {
    const res = spec.run({ sequence: 'MKFWMK', seqType: 'protein' });
    expect(res.metrics.find((m) => m.key === 'gcPercent')?.value).toBe(0);
    expect(res.metrics.find((m) => m.key === 'orfCount')?.value).toBe(0);
    expect(res.detail?.aaComposition).toEqual({ M: 2, K: 2, F: 1, W: 1 });
  });

  it('is deterministic: identical input -> identical result', () => {
    const a = spec.run({ sequence: 'CCCATGAAATTTTGGTAAGGG', minOrfCodons: 1 });
    const b = spec.run({ sequence: 'CCCATGAAATTTTGGTAAGGG', minOrfCodons: 1 });
    expect(a).toEqual(b);
  });

  it('validates params via the zod schema', () => {
    expect(() => spec.run({ sequence: '' })).toThrow();
  });
});
