/**
 * DNA / RNA / Protein Sequence Toolkit
 * ====================================
 *
 * The foundational molecular-biology engine: the pure string/combinatorial
 * primitives every other nucleic-acid workflow builds on. Everything here is a
 * deterministic function of its input sequence — there is no stochasticity, so
 * (unlike the Gillespie / Wright–Fisher engines) this module needs no RNG, ODE
 * integrator, or linear algebra from the shared core. Determinism therefore
 * comes for free: the same sequence always yields the same result.
 *
 * Implemented biology
 * -------------------
 *  - complement / reverseComplement  (Watson–Crick base pairing)
 *  - transcribe   DNA coding strand -> mRNA (T -> U)
 *  - translate    mRNA/DNA -> protein via the FULL standard genetic code
 *                 (all 64 codons; stop codons rendered as '*')
 *  - gcContent    %GC of the valid bases
 *  - meltingTemp  Wallace rule for oligos < 12 nt; the Marmur–Wetmur %GC
 *                 approximation 64.9 + 41·(nGC − 16.4)/N for oligos >= 16 nt;
 *                 the two are linearly blended between 12-15 nt to avoid a
 *                 sharp jump at the cutover (a heuristic estimate, not a
 *                 nearest-neighbour thermodynamic calculation)
 *  - molecularWeight  single-stranded DNA average MW (IDT residue weights)
 *  - findORFs     all six reading frames, ATG…stop, with a minimum length
 *  - aminoAcidComposition  residue counts of a protein
 *
 * Assumptions / conventions
 * --------------------------
 *  - Sequences are cleaned to A–Z uppercase (whitespace / digits stripped).
 *  - `translate` accepts either DNA or RNA (T is normalised to U internally).
 *  - An "ORF" is a complete ATG…(TAA|TAG|TGA) run in a single frame; the first
 *    ATG after a previous stop opens the ORF and the next in-frame stop closes
 *    it (non-overlapping, textbook definition). Its protein excludes the stop.
 *  - Reverse-strand ORF coordinates are given in the reverse-complement
 *    sequence's own 0-based frame.
 *
 * References
 *  - Alberts et al., Molecular Biology of the Cell — standard genetic code.
 *  - Wallace R.B. et al. (1979) Nucleic Acids Res. 6:3543 — 2(A+T)+4(G+C) rule.
 *  - Marmur J. & Doty P. (1962) J. Mol. Biol.; Wetmur J.G. (1991) — %GC Tm.
 *  - IDT OligoAnalyzer — ssDNA anhydrous molecular-weight residue constants.
 */

import { z } from 'zod';
import type { EngineSpec, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

const SLUG = 'sequence';
const VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// The standard genetic code, keyed by RNA codon. Stop codons map to '*'.
// This is the canonical NCBI translation table 1 (64 entries).
// ---------------------------------------------------------------------------
export const RNA_CODON_TABLE: Readonly<Record<string, string>> = {
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

/** The 20 proteinogenic amino-acid one-letter codes (for composition tables). */
export const AMINO_ACIDS = 'ACDEFGHIKLMNPQRSTVWY'.split('');

// ssDNA average residue molecular weights (Da) — IDT convention, 5'-OH oligo.
const DNA_RESIDUE_MW: Readonly<Record<string, number>> = {
  A: 313.21,
  T: 304.2,
  C: 289.18,
  G: 329.21,
};
// End correction: removes an HPO2 and adds two H to model a 5'-OH terminus.
const SSDNA_END_CORRECTION = -61.96;

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

/** Strip everything that is not a letter and upper-case the rest. */
export function cleanSequence(seq: string): string {
  return seq.replace(/[^A-Za-z]/g, '').toUpperCase();
}

interface BaseCounts {
  A: number;
  C: number;
  G: number;
  T: number;
  U: number;
  other: number;
}

function baseCounts(seq: string): BaseCounts {
  const c: BaseCounts = { A: 0, C: 0, G: 0, T: 0, U: 0, other: 0 };
  for (const ch of seq.toUpperCase()) {
    if (ch === 'A') c.A++;
    else if (ch === 'C') c.C++;
    else if (ch === 'G') c.G++;
    else if (ch === 'T') c.T++;
    else if (ch === 'U') c.U++;
    else c.other++;
  }
  return c;
}

// ---------------------------------------------------------------------------
// Core sequence operations
// ---------------------------------------------------------------------------

const COMPLEMENT_MAP: Readonly<Record<string, string>> = {
  A: 'T',
  T: 'A',
  U: 'A',
  G: 'C',
  C: 'G',
  N: 'N',
};

/** Watson–Crick complement of a DNA strand (U is treated as T -> A). */
export function complement(seq: string): string {
  let out = '';
  for (const ch of seq.toUpperCase()) out += COMPLEMENT_MAP[ch] ?? 'N';
  return out;
}

/** Reverse complement — the antiparallel partner strand read 5'→3'. */
export function reverseComplement(seq: string): string {
  let out = '';
  const up = seq.toUpperCase();
  for (let i = up.length - 1; i >= 0; i--) {
    const ch = up.charAt(i);
    out += COMPLEMENT_MAP[ch] ?? 'N';
  }
  return out;
}

/** Transcribe a DNA coding (sense) strand into mRNA: substitute T -> U. */
export function transcribe(dna: string): string {
  return dna.toUpperCase().replace(/T/g, 'U');
}

/**
 * Translate a nucleotide sequence (DNA or mRNA) into a protein using the full
 * standard genetic code. Stops are '*'. Any codon containing a non-ACGU base
 * (e.g. N) becomes 'X'. A trailing partial codon (< 3 nt) is ignored.
 */
export function translate(seq: string): string {
  const rna = seq.toUpperCase().replace(/T/g, 'U');
  let protein = '';
  for (let i = 0; i + 3 <= rna.length; i += 3) {
    const codon = rna.slice(i, i + 3);
    protein += RNA_CODON_TABLE[codon] ?? 'X';
  }
  return protein;
}

/** Percent GC content over the valid bases (A/C/G/T/U). Empty -> 0. */
export function gcContent(seq: string): number {
  const c = baseCounts(seq);
  const total = c.A + c.C + c.G + c.T + c.U;
  if (total === 0) return 0;
  return ((c.G + c.C) / total) * 100;
}

// Melting-temperature model: the Wallace rule (short oligos) and the %GC
// approximation (longer ones) are each individually well cited, but naively
// switching between them at a single length threshold produces a sharp,
// non-physical jump right at the cutover — e.g. for an AT-rich oligo, Tm can
// appear to *drop* by roughly 9-10 degC when a single base is appended right
// at the old n=14 boundary (2*13=26 vs 64.9+41*(0-16.4)/14≈16.9). Neither
// formula is "wrong" for its own regime, but splicing them abruptly is not
// physically meaningful, so the two estimates are linearly blended across a
// short transition window instead. Below the window, only the Wallace rule
// is used; above it, only the %GC formula is used; the blend keeps both
// endpoints continuous with their respective pure regimes.
const TM_BLEND_LOW_N = 12; // below this length (nt): pure Wallace rule
const TM_BLEND_HIGH_N = 16; // at/above this length (nt): pure %GC formula

/**
 * Melting temperature (°C) — a heuristic estimate, not a thermodynamic
 * (nearest-neighbour) calculation.
 *  - Oligos < 12 valid bases: Wallace rule  Tm = 2·(A+T) + 4·(G+C).
 *  - Oligos ≥ 16 valid bases: %GC approximation  Tm = 64.9 + 41·(nGC − 16.4)/N.
 *  - 12-15 valid bases: linear blend of the two formulas above, so Tm does
 *    not jump sharply across the transition (see TM_BLEND_LOW_N/HIGH_N).
 * (U is counted as T so RNA oligos are handled too.)
 */
export function meltingTemp(seq: string): number {
  const c = baseCounts(seq);
  const at = c.A + c.T + c.U;
  const gc = c.G + c.C;
  const n = at + gc;
  if (n === 0) return 0;
  const wallace = 2 * at + 4 * gc;
  if (n < TM_BLEND_LOW_N) return wallace;
  const gcFormula = 64.9 + (41 * (gc - 16.4)) / n;
  if (n >= TM_BLEND_HIGH_N) return gcFormula;
  const weight = (n - TM_BLEND_LOW_N) / (TM_BLEND_HIGH_N - TM_BLEND_LOW_N);
  return (1 - weight) * wallace + weight * gcFormula;
}

/**
 * Average molecular weight (Da) of a single-stranded DNA oligo, using IDT
 * residue weights and a 5'-OH end correction. U is treated as T (DNA form).
 */
export function molecularWeight(seq: string): number {
  const dna = seq.toUpperCase().replace(/U/g, 'T');
  const c = baseCounts(dna);
  const total = c.A + c.C + c.G + c.T;
  if (total === 0) return 0;
  const A = DNA_RESIDUE_MW.A ?? 0;
  const T = DNA_RESIDUE_MW.T ?? 0;
  const C = DNA_RESIDUE_MW.C ?? 0;
  const G = DNA_RESIDUE_MW.G ?? 0;
  return c.A * A + c.T * T + c.C * C + c.G * G + SSDNA_END_CORRECTION;
}

/** Count of each proteinogenic residue present in a protein (ignores * and X). */
export function aminoAcidComposition(protein: string): Record<string, number> {
  const comp: Record<string, number> = {};
  for (const ch of protein.toUpperCase()) {
    if (ch === '*' || ch === 'X') continue;
    comp[ch] = (comp[ch] ?? 0) + 1;
  }
  return comp;
}

// ---------------------------------------------------------------------------
// Open reading frames
// ---------------------------------------------------------------------------

export interface Orf {
  /** '+' for the given strand, '-' for its reverse complement. */
  strand: '+' | '-';
  /** Signed reading frame: +1..+3 on the sense strand, -1..-3 on the antisense. */
  frame: number;
  /** 0-based start index of the ATG within this strand's own sequence. */
  start: number;
  /** 0-based end index (exclusive) just past the stop codon. */
  end: number;
  /** Nucleotide length including start and stop codons. */
  nucLength: number;
  /** Protein length in amino acids (excludes the stop). */
  aaLength: number;
  /** Translated protein (no trailing stop). */
  protein: string;
  /** The coding DNA (ATG…stop, inclusive) on this strand. */
  dna: string;
}

const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA']);

/** Scan the three forward frames of a DNA strand for complete ATG…stop ORFs. */
function orfsOnStrand(dna: string, strand: '+' | '-', minAa: number): Orf[] {
  const orfs: Orf[] = [];
  for (let frame = 0; frame < 3; frame++) {
    let orfStart = -1;
    for (let pos = frame; pos + 3 <= dna.length; pos += 3) {
      const codon = dna.slice(pos, pos + 3);
      if (orfStart === -1) {
        if (codon === 'ATG') orfStart = pos;
      } else if (STOP_CODONS.has(codon)) {
        const end = pos + 3; // exclusive, past the stop
        const codingNoStop = dna.slice(orfStart, pos);
        const protein = translate(codingNoStop);
        if (protein.length >= minAa) {
          orfs.push({
            strand,
            frame: strand === '+' ? frame + 1 : -(frame + 1),
            start: orfStart,
            end,
            nucLength: end - orfStart,
            aaLength: protein.length,
            protein,
            dna: dna.slice(orfStart, end),
          });
        }
        orfStart = -1;
      }
    }
  }
  return orfs;
}

/**
 * Find all ORFs across the six reading frames (3 sense + 3 antisense).
 * `minCodons` is the minimum protein length in amino acids (excluding stop).
 * Results are sorted longest-first, then by strand (+ before −) then position,
 * giving a fully deterministic ordering.
 */
export function findORFs(seq: string, minCodons = 1): Orf[] {
  const dna = cleanSequence(seq).replace(/U/g, 'T');
  const rc = reverseComplement(dna);
  const all = [...orfsOnStrand(dna, '+', minCodons), ...orfsOnStrand(rc, '-', minCodons)];
  all.sort((a, b) => {
    if (b.aaLength !== a.aaLength) return b.aaLength - a.aaLength;
    if (a.strand !== b.strand) return a.strand === '+' ? -1 : 1;
    return a.start - b.start;
  });
  return all;
}

/** Translate the three forward frames of a strand (full length, stops as '*'). */
function threeFrameTranslations(dna: string): [string, string, string] {
  return [translate(dna.slice(0)), translate(dna.slice(1)), translate(dna.slice(2))];
}

/** Six-frame translation record keyed '+1'..'+3','-1'..'-3'. */
export function sixFrameTranslations(seq: string): Record<string, string> {
  const dna = cleanSequence(seq).replace(/U/g, 'T');
  const rc = reverseComplement(dna);
  const [f1, f2, f3] = threeFrameTranslations(dna);
  const [r1, r2, r3] = threeFrameTranslations(rc);
  return { '+1': f1, '+2': f2, '+3': f3, '-1': r1, '-2': r2, '-3': r3 };
}

// ---------------------------------------------------------------------------
// Engine: params, detail, run
// ---------------------------------------------------------------------------

export const sequenceParamsSchema = z.object({
  sequence: z.string().min(1).describe('The nucleotide (DNA/RNA) or protein sequence to analyse.'),
  minOrfCodons: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('Minimum ORF length in amino acids (default 30).'),
  seqType: z
    .enum(['dna', 'rna', 'protein'])
    .optional()
    .describe('Override sequence-type auto-detection.'),
});

export type SequenceParams = z.infer<typeof sequenceParamsSchema>;

export interface SequenceDetail {
  seqType: 'dna' | 'rna' | 'protein';
  cleanedSequence: string;
  molecularWeightDa: number;
  orfs: Orf[];
  longestOrf: Orf | null;
  translationFrames: Record<string, string>;
  aaComposition: Record<string, number>;
}

/** Auto-detect whether a cleaned sequence is DNA, RNA, or protein. */
function inferSeqType(seq: string): 'dna' | 'rna' | 'protein' {
  if (seq.length === 0) return 'dna';
  if (!/^[ACGTUN]+$/.test(seq)) return 'protein';
  const hasU = seq.includes('U');
  const hasT = seq.includes('T');
  return hasU && !hasT ? 'rna' : 'dna';
}

const DEFAULT_MIN_ORF = 30;

function windowedGcSeries(dna: string): Series | undefined {
  if (dna.length < 10) return undefined;
  const w = Math.min(dna.length, 20);
  const x: number[] = [];
  const gc: number[] = [];
  for (let i = 0; i + w <= dna.length; i++) {
    x.push(i);
    gc.push(gcContent(dna.slice(i, i + w)));
  }
  return { x, y: { gcPercent: gc }, xLabel: 'window start (nt)', yLabel: '%GC' };
}

export function run(params: SequenceParams): SimResult<SequenceDetail> {
  const p = sequenceParamsSchema.parse(params);
  const clean = cleanSequence(p.sequence);
  const seqType = p.seqType ?? inferSeqType(clean);
  const minAa = p.minOrfCodons ?? DEFAULT_MIN_ORF;

  const provBlock = provenance(SLUG, VERSION, {
    sequence: clean,
    minOrfCodons: minAa,
    seqType,
  });

  // Protein input: nucleotide-only metrics are not meaningful -> reported as 0.
  if (seqType === 'protein') {
    const comp = aminoAcidComposition(clean);
    let topRes = '';
    let topCount = 0;
    for (const aa of Object.keys(comp).sort()) {
      const n = comp[aa] ?? 0;
      if (n > topCount) {
        topCount = n;
        topRes = aa;
      }
    }
    return {
      engine: SLUG,
      summary: `Protein of ${clean.length} aa; most frequent residue ${topRes || 'n/a'} (${topCount}).`,
      metrics: [
        { key: 'length', label: 'Length', value: clean.length, unit: 'aa' },
        {
          key: 'gcPercent',
          label: 'GC content',
          value: 0,
          unit: '%',
          note: 'not applicable to protein',
        },
        {
          key: 'meltingTempC',
          label: 'Melting temperature',
          value: 0,
          unit: '°C',
          note: 'not applicable to protein',
        },
        { key: 'orfCount', label: 'ORF count', value: 0, note: 'not applicable to protein' },
      ],
      detail: {
        seqType,
        cleanedSequence: clean,
        molecularWeightDa: 0,
        orfs: [],
        longestOrf: null,
        translationFrames: {},
        aaComposition: comp,
      },
      provenance: provBlock,
    };
  }

  // Nucleotide input (DNA or RNA).
  const dnaForm = clean.replace(/U/g, 'T');
  const gcPercent = gcContent(clean);
  const tm = meltingTemp(clean);
  const mw = molecularWeight(clean);
  const orfs = findORFs(dnaForm, minAa);
  const longestOrf = orfs.length > 0 ? (orfs[0] as Orf) : null;
  const frames = sixFrameTranslations(dnaForm);
  const aaComp = longestOrf ? aminoAcidComposition(longestOrf.protein) : {};

  const summary = longestOrf
    ? `Longest ORF: frame ${longestOrf.frame > 0 ? '+' : ''}${longestOrf.frame} (${longestOrf.strand}), ` +
      `${longestOrf.aaLength} aa — ${longestOrf.protein.slice(0, 24)}${longestOrf.protein.length > 24 ? '…' : ''}`
    : `No ORF ≥ ${minAa} codons in 6 frames (${clean.length} nt, GC ${gcPercent.toFixed(1)}%).`;

  const series = windowedGcSeries(dnaForm);

  const result: SimResult<SequenceDetail> = {
    engine: SLUG,
    summary,
    metrics: [
      { key: 'length', label: 'Length', value: clean.length, unit: 'nt' },
      { key: 'gcPercent', label: 'GC content', value: gcPercent, unit: '%' },
      {
        key: 'meltingTempC',
        label: 'Melting temperature',
        value: tm,
        unit: '°C',
        note: 'Wallace (<12 nt), %GC formula (>=16 nt), blended in between — a heuristic, not a nearest-neighbour Tm',
      },
      {
        key: 'orfCount',
        label: 'ORF count',
        value: orfs.length,
        note: `≥ ${minAa} aa across 6 frames`,
      },
      { key: 'molecularWeightDa', label: 'ssDNA molecular weight', value: mw, unit: 'Da' },
    ],
    detail: {
      seqType,
      cleanedSequence: clean,
      molecularWeightDa: mw,
      orfs,
      longestOrf,
      translationFrames: frames,
      aaComposition: aaComp,
    },
    provenance: provBlock,
  };
  if (series) result.series = [series];
  return result;
}

export const spec: EngineSpec<SequenceParams, SequenceDetail> = {
  slug: SLUG,
  title: 'DNA/RNA/Protein Sequence Toolkit',
  domain: 'molecular-biology',
  version: VERSION,
  description:
    'Core sequence biology on a DNA, RNA, or protein string: complement and ' +
    'reverse complement, transcription, translation via the full standard ' +
    'genetic code, GC content, melting temperature (a documented heuristic: ' +
    'the Wallace rule for short oligos and the %GC approximation for longer ' +
    'ones, linearly blended between 12-15 nt to avoid a sharp jump at the ' +
    'cutover — not a nearest-neighbour thermodynamic calculation), ' +
    'single-stranded DNA molecular weight, six-frame ORF discovery, and ' +
    'amino-acid composition. Fully deterministic — no randomness, no external state.',
  references: [
    'Alberts et al., Molecular Biology of the Cell — standard genetic code (NCBI table 1).',
    'Wallace R.B. et al. (1979) Nucleic Acids Res. 6:3543 — 2(A+T)+4(G+C) Tm rule.',
    'Marmur J. & Doty P. (1962) J. Mol. Biol. 5:109; Wetmur J.G. (1991) — %GC Tm.',
    'IDT OligoAnalyzer — single-stranded DNA molecular-weight residue constants.',
  ],
  paramsSchema: sequenceParamsSchema,
  run,
  example: {
    // A synthetic construct: 4 nt of 5'-UTR, a 20-codon ORF, 4 nt of 3'-UTR.
    sequence: 'CACAATGGCTAGCAAAGATCTGTTTTGGCATCCGGTTATGGAAAAGCTGAGCGATTTTTGGCATTAAGTGT',
    minOrfCodons: 20,
  },
  tags: [
    'dna',
    'rna',
    'protein',
    'translation',
    'orf',
    'gc-content',
    'melting-temperature',
    'genetic-code',
  ],
};

export default spec;
