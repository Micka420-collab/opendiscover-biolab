/**
 * Chou–Fasman protein secondary-structure prediction.
 * =====================================================
 *
 * The Chou–Fasman method (Chou & Fasman, 1974/1978) is the classic empirical
 * algorithm for predicting where α-helices, β-sheets and β-turns occur along a
 * protein chain from sequence alone. It rests on *conformational parameters* —
 * statistical propensities P(α), P(β), P(turn) derived from the frequency with
 * which each of the 20 amino acids is observed in each structure type in solved
 * crystal structures. A value > 1.0 means the residue is a "former" (favours
 * that structure); < 1.0 means a "breaker".
 *
 * The prediction is a deterministic three-phase procedure:
 *
 *   1. NUCLEATION  — scan for short seed windows rich in formers.
 *                    Helix nucleus: ≥4 of any 6 contiguous residues have P(α) > 1.
 *                    Sheet nucleus: ≥3 of any 5 contiguous residues have P(β) > 1.
 *   2. EXTENSION   — grow each nucleus outward one residue at a time while the
 *                    trailing/leading tetrapeptide keeps an average propensity
 *                    > 1.0. A maximal accepted segment must also satisfy the
 *                    classic region-average thresholds ⟨P(α)⟩ > 1.03 (helix),
 *                    ⟨P(β)⟩ > 1.05 (sheet).
 *   3. RESOLUTION  — where a stretch is claimed by BOTH helix and sheet, the
 *                    conflict is broken by the higher summed propensity over the
 *                    overlapping stretch (ΣP(α) vs ΣP(β)).
 *
 * β-turns are scored separately from the four positional bend frequencies
 * f(i), f(i+1), f(i+2), f(i+3): a turn is called at tetrapeptide i when the
 * bend product exceeds 0.75×10⁻⁴ AND ⟨P(turn)⟩ > 1 AND ⟨P(turn)⟩ exceeds both
 * ⟨P(α)⟩ and ⟨P(β)⟩ over the four residues.
 *
 * The per-residue output alphabet is H (helix) / E (extended/sheet) / C (coil).
 * β-turns are reported as an INDEPENDENT overlay annotation in `detail.turns`
 * (and flagged per-residue via `PerResidue.turn`) rather than as a 4th letter,
 * matching the requested {H,E,C} contract. Critically, the turn scan does NOT
 * modify the helix/sheet masks: a residue inside a detected β-turn tetrapeptide
 * keeps whatever H/E/C label the nucleation+extension+resolution phases already
 * gave it, so a turn can (and does) overlap a helix or sheet segment with zero
 * effect on helixFraction/sheetFraction/coilFraction. `coilFraction` reflects
 * only residues outside every accepted helix/sheet segment — it is NOT
 * incremented merely because a β-turn was detected there.
 *
 * This module is pure and deterministic — no clock, no RNG, no I/O — so a run is
 * fully reproducible from its sequence alone.
 *
 * References:
 *  - Chou PY, Fasman GD (1974) "Conformational parameters for amino acids in
 *    helical, β-sheet, and random coil regions calculated from proteins."
 *    Biochemistry 13(2):211–222.
 *  - Chou PY, Fasman GD (1978) "Prediction of the secondary structure of
 *    proteins from their amino acid sequence." Adv Enzymol 47:45–148.
 */

import { z } from 'zod';
import type { EngineSpec, SimResult } from '../core/types';
import { provenance } from '../core/types';

// ---------------------------------------------------------------------------
// Conformational parameter table
// ---------------------------------------------------------------------------

/** Chou–Fasman conformational parameters for one amino acid. */
export interface Propensity {
  /** Helix propensity P(α), expressed as the classic parameter / 100 (Ala = 1.42). */
  pAlpha: number;
  /** Sheet propensity P(β) (Val = 1.70). */
  pBeta: number;
  /** Turn propensity P(turn) (Asn = 1.56). */
  pTurn: number;
  /** Bend positional frequencies f(i), f(i+1), f(i+2), f(i+3). */
  fi: number;
  fi1: number;
  fi2: number;
  fi3: number;
}

/**
 * Full Chou–Fasman table for all 20 standard amino acids (one-letter code).
 * P(α), P(β), P(turn) are the published conformational parameters divided by
 * 100 so that the "> 1.0 = former" test is a direct numeric comparison. The
 * f(i..i+3) columns are the β-turn bend frequencies from the 1978 paper.
 */
export const CHOU_FASMAN: Record<string, Propensity> = {
  //        P(α)   P(β)   P(t)    f(i)    f(i+1)  f(i+2)  f(i+3)
  A: { pAlpha: 1.42, pBeta: 0.83, pTurn: 0.66, fi: 0.06, fi1: 0.076, fi2: 0.035, fi3: 0.058 },
  R: { pAlpha: 0.98, pBeta: 0.93, pTurn: 0.95, fi: 0.07, fi1: 0.106, fi2: 0.099, fi3: 0.085 },
  N: { pAlpha: 0.67, pBeta: 0.89, pTurn: 1.56, fi: 0.161, fi1: 0.083, fi2: 0.191, fi3: 0.091 },
  D: { pAlpha: 1.01, pBeta: 0.54, pTurn: 1.46, fi: 0.147, fi1: 0.11, fi2: 0.179, fi3: 0.081 },
  C: { pAlpha: 0.7, pBeta: 1.19, pTurn: 1.19, fi: 0.149, fi1: 0.05, fi2: 0.117, fi3: 0.128 },
  Q: { pAlpha: 1.11, pBeta: 1.1, pTurn: 0.98, fi: 0.074, fi1: 0.098, fi2: 0.037, fi3: 0.098 },
  E: { pAlpha: 1.51, pBeta: 0.37, pTurn: 0.74, fi: 0.056, fi1: 0.06, fi2: 0.077, fi3: 0.064 },
  G: { pAlpha: 0.57, pBeta: 0.75, pTurn: 1.56, fi: 0.102, fi1: 0.085, fi2: 0.19, fi3: 0.152 },
  H: { pAlpha: 1.0, pBeta: 0.87, pTurn: 0.95, fi: 0.14, fi1: 0.047, fi2: 0.093, fi3: 0.054 },
  I: { pAlpha: 1.08, pBeta: 1.6, pTurn: 0.47, fi: 0.043, fi1: 0.034, fi2: 0.013, fi3: 0.056 },
  L: { pAlpha: 1.21, pBeta: 1.3, pTurn: 0.59, fi: 0.061, fi1: 0.025, fi2: 0.036, fi3: 0.07 },
  K: { pAlpha: 1.14, pBeta: 0.74, pTurn: 1.01, fi: 0.055, fi1: 0.115, fi2: 0.072, fi3: 0.095 },
  M: { pAlpha: 1.45, pBeta: 1.05, pTurn: 0.6, fi: 0.068, fi1: 0.082, fi2: 0.014, fi3: 0.055 },
  F: { pAlpha: 1.13, pBeta: 1.38, pTurn: 0.6, fi: 0.059, fi1: 0.041, fi2: 0.065, fi3: 0.065 },
  P: { pAlpha: 0.57, pBeta: 0.55, pTurn: 1.52, fi: 0.102, fi1: 0.301, fi2: 0.034, fi3: 0.068 },
  S: { pAlpha: 0.77, pBeta: 0.75, pTurn: 1.43, fi: 0.12, fi1: 0.139, fi2: 0.125, fi3: 0.106 },
  T: { pAlpha: 0.83, pBeta: 1.19, pTurn: 0.96, fi: 0.086, fi1: 0.108, fi2: 0.065, fi3: 0.079 },
  W: { pAlpha: 1.08, pBeta: 1.37, pTurn: 0.96, fi: 0.077, fi1: 0.013, fi2: 0.064, fi3: 0.167 },
  Y: { pAlpha: 0.69, pBeta: 1.47, pTurn: 1.14, fi: 0.082, fi1: 0.065, fi2: 0.114, fi3: 0.125 },
  V: { pAlpha: 1.06, pBeta: 1.7, pTurn: 0.5, fi: 0.062, fi1: 0.048, fi2: 0.028, fi3: 0.053 },
};

/**
 * Neutral propensity used for any unknown / non-standard residue (e.g. X, B, Z).
 * All propensities = 1.0 means such a residue is neither a former nor a breaker:
 * it can never *nucleate* a structure (nucleation needs a strict `> 1.0`) but it
 * will not gratuitously break an ongoing extension either. The tiny bend
 * frequencies keep it out of predicted turns.
 */
const NEUTRAL: Propensity = {
  pAlpha: 1.0,
  pBeta: 1.0,
  pTurn: 1.0,
  fi: 0.05,
  fi1: 0.05,
  fi2: 0.05,
  fi3: 0.05,
};

/** Look up the propensity for a one-letter residue, falling back to neutral. */
export function getPropensity(aa: string): Propensity {
  return CHOU_FASMAN[aa] ?? NEUTRAL;
}

// Region-average acceptance thresholds (classic Chou–Fasman values).
const HELIX_ACCEPT = 1.03;
const SHEET_ACCEPT = 1.05;
// β-turn bend-product cutoff: 0.75 × 10⁻⁴.
const TURN_PRODUCT_CUTOFF = 7.5e-5;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Assignment = 'H' | 'E' | 'C';

export interface PerResidue {
  /** 0-based position in the (normalised) sequence. */
  index: number;
  /** One-letter residue code. */
  residue: string;
  /** Predicted secondary structure at this residue. */
  assignment: Assignment;
  pAlpha: number;
  pBeta: number;
  pTurn: number;
  /**
   * True if this residue participates in a predicted β-turn tetrapeptide.
   * Independent of `assignment` — a turn residue may be labelled H, E, or C.
   */
  turn: boolean;
}

export interface StructureSegment {
  type: 'helix' | 'sheet' | 'coil';
  /** Inclusive 0-based start index. */
  start: number;
  /** Inclusive 0-based end index. */
  end: number;
  length: number;
}

export interface BetaTurn {
  /** 0-based index of the first residue of the turn tetrapeptide. */
  start: number;
  /** The four residues forming the turn. */
  residues: string;
  /** Bend product p(t) = f(i)·f(i+1)·f(i+2)·f(i+3). */
  probability: number;
}

export interface SecondaryStructurePrediction {
  sequence: string;
  /** Per-residue H/E/C string, same length as `sequence`. */
  assignmentString: string;
  perResidue: PerResidue[];
  segments: StructureSegment[];
  turns: BetaTurn[];
  helixFraction: number;
  sheetFraction: number;
  coilFraction: number;
}

export interface SecondaryStructureDetail extends SecondaryStructurePrediction {}

// ---------------------------------------------------------------------------
// Core scientific routines
// ---------------------------------------------------------------------------

/** Average of four consecutive array entries starting at `a` (a tetrapeptide). */
function avg4(arr: number[], a: number): number {
  return (arr[a]! + arr[a + 1]! + arr[a + 2]! + arr[a + 3]!) / 4;
}

/**
 * Locate α-helix regions by nucleation + extension.
 *
 * Nucleus: any 6-residue window containing ≥4 helix formers (P(α) > 1).
 * Extension: grow the nucleus left/right while the adjacent tetrapeptide keeps
 * an average P(α) > 1.0. Returns a boolean mask over the sequence.
 */
export function findHelix(pAlpha: number[]): boolean[] {
  const n = pAlpha.length;
  const mask = new Array<boolean>(n).fill(false);
  for (let i = 0; i + 6 <= n; i++) {
    let formers = 0;
    for (let j = i; j < i + 6; j++) if (pAlpha[j]! > 1.0) formers++;
    if (formers < 4) continue;

    let start = i;
    let end = i + 5;
    // Extend to the right: consider the tetrapeptide ending at end+1.
    while (end + 1 < n && avg4(pAlpha, end - 2) > 1.0) end++;
    // Extend to the left: consider the tetrapeptide beginning at start-1.
    while (start - 1 >= 0 && avg4(pAlpha, start - 1) > 1.0) start--;

    for (let j = start; j <= end; j++) mask[j] = true;
  }
  return mask;
}

/**
 * Locate β-sheet regions by nucleation + extension, analogous to `findHelix`.
 *
 * Nucleus: any 5-residue window containing ≥3 sheet formers (P(β) > 1).
 * Extension: grow while the adjacent tetrapeptide keeps average P(β) > 1.0.
 */
export function findSheet(pBeta: number[]): boolean[] {
  const n = pBeta.length;
  const mask = new Array<boolean>(n).fill(false);
  for (let i = 0; i + 5 <= n; i++) {
    let formers = 0;
    for (let j = i; j < i + 5; j++) if (pBeta[j]! > 1.0) formers++;
    if (formers < 3) continue;

    let start = i;
    let end = i + 4;
    while (end + 1 < n && avg4(pBeta, end - 2) > 1.0) end++;
    while (start - 1 >= 0 && avg4(pBeta, start - 1) > 1.0) start--;

    for (let j = start; j <= end; j++) mask[j] = true;
  }
  return mask;
}

/**
 * Discard maximal runs whose region-average propensity falls below `threshold`.
 * This is the Chou–Fasman acceptance filter applied to each candidate segment
 * after extension (helix ⟨P(α)⟩ > 1.03, sheet ⟨P(β)⟩ > 1.05). Mutates `mask`.
 */
function filterRunsByAverage(mask: boolean[], p: number[], threshold: number): void {
  const n = mask.length;
  let i = 0;
  while (i < n) {
    if (!mask[i]) {
      i++;
      continue;
    }
    let j = i;
    let sum = 0;
    while (j < n && mask[j]) {
      sum += p[j]!;
      j++;
    }
    if (sum / (j - i) < threshold) for (let k = i; k < j; k++) mask[k] = false;
    i = j;
  }
}

/**
 * Resolve helix/sheet overlaps. For every maximal stretch claimed by BOTH
 * masks, keep whichever has the larger summed propensity over that stretch and
 * clear the other. Mutates both masks so no residue ends up doubly assigned.
 */
export function resolveOverlaps(
  helix: boolean[],
  sheet: boolean[],
  pAlpha: number[],
  pBeta: number[],
): void {
  const n = helix.length;
  let i = 0;
  while (i < n) {
    if (!(helix[i] && sheet[i])) {
      i++;
      continue;
    }
    let j = i;
    let sa = 0;
    let sb = 0;
    while (j < n && helix[j] && sheet[j]) {
      sa += pAlpha[j]!;
      sb += pBeta[j]!;
      j++;
    }
    if (sa >= sb) {
      for (let k = i; k < j; k++) sheet[k] = false;
    } else {
      for (let k = i; k < j; k++) helix[k] = false;
    }
    i = j;
  }
}

/**
 * Bend product p(t) = f(i)·f(i+1)·f(i+2)·f(i+3) for a 4-residue tetrapeptide.
 * A value above ~7.5×10⁻⁵ is the Chou–Fasman signal for a probable β-turn.
 */
export function betaTurnProbability(tetrapeptide: string): number {
  if (tetrapeptide.length < 4) return 0;
  const p0 = getPropensity(tetrapeptide[0]!);
  const p1 = getPropensity(tetrapeptide[1]!);
  const p2 = getPropensity(tetrapeptide[2]!);
  const p3 = getPropensity(tetrapeptide[3]!);
  return p0.fi * p1.fi1 * p2.fi2 * p3.fi3;
}

/**
 * Scan for β-turns. A turn is called at tetrapeptide i when:
 *   - bend product p(t) > 7.5×10⁻⁵,
 *   - ⟨P(turn)⟩ over the four residues > 1.0, and
 *   - ⟨P(turn)⟩ exceeds both ⟨P(α)⟩ and ⟨P(β)⟩ (turn conformation dominates).
 */
export function findBetaTurns(sequence: string): BetaTurn[] {
  const turns: BetaTurn[] = [];
  const n = sequence.length;
  for (let i = 0; i + 4 <= n; i++) {
    const r0 = getPropensity(sequence[i]!);
    const r1 = getPropensity(sequence[i + 1]!);
    const r2 = getPropensity(sequence[i + 2]!);
    const r3 = getPropensity(sequence[i + 3]!);
    const product = r0.fi * r1.fi1 * r2.fi2 * r3.fi3;
    const avgTurn = (r0.pTurn + r1.pTurn + r2.pTurn + r3.pTurn) / 4;
    const avgAlpha = (r0.pAlpha + r1.pAlpha + r2.pAlpha + r3.pAlpha) / 4;
    const avgBeta = (r0.pBeta + r1.pBeta + r2.pBeta + r3.pBeta) / 4;
    if (product > TURN_PRODUCT_CUTOFF && avgTurn > 1.0 && avgTurn > avgAlpha && avgTurn > avgBeta) {
      turns.push({ start: i, residues: sequence.slice(i, i + 4), probability: product });
    }
  }
  return turns;
}

/** Collapse a per-residue assignment array into contiguous typed segments. */
function buildSegments(assignment: Assignment[]): StructureSegment[] {
  const segs: StructureSegment[] = [];
  const n = assignment.length;
  if (n === 0) return segs;
  let start = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || assignment[i] !== assignment[start]) {
      const a = assignment[start]!;
      segs.push({
        type: a === 'H' ? 'helix' : a === 'E' ? 'sheet' : 'coil',
        start,
        end: i - 1,
        length: i - start,
      });
      start = i;
    }
  }
  return segs;
}

/**
 * Full Chou–Fasman prediction for a normalised (uppercase, letters-only)
 * sequence. This is the pure scientific core, independent of the EngineSpec
 * wrapper, so it can be unit-tested directly against textbook expectations.
 */
export function predictSecondaryStructure(sequence: string): SecondaryStructurePrediction {
  const n = sequence.length;
  if (n === 0) {
    return {
      sequence,
      assignmentString: '',
      perResidue: [],
      segments: [],
      turns: [],
      helixFraction: 0,
      sheetFraction: 0,
      coilFraction: 0,
    };
  }

  const pAlpha = new Array<number>(n);
  const pBeta = new Array<number>(n);
  const pTurn = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const p = getPropensity(sequence[i]!);
    pAlpha[i] = p.pAlpha;
    pBeta[i] = p.pBeta;
    pTurn[i] = p.pTurn;
  }

  // Phase 1+2: independent helix and sheet nucleation/extension.
  const helix = findHelix(pAlpha);
  const sheet = findSheet(pBeta);
  // Region-average acceptance.
  filterRunsByAverage(helix, pAlpha, HELIX_ACCEPT);
  filterRunsByAverage(sheet, pBeta, SHEET_ACCEPT);
  // Phase 3: break helix/sheet ties by higher summed propensity.
  resolveOverlaps(helix, sheet, pAlpha, pBeta);

  // β-turn overlay.
  const turns = findBetaTurns(sequence);
  const turnMask = new Array<boolean>(n).fill(false);
  for (const t of turns) for (let k = t.start; k < t.start + 4; k++) turnMask[k] = true;

  const assignment: Assignment[] = new Array(n);
  let helixCount = 0;
  let sheetCount = 0;
  for (let i = 0; i < n; i++) {
    if (helix[i]) {
      assignment[i] = 'H';
      helixCount++;
    } else if (sheet[i]) {
      assignment[i] = 'E';
      sheetCount++;
    } else {
      assignment[i] = 'C';
    }
  }

  const perResidue: PerResidue[] = new Array(n);
  for (let i = 0; i < n; i++) {
    perResidue[i] = {
      index: i,
      residue: sequence[i]!,
      assignment: assignment[i]!,
      pAlpha: pAlpha[i]!,
      pBeta: pBeta[i]!,
      pTurn: pTurn[i]!,
      turn: turnMask[i]!,
    };
  }

  return {
    sequence,
    assignmentString: assignment.join(''),
    perResidue,
    segments: buildSegments(assignment),
    turns,
    helixFraction: helixCount / n,
    sheetFraction: sheetCount / n,
    coilFraction: (n - helixCount - sheetCount) / n,
  };
}

// ---------------------------------------------------------------------------
// EngineSpec wrapper
// ---------------------------------------------------------------------------

export const paramsSchema = z.object({
  /** Protein sequence in one-letter code. Whitespace/non-letters are stripped. */
  sequence: z
    .string()
    .min(1, 'sequence must contain at least one residue')
    .describe('Protein sequence in one-letter amino-acid code (e.g. "MKTAYIAKQR").'),
});

export type SecondaryStructureParams = z.infer<typeof paramsSchema>;

/** Normalise raw user input to an uppercase, letters-only sequence. */
function normaliseSequence(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '');
}

export function run(params: SecondaryStructureParams): SimResult<SecondaryStructureDetail> {
  const sequence = normaliseSequence(params.sequence);
  if (sequence.length === 0) {
    throw new Error('secondary-structure: sequence contains no valid amino-acid letters');
  }

  const prediction = predictSecondaryStructure(sequence);
  const { helixFraction, sheetFraction, coilFraction, turns } = prediction;
  const n = sequence.length;
  const pct = (x: number) => (x * 100).toFixed(0);

  // Per-residue propensity series, handy for plotting the "conformational
  // landscape" alongside the assignment track.
  const x = Array.from({ length: n }, (_, i) => i + 1);
  const series = [
    {
      x,
      y: {
        pAlpha: prediction.perResidue.map((r) => r.pAlpha),
        pBeta: prediction.perResidue.map((r) => r.pBeta),
        pTurn: prediction.perResidue.map((r) => r.pTurn),
      },
      xLabel: 'Residue position',
      yLabel: 'Conformational parameter',
    },
  ];

  return {
    engine: spec.slug,
    summary: `${pct(helixFraction)}% helix, ${pct(sheetFraction)}% sheet, ${pct(coilFraction)}% coil over ${n} residues (${turns.length} β-turn${turns.length === 1 ? '' : 's'})`,
    metrics: [
      {
        key: 'helixFraction',
        label: 'Helix fraction',
        value: helixFraction,
        note: 'Fraction of residues predicted α-helix (H).',
      },
      {
        key: 'sheetFraction',
        label: 'Sheet fraction',
        value: sheetFraction,
        note: 'Fraction of residues predicted β-sheet (E).',
      },
      {
        key: 'coilFraction',
        label: 'Coil fraction',
        value: coilFraction,
        note: 'Fraction of residues predicted coil (C).',
      },
      { key: 'length', label: 'Residues', value: n, unit: 'aa' },
      {
        key: 'turnCount',
        label: 'β-turns',
        value: turns.length,
        note: 'Number of predicted β-turn tetrapeptides.',
      },
    ],
    series,
    detail: prediction,
    provenance: provenance(spec.slug, spec.version, { sequence }),
  };
}

export const spec: EngineSpec<SecondaryStructureParams, SecondaryStructureDetail> = {
  slug: 'secondary-structure',
  title: 'Chou-Fasman Secondary Structure',
  domain: 'protein',
  version: '1.0.0',
  description:
    'Predicts protein secondary structure from sequence using the classic Chou–Fasman method: ' +
    'residue-level P(α)/P(β)/P(turn) conformational parameters drive helix and sheet ' +
    'nucleation + extension, overlaps are resolved by the higher summed propensity, and ' +
    'β-turns are scored from positional bend frequencies. Returns per-residue H/E/C ' +
    'assignments plus helix/sheet/coil fractions. Deterministic and reference-based; ' +
    'a first-order structural sketch, not a substitute for modern ML predictors.',
  references: [
    'Chou PY, Fasman GD (1974) Biochemistry 13(2):211–222.',
    'Chou PY, Fasman GD (1978) Adv Enzymol Relat Areas Mol Biol 47:45–148.',
  ],
  paramsSchema,
  run,
  example: { sequence: 'AAAAAAAAANPGKVVVVVVVVV' },
  tags: [
    'protein',
    'secondary-structure',
    'chou-fasman',
    'helix',
    'sheet',
    'beta-turn',
    'sequence',
  ],
};

export default spec;
