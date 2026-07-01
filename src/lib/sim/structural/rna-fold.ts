/**
 * RNA Secondary Structure Prediction — the Nussinov algorithm
 * ===========================================================
 *
 * Given a single-stranded RNA sequence, the Nussinov–Jacobson dynamic program
 * (Nussinov et al., 1978) finds the secondary structure that MAXIMISES the
 * number of base pairs. It is the simplest, most transparent RNA folder: it
 * ignores loop-length energetics and coaxial stacking and simply counts pairs,
 * yet it captures the essential combinatorics of nested (non-crossing) pairing
 * and is the pedagogical ancestor of the Zuker minimum-free-energy algorithm.
 *
 * Model
 * -----
 *   γ(i,j) = maximum number of base pairs achievable in the subsequence s[i..j].
 *
 * Recurrence (Durbin et al., "Biological Sequence Analysis", §10.3):
 *
 *   γ(i,j) = max {
 *       γ(i+1, j),                              // i unpaired
 *       γ(i, j-1),                              // j unpaired
 *       γ(i+1, j-1) + δ(i,j),                   // i pairs with j
 *       max_{i<k<j} [ γ(i,k) + γ(k+1,j) ]       // bifurcation (two substructures)
 *   }
 *
 * where δ(i,j) = 1 if s[i] and s[j] can pair AND the hairpin-loop constraint
 * j − i − 1 ≥ minLoop is satisfied, else 0.
 *
 * Allowed pairs: Watson–Crick A·U and G·C, plus the G·U wobble pair (toggleable).
 * A minimum hairpin loop of `minLoop` (default 3) unpaired bases forbids sharp
 * turns that are sterically impossible in real RNA.
 *
 * A back-trace over the filled matrix recovers one optimal structure, which is
 * rendered as a dot-bracket string ( '(' = 5' partner, ')' = 3' partner, '.' =
 * unpaired ). Because Nussinov only ever forms nested pairs, the bracket string
 * is always balanced by construction.
 *
 * We additionally report a coarse STACKING-ENERGY PROXY. Real thermodynamic
 * stability comes overwhelmingly from base-pair stacking, not from the pairs in
 * isolation, so we sum a nearest-neighbour-style term over every pair of stacked
 * base pairs ((i,j) closing directly onto (i+1,j-1)). Per-pair strengths are
 * G·C = −3, A·U = −2, G·U = −1 (kcal/mol, sign = stabilising), a deliberately
 * simplified stand-in for the Turner nearest-neighbour parameters.
 *
 * Determinism: the algorithm is a pure function of the sequence and parameters —
 * no clock, no RNG, no I/O — so a run is byte-for-byte reproducible. (There is
 * no stochastic component, hence no seed.)
 *
 * References
 *  - Nussinov R., Piecznik G., Grigg J.R., Kleitman D.J. (1978) "Algorithms for
 *    loop matchings." SIAM J. Appl. Math. 35(1):68–82.
 *  - Nussinov R. & Jacobson A.B. (1980) PNAS 77(11):6309–6313.
 *  - Durbin, Eddy, Krogh, Mitchison, "Biological Sequence Analysis" (1998), §10.
 */

import { z } from 'zod';
import type { EngineSpec, SimResult } from '../core/types';
import { provenance } from '../core/types';

const SLUG = 'rna-fold';
const VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Base-pairing rules
// ---------------------------------------------------------------------------

/** Canonical Watson–Crick complements over the RNA alphabet. */
const WATSON_CRICK: Readonly<Record<string, string>> = { A: 'U', U: 'A', G: 'C', C: 'G' };

/**
 * Can bases `a` and `b` form an allowed pair?
 *  - Watson–Crick A·U and G·C are always permitted.
 *  - G·U (wobble) is permitted only when `allowWobble` is true.
 */
export function canPair(a: string, b: string, allowWobble = true): boolean {
  if (WATSON_CRICK[a] === b) return true;
  if (allowWobble && ((a === 'G' && b === 'U') || (a === 'U' && b === 'G'))) return true;
  return false;
}

/**
 * Coarse per-pair "energy" proxy in kcal/mol (negative = stabilising):
 * G·C = −3, A·U = −2, G·U wobble = −1. This is NOT derived from hydrogen-bond
 * count — G·U wobble forms 2 H-bonds, the same as A·U, not 1 (Varani & McClain,
 * "The G·U wobble base pair", RNA 2000, 6(9):1237–1257). The ordering here is a
 * coarse empirical placeholder reflecting that G·U stacks are, on average, less
 * stabilising than A·U in real nearest-neighbour (Turner) parameters, not a
 * consequence of hydrogen bonding. Unknown/disallowed combinations contribute 0.
 */
export function pairEnergy(a: string, b: string): number {
  if ((a === 'G' && b === 'C') || (a === 'C' && b === 'G')) return -3;
  if ((a === 'A' && b === 'U') || (a === 'U' && b === 'A')) return -2;
  if ((a === 'G' && b === 'U') || (a === 'U' && b === 'G')) return -1;
  return 0;
}

// ---------------------------------------------------------------------------
// Sequence normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise raw user input to an RNA string over {A,C,G,U}: uppercase, transcribe
 * DNA (T→U), and drop any character that is not one of the four ribonucleotides
 * (whitespace, digits, ambiguity codes such as N). Indices reported downstream
 * refer to this cleaned string.
 */
export function cleanRna(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/T/g, 'U')
    .replace(/[^ACGU]/g, '');
}

// ---------------------------------------------------------------------------
// Core dynamic program
// ---------------------------------------------------------------------------

export type BasePair = [number, number];

export interface NussinovFold {
  /** The cleaned RNA sequence the fold refers to. */
  sequence: string;
  /** Dot-bracket structure, same length as `sequence`. */
  dotBracket: string;
  /** 0-based (i,j) pairs with i < j, sorted by i. */
  pairs: BasePair[];
  /** Number of base pairs — the Nussinov objective value. */
  basePairs: number;
  /** Coarse stacking-energy proxy (kcal/mol, negative = stabilising). */
  stackingEnergy: number;
  /** Number of stacked base-pair steps (helical stacks). */
  stacks: number;
}

/**
 * Fill the Nussinov maximum-base-pairing matrix.
 *
 * `dp[i][j]` is the maximum number of base pairs in the subsequence s[i..j]
 * (inclusive). Cells with j < i are unused and left 0. O(n³) time, O(n²) space.
 */
export function nussinovMatrix(seq: string, minLoop = 3, allowWobble = true): number[][] {
  const n = seq.length;
  const dp: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));

  // Fill by increasing subsequence length so every smaller span is ready.
  for (let span = 1; span < n; span++) {
    for (let i = 0; i + span < n; i++) {
      const j = i + span;

      // Option 1: i is unpaired.
      let best = dp[i + 1]?.[j]!;
      // Option 2: j is unpaired.
      if (dp[i]?.[j - 1]! > best) best = dp[i]?.[j - 1]!;
      // Option 3: i pairs with j (respecting the minimum hairpin loop).
      if (j - i - 1 >= minLoop && canPair(seq[i]!, seq[j]!, allowWobble)) {
        const paired = dp[i + 1]?.[j - 1]! + 1;
        if (paired > best) best = paired;
      }
      // Option 4: bifurcation into two adjacent optimal substructures.
      for (let k = i + 1; k < j; k++) {
        const split = dp[i]?.[k]! + dp[k + 1]?.[j]!;
        if (split > best) best = split;
      }

      dp[i]![j] = best;
    }
  }
  return dp;
}

/**
 * Recover one optimal set of base pairs from a filled Nussinov matrix by
 * back-tracing the recurrence. Ties are broken in a fixed order (i-unpaired,
 * j-unpaired, i·j pair, then bifurcation) so the result is deterministic.
 */
export function traceback(
  dp: number[][],
  seq: string,
  minLoop = 3,
  allowWobble = true,
): BasePair[] {
  const pairs: BasePair[] = [];
  // Explicit stack of [i,j] intervals to avoid recursion depth limits.
  const work: Array<[number, number]> = [[0, seq.length - 1]];

  while (work.length > 0) {
    const [i, j] = work.pop()!;
    if (i >= j) continue;

    if (dp[i]?.[j]! === dp[i + 1]?.[j]!) {
      // i unpaired.
      work.push([i + 1, j]);
    } else if (dp[i]?.[j]! === dp[i]?.[j - 1]!) {
      // j unpaired.
      work.push([i, j - 1]);
    } else if (
      j - i - 1 >= minLoop &&
      canPair(seq[i]!, seq[j]!, allowWobble) &&
      dp[i]?.[j]! === dp[i + 1]?.[j - 1]! + 1
    ) {
      // i pairs with j.
      pairs.push([i, j]);
      work.push([i + 1, j - 1]);
    } else {
      // Bifurcation: find the split point k realising the optimum.
      for (let k = i + 1; k < j; k++) {
        if (dp[i]?.[j]! === dp[i]?.[k]! + dp[k + 1]?.[j]!) {
          work.push([i, k]);
          work.push([k + 1, j]);
          break;
        }
      }
    }
  }

  pairs.sort((a, b) => a[0] - b[0]);
  return pairs;
}

/** Render a nested pair list as a dot-bracket string of length `n`. */
export function pairsToDotBracket(pairs: BasePair[], n: number): string {
  const chars = new Array<string>(n).fill('.');
  for (const [i, j] of pairs) {
    chars[i] = '(';
    chars[j] = ')';
  }
  return chars.join('');
}

/**
 * Stacking-energy proxy: sum a nearest-neighbour term over every pair of stacked
 * base pairs. A stack is a pair (i,j) that directly encloses the pair (i+1,j-1);
 * its energy is the mean of the two constituent pair energies. Returns both the
 * total energy (kcal/mol, negative = stabilising) and the number of stacks.
 */
export function stackingEnergy(pairs: BasePair[], seq: string): { energy: number; stacks: number } {
  const partner = new Map<number, number>();
  for (const [i, j] of pairs) partner.set(i, j);

  let energy = 0;
  let stacks = 0;
  for (const [i, j] of pairs) {
    if (partner.get(i + 1) === j - 1) {
      const outer = pairEnergy(seq[i]!, seq[j]!);
      const inner = pairEnergy(seq[i + 1]!, seq[j - 1]!);
      energy += (outer + inner) / 2;
      stacks++;
    }
  }
  return { energy, stacks };
}

/**
 * Full Nussinov fold of a cleaned RNA sequence: the pure scientific core,
 * independent of the EngineSpec wrapper, so it can be unit-tested directly.
 */
export function foldRNA(
  seq: string,
  opts: { minLoop?: number; allowWobble?: boolean } = {},
): NussinovFold {
  const minLoop = opts.minLoop ?? 3;
  const allowWobble = opts.allowWobble ?? true;
  const n = seq.length;

  if (n === 0) {
    return { sequence: seq, dotBracket: '', pairs: [], basePairs: 0, stackingEnergy: 0, stacks: 0 };
  }

  const dp = nussinovMatrix(seq, minLoop, allowWobble);
  const pairs = traceback(dp, seq, minLoop, allowWobble);
  const dotBracket = pairsToDotBracket(pairs, n);
  const { energy, stacks } = stackingEnergy(pairs, seq);

  return {
    sequence: seq,
    dotBracket,
    pairs,
    basePairs: pairs.length,
    stackingEnergy: energy,
    stacks,
  };
}

// ---------------------------------------------------------------------------
// EngineSpec wrapper
// ---------------------------------------------------------------------------

export const paramsSchema = z.object({
  sequence: z
    .string()
    .min(1, 'sequence must contain at least one nucleotide')
    .describe('RNA (or DNA; T is transcribed to U) sequence to fold, e.g. "GGGGAAAACCCC".'),
  minLoop: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Minimum number of unpaired bases in a hairpin loop (default 3).'),
  allowWobble: z
    .boolean()
    .optional()
    .describe('Whether to allow the non-canonical G·U wobble pair (default true).'),
});

export type RnaFoldParams = z.infer<typeof paramsSchema>;

export interface RnaFoldDetail extends NussinovFold {
  minLoop: number;
  allowWobble: boolean;
}

export function run(params: RnaFoldParams): SimResult<RnaFoldDetail> {
  const p = paramsSchema.parse(params);
  const sequence = cleanRna(p.sequence);
  if (sequence.length === 0) {
    throw new Error('rna-fold: sequence contains no valid A/C/G/U nucleotides');
  }
  const minLoop = p.minLoop ?? 3;
  const allowWobble = p.allowWobble ?? true;

  const fold = foldRNA(sequence, { minLoop, allowWobble });
  const n = sequence.length;
  const pairedFraction = (2 * fold.basePairs) / n;

  const provBlock = provenance(SLUG, VERSION, { sequence, minLoop, allowWobble });

  return {
    engine: SLUG,
    summary:
      `${fold.basePairs} base pair${fold.basePairs === 1 ? '' : 's'} over ${n} nt ` +
      `(${(pairedFraction * 100).toFixed(0)}% paired, ${fold.stacks} stack${fold.stacks === 1 ? '' : 's'}, ` +
      `ΔG≈${fold.stackingEnergy.toFixed(1)} kcal/mol): ${fold.dotBracket}`,
    metrics: [
      {
        key: 'basePairs',
        label: 'Base pairs',
        value: fold.basePairs,
        note: 'Maximum number of nested base pairs (Nussinov objective).',
      },
      { key: 'sequenceLength', label: 'Sequence length', value: n, unit: 'nt' },
      {
        key: 'pairedFraction',
        label: 'Paired fraction',
        value: pairedFraction,
        note: 'Fraction of nucleotides that are base-paired (2·pairs / length).',
      },
      {
        key: 'stackingEnergy',
        label: 'Stacking energy (proxy)',
        value: fold.stackingEnergy,
        unit: 'kcal/mol',
        note: 'Coarse nearest-neighbour stacking proxy; negative = stabilising.',
      },
    ],
    detail: { ...fold, minLoop, allowWobble },
    provenance: provBlock,
  };
}

export const spec: EngineSpec<RnaFoldParams, RnaFoldDetail> = {
  slug: SLUG,
  title: 'RNA Secondary Structure (Nussinov)',
  domain: 'structural',
  version: VERSION,
  description:
    'Predicts RNA secondary structure by the Nussinov maximum-base-pairing dynamic ' +
    'program. Allowed pairs are Watson–Crick A·U and G·C plus the optional G·U ' +
    'wobble, with a configurable minimum hairpin loop (default 3 unpaired bases). ' +
    'A back-trace yields a balanced dot-bracket structure; the engine also reports ' +
    'the base-pair count, paired fraction, and a coarse base-stacking energy proxy. ' +
    'Deterministic and O(n³); a pedagogical folder that ignores loop energetics, ' +
    'not a substitute for a full minimum-free-energy predictor.',
  references: [
    'Nussinov R. et al. (1978) SIAM J. Appl. Math. 35(1):68–82.',
    'Nussinov R. & Jacobson A.B. (1980) PNAS 77(11):6309–6313.',
    'Durbin, Eddy, Krogh, Mitchison, Biological Sequence Analysis (1998), Ch. 10.',
  ],
  paramsSchema,
  run,
  example: { sequence: 'GGGGAAAACCCC', minLoop: 3, allowWobble: true },
  tags: [
    'rna',
    'secondary-structure',
    'nussinov',
    'base-pairing',
    'dot-bracket',
    'structural',
    'dynamic-programming',
  ],
};

export default spec;
