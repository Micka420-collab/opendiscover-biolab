/**
 * Protocol: Small ORF mining in understudied bacterial genomes.
 *
 * Scientific rationale
 * --------------------
 * Small open reading frames (sORFs, 20–100 amino acids) are systematically
 * under-annotated by standard gene-prediction pipelines (Prodigal, GeneMark)
 * which were tuned for canonical genes. The literature increasingly shows
 * that bacterial sORFs play roles in signaling, regulation, and stress
 * response, but only a small fraction are catalogued (see SmProt, sORFs.org).
 *
 * Citizen-discoverable signal: an sORF whose codon usage diverges sharply
 * from the genome's bulk gene set is a candidate for horizontally acquired
 * or recently evolved coding sequence — interesting if not in known databases.
 *
 * This protocol is fully deterministic: same input slice → same output hash.
 * Verifiable by anyone with a browser. No external API calls required during
 * the run (the genome slice is provided as input).
 */

import { canonicalHash } from '@/lib/util/hash';

/* ─────────── Types ─────────── */

export interface SmallOrfInput {
  /** NCBI accession or arbitrary identifier of the genome */
  genomeId: string;
  /** DNA sequence (A/C/G/T/N), already extracted to a window */
  sequence: string;
  /** Genomic coordinate where this slice starts (1-based) */
  windowStart: number;
  /** Minimum ORF length in amino acids */
  minAa?: number;
  /** Maximum ORF length in amino acids */
  maxAa?: number;
  /** Codon-bias z-score threshold to flag as "divergent" */
  zThreshold?: number;
  /** Stable slice key for "disjoint" checks across submissions */
  sliceKey: string;
}

export interface SmallOrfHit {
  startNt: number;
  endNt: number;
  strand: '+' | '-';
  startCodon: string;
  lengthAa: number;
  proteinSequence: string;
  codonBiasZ: number;
}

export interface SmallOrfOutput {
  genomeId: string;
  windowStart: number;
  windowLengthNt: number;
  hits: SmallOrfHit[];
  bulkCodonUsage: Record<string, number>;
  schemaVersion: 1;
}

/* ─────────── Constants ─────────── */

const STANDARD_CODON_TABLE: Record<string, string> = {
  TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L', CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L',
  ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M', GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V',
  TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S', CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T', GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*', CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q',
  AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K', GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E',
  TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W', CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
  AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R', GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
};

const START_CODONS = new Set(['ATG', 'GTG', 'TTG']);
const STOP_CODONS = new Set(['TAA', 'TAG', 'TGA']);

/* ─────────── Algorithm ─────────── */

export function runSmallOrfMining(input: SmallOrfInput): SmallOrfOutput {
  const minAa = input.minAa ?? 20;
  const maxAa = input.maxAa ?? 100;
  const zThreshold = input.zThreshold ?? 2.0;
  const seq = input.sequence.toUpperCase();

  const allHits: SmallOrfHit[] = [];
  const bulkUsage = computeCodonUsage(seq);

  for (const strand of ['+', '-'] as const) {
    const workingSeq = strand === '+' ? seq : reverseComplement(seq);
    for (let frame = 0; frame < 3; frame++) {
      const frameHits = scanFrame(workingSeq, frame, minAa, maxAa);
      for (const h of frameHits) {
        const z = codonBiasZ(h.proteinDna, bulkUsage);
        if (z < zThreshold) continue;
        const [startNt, endNt] =
          strand === '+'
            ? [input.windowStart + h.startNtInFrame, input.windowStart + h.endNtInFrame]
            : [
                input.windowStart + seq.length - h.endNtInFrame - 1,
                input.windowStart + seq.length - h.startNtInFrame - 1,
              ];
        allHits.push({
          startNt,
          endNt,
          strand,
          startCodon: h.startCodon,
          lengthAa: h.lengthAa,
          proteinSequence: h.proteinSequence,
          codonBiasZ: round(z, 3),
        });
      }
    }
  }

  // Stable sort for determinism
  allHits.sort((a, b) =>
    a.startNt !== b.startNt
      ? a.startNt - b.startNt
      : a.strand === b.strand
        ? 0
        : a.strand === '+'
          ? -1
          : 1,
  );

  return {
    genomeId: input.genomeId,
    windowStart: input.windowStart,
    windowLengthNt: seq.length,
    hits: allHits,
    bulkCodonUsage: roundMap(bulkUsage, 4),
    schemaVersion: 1,
  };
}

interface InternalHit {
  startNtInFrame: number;
  endNtInFrame: number;
  startCodon: string;
  lengthAa: number;
  proteinSequence: string;
  proteinDna: string;
}

function scanFrame(seq: string, frame: number, minAa: number, maxAa: number): InternalHit[] {
  const hits: InternalHit[] = [];
  let i = frame;
  while (i < seq.length - 2) {
    const codon = seq.slice(i, i + 3);
    if (!START_CODONS.has(codon)) {
      i += 3;
      continue;
    }
    // Found a start — extend until stop
    let j = i + 3;
    while (j < seq.length - 2) {
      const c = seq.slice(j, j + 3);
      if (STOP_CODONS.has(c)) break;
      j += 3;
    }
    const lengthAa = (j - i) / 3;
    if (lengthAa >= minAa && lengthAa <= maxAa) {
      const proteinDna = seq.slice(i, j);
      hits.push({
        startNtInFrame: i,
        endNtInFrame: j + 2,
        startCodon: codon,
        lengthAa,
        proteinSequence: translate(proteinDna),
        proteinDna,
      });
    }
    i = j + 3;
  }
  return hits;
}

function translate(dna: string): string {
  let out = '';
  for (let i = 0; i + 2 < dna.length; i += 3) {
    out += STANDARD_CODON_TABLE[dna.slice(i, i + 3)] ?? 'X';
  }
  return out;
}

function reverseComplement(seq: string): string {
  const map: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C', N: 'N' };
  let out = '';
  for (let i = seq.length - 1; i >= 0; i--) out += map[seq[i]!] ?? 'N';
  return out;
}

function computeCodonUsage(seq: string): Record<string, number> {
  const counts: Record<string, number> = {};
  let total = 0;
  for (let i = 0; i + 2 < seq.length; i += 3) {
    const c = seq.slice(i, i + 3);
    if (c.includes('N')) continue;
    counts[c] = (counts[c] ?? 0) + 1;
    total++;
  }
  if (total === 0) return {};
  const freqs: Record<string, number> = {};
  for (const k in counts) freqs[k] = counts[k]! / total;
  return freqs;
}

function codonBiasZ(orfDna: string, bulkUsage: Record<string, number>): number {
  const orfCounts: Record<string, number> = {};
  let orfTotal = 0;
  for (let i = 0; i + 2 < orfDna.length; i += 3) {
    const c = orfDna.slice(i, i + 3);
    if (c.includes('N')) continue;
    orfCounts[c] = (orfCounts[c] ?? 0) + 1;
    orfTotal++;
  }
  if (orfTotal < 10) return 0;

  // Compute KL-like divergence as z-score by Monte-Carlo–free analytic approximation:
  // sum over codons of (observed - expected)^2 / expected, then normalize by sqrt(2k).
  // (Chi-square→z conversion; k = # codons with non-zero expected freq.)
  let chi2 = 0;
  let dof = 0;
  for (const codon of Object.keys(STANDARD_CODON_TABLE)) {
    const exp = (bulkUsage[codon] ?? 0) * orfTotal;
    if (exp < 0.5) continue;
    const obs = orfCounts[codon] ?? 0;
    chi2 += ((obs - exp) ** 2) / exp;
    dof++;
  }
  if (dof < 2) return 0;
  return (chi2 - dof) / Math.sqrt(2 * dof);
}

function round(n: number, d: number): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
function roundMap(m: Record<string, number>, d: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(m).sort()) out[k] = round(m[k]!, d);
  return out;
}

/**
 * Canonical hash of the output for determinism verification.
 * Two contributors running the same slice must produce identical hashes.
 */
export async function hashOutput(out: SmallOrfOutput): Promise<string> {
  return canonicalHash(out);
}
