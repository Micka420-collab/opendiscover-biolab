/**
 * Pairwise sequence alignment — Needleman–Wunsch (global) and Smith–Waterman
 * (local), the two foundational dynamic-programming algorithms of bioinformatics.
 *
 *   - **Global** (Needleman–Wunsch, 1970): aligns two sequences end to end,
 *     optimal over the whole length. Used to compare sequences of similar length.
 *   - **Local** (Smith–Waterman, 1981): finds the highest-scoring *substring*
 *     alignment (matrix floored at 0, traceback from the max cell). Used to find
 *     conserved domains/motifs inside otherwise divergent sequences.
 *
 * Linear gap penalty, a simple match/mismatch scoring scheme (works for DNA, RNA,
 * or protein one-letter strings). Pure and deterministic — no randomness.
 *
 * References:
 *   - Needleman SB, Wunsch CD (1970). J. Mol. Biol. 48:443.
 *   - Smith TF, Waterman MS (1981). J. Mol. Biol. 147:195.
 */

import { z } from 'zod';
import { provenance } from '../core/types';
import type { EngineSpec, SimResult } from '../core/types';

export const alignmentParams = z
  .object({
    /** First sequence (DNA / RNA / protein one-letter string). */
    seqA: z.string().min(1).max(2000),
    /** Second sequence. */
    seqB: z.string().min(1).max(2000),
    /** Global (end-to-end) or local (best substring) alignment. */
    mode: z.enum(['global', 'local']).default('global'),
    /** Score added for a matching column. */
    match: z.number().default(2),
    /** Score added for a mismatching column. */
    mismatch: z.number().default(-1),
    /** Linear gap penalty (negative). */
    gap: z.number().default(-2),
    /** Fold case before comparing. */
    ignoreCase: z.boolean().default(true),
  })
  .refine((p) => p.gap <= 0, {
    message: 'gap must be a penalty: gap <= 0',
    path: ['gap'],
  })
  .refine((p) => p.mismatch <= p.match, {
    message: 'mismatch must not score better than a match: mismatch <= match',
    path: ['mismatch'],
  });

export type AlignmentParams = z.input<typeof alignmentParams>;

export interface AlignmentDetail {
  mode: 'global' | 'local';
  alignedA: string;
  alignedB: string;
  matchLine: string;
  score: number;
  aStart: number;
  aEnd: number;
  bStart: number;
  bEnd: number;
}

export interface AlignmentResult {
  alignedA: string;
  alignedB: string;
  score: number;
  aStart: number;
  aEnd: number;
  bStart: number;
  bEnd: number;
}

const GAP = '-';

interface Scoring {
  match: number;
  mismatch: number;
  gap: number;
}

const s = (x: string, y: string, sc: Scoring) => (x === y ? sc.match : sc.mismatch);

/** Needleman–Wunsch global alignment. */
export function needlemanWunsch(a: string, b: string, sc: Scoring): AlignmentResult {
  const n = a.length;
  const m = b.length;
  const F: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) F[i][0] = i * sc.gap;
  for (let j = 1; j <= m; j++) F[0][j] = j * sc.gap;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = F[i - 1][j - 1] + s(a[i - 1], b[j - 1], sc);
      const up = F[i - 1][j] + sc.gap;
      const left = F[i][j - 1] + sc.gap;
      F[i][j] = Math.max(diag, up, left);
    }
  }

  let i = n;
  let j = m;
  let alignedA = '';
  let alignedB = '';
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && F[i][j] === F[i - 1][j - 1] + s(a[i - 1], b[j - 1], sc)) {
      alignedA = a[i - 1] + alignedA;
      alignedB = b[j - 1] + alignedB;
      i--;
      j--;
    } else if (i > 0 && F[i][j] === F[i - 1][j] + sc.gap) {
      alignedA = a[i - 1] + alignedA;
      alignedB = GAP + alignedB;
      i--;
    } else {
      alignedA = GAP + alignedA;
      alignedB = b[j - 1] + alignedB;
      j--;
    }
  }
  return { alignedA, alignedB, score: F[n][m], aStart: 0, aEnd: n, bStart: 0, bEnd: m };
}

/** Smith–Waterman local alignment. */
export function smithWaterman(a: string, b: string, sc: Scoring): AlignmentResult {
  const n = a.length;
  const m = b.length;
  const H: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  let best = 0;
  let bi = 0;
  let bj = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const diag = H[i - 1][j - 1] + s(a[i - 1], b[j - 1], sc);
      const up = H[i - 1][j] + sc.gap;
      const left = H[i][j - 1] + sc.gap;
      const v = Math.max(0, diag, up, left);
      H[i][j] = v;
      if (v > best) {
        best = v;
        bi = i;
        bj = j;
      }
    }
  }

  let i = bi;
  let j = bj;
  let alignedA = '';
  let alignedB = '';
  while (i > 0 && j > 0 && H[i][j] > 0) {
    if (H[i][j] === H[i - 1][j - 1] + s(a[i - 1], b[j - 1], sc)) {
      alignedA = a[i - 1] + alignedA;
      alignedB = b[j - 1] + alignedB;
      i--;
      j--;
    } else if (H[i][j] === H[i - 1][j] + sc.gap) {
      alignedA = a[i - 1] + alignedA;
      alignedB = GAP + alignedB;
      i--;
    } else {
      alignedA = GAP + alignedA;
      alignedB = b[j - 1] + alignedB;
      j--;
    }
  }
  return { alignedA, alignedB, score: best, aStart: i, aEnd: bi, bStart: j, bEnd: bj };
}

function matchLine(alignedA: string, alignedB: string): string {
  let line = '';
  for (let k = 0; k < alignedA.length; k++) {
    const x = alignedA[k];
    const y = alignedB[k];
    line += x === GAP || y === GAP ? ' ' : x === y ? '|' : '.';
  }
  return line;
}

function run(rawParams: AlignmentParams): SimResult<AlignmentDetail> {
  const p = alignmentParams.parse(rawParams);
  const a = p.ignoreCase ? p.seqA.toUpperCase() : p.seqA;
  const b = p.ignoreCase ? p.seqB.toUpperCase() : p.seqB;
  const sc: Scoring = { match: p.match, mismatch: p.mismatch, gap: p.gap };

  const aln = p.mode === 'global' ? needlemanWunsch(a, b, sc) : smithWaterman(a, b, sc);
  const line = matchLine(aln.alignedA, aln.alignedB);

  const columns = aln.alignedA.length;
  let matches = 0;
  let gaps = 0;
  for (let k = 0; k < columns; k++) {
    if (aln.alignedA[k] === GAP || aln.alignedB[k] === GAP) gaps++;
    else if (aln.alignedA[k] === aln.alignedB[k]) matches++;
  }
  const identity = columns > 0 ? matches / columns : 0;

  return {
    engine: 'alignment',
    summary: `${p.mode === 'global' ? 'Global (Needleman–Wunsch)' : 'Local (Smith–Waterman)'} alignment: score ${aln.score}, ${(identity * 100).toFixed(1)}% identity over ${columns} columns (${matches} matches, ${gaps} gaps).`,
    metrics: [
      { key: 'score', label: 'Alignment score', value: aln.score },
      { key: 'identity', label: 'Identity', value: identity, note: 'matches / aligned columns' },
      { key: 'alignmentLength', label: 'Aligned columns', value: columns },
      { key: 'matches', label: 'Matches', value: matches },
      { key: 'gaps', label: 'Gap columns', value: gaps },
    ],
    detail: {
      mode: p.mode,
      alignedA: aln.alignedA,
      alignedB: aln.alignedB,
      matchLine: line,
      score: aln.score,
      aStart: aln.aStart,
      aEnd: aln.aEnd,
      bStart: aln.bStart,
      bEnd: aln.bEnd,
    },
    provenance: provenance('alignment', '1.0.0', p),
  };
}

export const spec: EngineSpec<AlignmentParams, AlignmentDetail> = {
  slug: 'alignment',
  title: 'Pairwise Sequence Alignment',
  domain: 'molecular-biology',
  version: '1.0.0',
  description:
    'Optimal pairwise alignment of two DNA / RNA / protein sequences by dynamic programming: ' +
    'Needleman–Wunsch (global, end-to-end) or Smith–Waterman (local, best-scoring substring). ' +
    'Linear gap penalty with a configurable match/mismatch scheme; reports the aligned strings, ' +
    'score, percent identity, matches and gaps.',
  references: [
    'Needleman SB, Wunsch CD (1970). J. Mol. Biol. 48:443 — global alignment.',
    'Smith TF, Waterman MS (1981). J. Mol. Biol. 147:195 — local alignment.',
  ],
  tags: ['alignment', 'needleman-wunsch', 'smith-waterman', 'dynamic-programming', 'homology'],
  paramsSchema: alignmentParams,
  example: {
    seqA: 'GATTACAGTC',
    seqB: 'GCATGCAGTC',
    mode: 'global',
    match: 2,
    mismatch: -1,
    gap: -2,
  },
  run,
};
