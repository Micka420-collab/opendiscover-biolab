/**
 * Protocol: AlphaFold pLDDT Disorder Region Mining.
 *
 * Scientific rationale
 * --------------------
 * AlphaFold2 assigns each residue a per-residue confidence score (pLDDT, 0–100).
 * Low pLDDT (< 50) is a validated proxy for structural disorder: the model
 * cannot confidently place a residue because it lacks a single stable
 * conformation in solution. Intrinsically disordered regions (IDRs) are
 * functionally important — they participate in regulatory interactions,
 * phase separation, and post-translational modification hubs that are often
 * missed by traditional structure-based annotation.
 *
 * Algorithm: identify consecutive low-pLDDT residues, merge gaps of ≤ 2
 * ordered residues (short "islands" of order inside a disordered stretch are
 * noise), compute a novelty-conservation score that rewards proteins where
 * disordered stretches are long and globally abundant.
 */

import { canonicalHash } from '@/lib/util/hash';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ResidueScore {
  position: number;
  residue: string;
  plddt: number;
}

export interface DisorderRegion {
  start: number;
  end: number;
  length: number;
  meanPlddt: number;
}

export interface AlphaFoldDisorderInput {
  uniprotAccession: string;
  /** Per-residue pLDDT scores from AlphaFold JSON (0–100) */
  plddt: number[];
  /** One-letter amino acid sequence */
  sequence: string;
  sliceKey: string;
}

export interface AlphaFoldDisorderOutput {
  uniprotAccession: string;
  totalResidues: number;
  /** Count of residues where pLDDT < 50 */
  disorderedResidues: number;
  /** disorderedResidues / totalResidues */
  disorderFraction: number;
  disorderRegions: DisorderRegion[];
  longestDisorderRegion: number;
  /**
   * Novelty score: longer disordered stretches in highly disordered proteins
   * score higher. Formula: min(1, longestStretch / 50) × disorderFraction.
   */
  noveltyConservationScore: number;
  schemaVersion: 1;
}

// ── Validation ─────────────────────────────────────────────────────────────

const UNIPROT_ACCESSION_RE = /^[A-Z][0-9][A-Z0-9]{3}[0-9]$/i;

function validateInput(input: AlphaFoldDisorderInput): void {
  if (!UNIPROT_ACCESSION_RE.test(input.uniprotAccession)) {
    throw new Error(
      `Invalid UniProt accession: "${input.uniprotAccession}". Expected format: [A-Z][0-9][A-Z0-9]{3}[0-9]`,
    );
  }
  if (input.plddt.length !== input.sequence.length) {
    throw new Error(
      `pLDDT array length (${input.plddt.length}) does not match sequence length (${input.sequence.length})`,
    );
  }
}

// ── Core algorithm ─────────────────────────────────────────────────────────

const DISORDER_THRESHOLD = 50;
const MAX_GAP_TO_MERGE = 2;

/**
 * Group disordered residue indices into contiguous regions, merging gaps of
 * ≤ MAX_GAP_TO_MERGE ordered residues so short islands of order do not split
 * what is biologically a single disordered stretch.
 */
function buildDisorderRegions(plddt: number[], sequence: string): DisorderRegion[] {
  const n = plddt.length;
  if (n === 0) return [];

  // Step 1: mark each residue as disordered (true) or not
  const disordered: boolean[] = plddt.map((v) => v < DISORDER_THRESHOLD);

  // Step 2: merge gaps ≤ MAX_GAP_TO_MERGE inside a disordered stretch
  const merged = [...disordered];
  for (let i = 1; i < n - 1; i++) {
    if (merged[i]) continue; // already disordered
    // look ahead to find the next disordered position
    let gapEnd = i;
    while (gapEnd < n && !merged[gapEnd]) gapEnd++;
    const gapLen = gapEnd - i;
    // if a disordered region exists on both sides and the gap is small enough, fill it
    const leftDisordered = i > 0 && merged[i - 1];
    const rightDisordered = gapEnd < n && merged[gapEnd];
    if (leftDisordered && rightDisordered && gapLen <= MAX_GAP_TO_MERGE) {
      for (let k = i; k < gapEnd; k++) merged[k] = true;
      i = gapEnd - 1; // resume from where we closed the gap
    }
  }

  // Step 3: extract contiguous runs from the merged mask
  const regions: DisorderRegion[] = [];
  let regionStart = -1;

  for (let i = 0; i <= n; i++) {
    const isDisordered = i < n && merged[i];
    if (isDisordered && regionStart === -1) {
      regionStart = i;
    } else if (!isDisordered && regionStart !== -1) {
      const regionEnd = i - 1; // inclusive
      const regionPlddt = plddt.slice(regionStart, regionEnd + 1);
      const meanPlddt =
        regionPlddt.reduce((sum, v) => sum + v, 0) / regionPlddt.length;
      regions.push({
        start: regionStart,
        end: regionEnd,
        length: regionEnd - regionStart + 1,
        meanPlddt: Math.round(meanPlddt * 1000) / 1000,
      });
      regionStart = -1;
    }
  }

  return regions;
}

// ── Public runner ──────────────────────────────────────────────────────────

export function runAlphaFoldDisorder(
  input: AlphaFoldDisorderInput,
): AlphaFoldDisorderOutput {
  validateInput(input);

  const { uniprotAccession, plddt, sequence } = input;
  const totalResidues = sequence.length;

  const disorderedResidues = plddt.filter((v) => v < DISORDER_THRESHOLD).length;
  const disorderFraction =
    totalResidues > 0 ? disorderedResidues / totalResidues : 0;

  const disorderRegions = buildDisorderRegions(plddt, sequence);

  const longestDisorderRegion =
    disorderRegions.length > 0
      ? Math.max(...disorderRegions.map((r) => r.length))
      : 0;

  // noveltyConservationScore = min(1, longestStretch / 50) × disorderFraction
  const noveltyConservationScore =
    Math.min(1, longestDisorderRegion / 50) * disorderFraction;

  return {
    uniprotAccession,
    totalResidues,
    disorderedResidues,
    disorderFraction: Math.round(disorderFraction * 1e6) / 1e6,
    disorderRegions,
    longestDisorderRegion,
    noveltyConservationScore: Math.round(noveltyConservationScore * 1000) / 1000,
    schemaVersion: 1,
  };
}

export async function hashAlphaFoldOutput(
  output: AlphaFoldDisorderOutput,
): Promise<string> {
  return canonicalHash(output);
}
