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

  // The shape check above (64 entries / 3 stops) can't catch a mistranslated
  // codon as long as the swap preserves that shape (e.g. transposing two
  // synonymous-codon rows, or conflating the standard code with a
  // mitochondrial variant). Pin the exact table against the canonical NCBI
  // "standard" genetic code, translation table 1:
  // https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi#SG1
  it('matches the canonical NCBI standard genetic code (table 1) codon-for-codon', () => {
    const NCBI_STANDARD_CODE_TABLE_1: Readonly<Record<string, string>> = {
      UUU: 'F',
      UUC: 'F',
      UUA: 'L',
      UUG: 'L',
      CUU: 'L',
      CUC: 'L',
      CUA: 'L',
      CUG: 'L',
      AUU: 'I',
      AUC: 'I',
      AUA: 'I',
      AUG: 'M',
      GUU: 'V',
      GUC: 'V',
      GUA: 'V',
      GUG: 'V',
      UCU: 'S',
      UCC: 'S',
      UCA: 'S',
      UCG: 'S',
      CCU: 'P',
      CCC: 'P',
      CCA: 'P',
      CCG: 'P',
      ACU: 'T',
      ACC: 'T',
      ACA: 'T',
      ACG: 'T',
      GCU: 'A',
      GCC: 'A',
      GCA: 'A',
      GCG: 'A',
      UAU: 'Y',
      UAC: 'Y',
      UAA: '*',
      UAG: '*',
      CAU: 'H',
      CAC: 'H',
      CAA: 'Q',
      CAG: 'Q',
      AAU: 'N',
      AAC: 'N',
      AAA: 'K',
      AAG: 'K',
      GAU: 'D',
      GAC: 'D',
      GAA: 'E',
      GAG: 'E',
      UGU: 'C',
      UGC: 'C',
      UGA: '*',
      UGG: 'W',
      CGU: 'R',
      CGC: 'R',
      CGA: 'R',
      CGG: 'R',
      AGU: 'S',
      AGC: 'S',
      AGA: 'R',
      AGG: 'R',
      GGU: 'G',
      GGC: 'G',
      GGA: 'G',
      GGG: 'G',
    };
    expect(RNA_CODON_TABLE).toEqual(NCBI_STANDARD_CODE_TABLE_1);
  });

  // Spot-check the specific codons where the standard code diverges from the
  // vertebrate mitochondrial code — the exact places a "fix" that conflates
  // the two codes would silently corrupt (UGA=Stop not Trp, AUA=Ile not Met,
  // AGA/AGG=Arg not Stop).
  it('does not conflate the standard code with the vertebrate mitochondrial code', () => {
    expect(RNA_CODON_TABLE.UGA).toBe('*'); // mito: Trp (W)
    expect(RNA_CODON_TABLE.AUA).toBe('I'); // mito: Met (M)
    expect(RNA_CODON_TABLE.AGA).toBe('R'); // mito: Stop
    expect(RNA_CODON_TABLE.AGG).toBe('R'); // mito: Stop
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
  it('uses the Wallace rule for short oligos (< 12 nt)', () => {
    // ATGC: 2*(A+T) + 4*(G+C) = 2*2 + 4*2 = 12
    expect(meltingTemp('ATGC')).toBe(12);
    // AAAA: 2*4 + 0 = 8
    expect(meltingTemp('AAAA')).toBe(8);
  });

  it('uses the %GC formula for length >= 16 nt', () => {
    // 16-mer, all-A (nGC = 0, N = 16): 64.9 + 41*(0-16.4)/16
    const tm = meltingTemp('A'.repeat(16));
    expect(tm).toBeCloseTo(64.9 + (41 * (0 - 16.4)) / 16, 6);
  });

  it('linearly blends the Wallace and %GC formulas for 12-15 nt', () => {
    // 14-mer with nGC = 6, N = 14: Wallace = 2*8 + 4*6 = 40,
    // %GC formula = 64.9 + 41*(6-16.4)/14 = 34.442857..., blended 50/50
    // (n=14 is the midpoint of the 12-16 transition window).
    const wallace = 2 * 8 + 4 * 6;
    const gcFormula = 64.9 + (41 * (6 - 16.4)) / 14;
    const tm = meltingTemp('ATGCATGCATGCAT');
    expect(tm).toBeCloseTo(0.5 * wallace + 0.5 * gcFormula, 6);
    expect(tm).toBeCloseTo(37.2214, 3);
  });

  // Regression for the audit finding: a hard cutover at n=14 made Tm *drop*
  // by ~9-10 degC when a single AT-rich base was appended right at the
  // boundary (meltingTemp('A'.repeat(13)) = 26 vs meltingTemp('A'.repeat(14))
  // = 16.87 under the old two-branch splice). The blended transition keeps
  // that per-nucleotide swing small instead of a double-digit jump.
  it('keeps Tm changes small across the old 13/14 nt cutover for AT-rich oligos', () => {
    const tm13 = meltingTemp('A'.repeat(13));
    const tm14 = meltingTemp('A'.repeat(14));
    expect(Math.abs(tm13 - tm14)).toBeLessThan(2);
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
