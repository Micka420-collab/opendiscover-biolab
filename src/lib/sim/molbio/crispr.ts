/**
 * CRISPR Guide Design & Off-target — SpCas9 / Cas12a (Cpf1).
 * =========================================================
 *
 * A small, fully deterministic guide-RNA design engine. Given a target DNA
 * sequence it (1) locates protospacer-adjacent motifs (PAMs) on both strands,
 * (2) extracts the 20-nt protospacer next to each PAM, (3) scores predicted
 * on-target activity with a transparent position-weighted heuristic, and
 * (4) scores genome-wide specificity by enumerating near-matches and combining
 * them with a CFD-like (Cutting-Frequency-Determination-like) mismatch penalty.
 *
 * PAM biology encoded here
 * ------------------------
 *   SpCas9  : 5'-NGG-3' immediately 3' of a 20-nt protospacer
 *             ( [20-nt protospacer][N G G] ).
 *   Cas12a  : 5'-TTTV-3' (V = A/C/G) immediately 5' of the protospacer
 *             ( [T T T V][20-nt protospacer] ).
 * Both strands are searched. Reverse-strand sites are found by scanning the
 * reverse complement with the identical forward-strand rule and mapping the
 * coordinates back, which keeps the reported coordinate system perfectly
 * consistent with `offTargetSearch` (see the coordinate note below).
 *
 * Coordinate convention
 * ---------------------
 *   Every guide/site `position` is the 0-based START INDEX of its 20-nt
 *   protospacer window in FORWARD-strand coordinates of the searched sequence.
 *   `strand:'+'`  → protospacer == sequence.slice(pos, pos+20)
 *   `strand:'-'`  → protospacer == revComp(sequence.slice(pos, pos+20))
 *   The protospacer string is always written 5'->3' with its PAM-proximal
 *   ("seed") base last, on the strand the guide binds.
 *
 * Scoring models (documented heuristics, not fitted regressions)
 * -------------------------------------------------------------
 *   onTargetScore : logistic of an additive model with a GC-content optimum
 *     (activity falls off for very GC-poor or GC-rich spacers), a PAM-proximal
 *     nucleotide preference, and a poly-T (U6 Pol-III terminator) penalty —
 *     the dominant, reproducible trends reported by Doench et al. 2014 and
 *     Wang et al. 2014. Normalised to (0,1).
 *   cfdScore      : product over mismatched positions of a per-position factor
 *     in (0,1]. Mismatches at the PAM-proximal seed are strongly penalising;
 *     PAM-distal mismatches are largely tolerated — the qualitative behaviour
 *     of the CFD matrix of Doench et al. 2016. A perfect match scores 1.0.
 *   specificity   : MIT/Hsu-style aggregate  1 / (1 + Σ CFD_offtarget),
 *     i.e. 1.0 for a truly unique guide and decreasing as off-targets accrue.
 *
 * The engine is pure and deterministic: no Date, no Math.random, no I/O. A
 * `seed` parameter is accepted only for provenance/uniformity with the lab's
 * stochastic engines — the computation itself never consumes randomness.
 *
 * References
 * ----------
 *  - Doench, Hartenian, Fusi et al. (2014) Nat. Biotechnol. 32:1262 (on-target).
 *  - Wang, Wei, Sabatini, Lander (2014) Science 343:80 (sgRNA design trends).
 *  - Doench, Fusi, Sullender et al. (2016) Nat. Biotechnol. 34:184 (CFD off-target).
 *  - Hsu, Scott, Weinstein et al. (2013) Nat. Biotechnol. 31:827 (MIT specificity).
 *  - Zetsche, Gootenberg, Abudayyeh et al. (2015) Cell 163:759 (Cas12a / Cpf1).
 */

import { z } from 'zod';
import type { EngineSpec, SimResult } from '../core/types';
import { provenance } from '../core/types';

// ---------------------------------------------------------------------------
// Basic types
// ---------------------------------------------------------------------------

export type Enzyme = 'SpCas9' | 'Cas12a';
export type Strand = '+' | '-';

/** Length of the spacer/protospacer both nucleases use here. */
export const PROTOSPACER_LEN = 20;

/** A designable PAM site: a PAM with a full-length adjacent protospacer. */
export interface PamMatch {
  /** PAM string, read 5'->3' on the guide's binding strand (e.g. 'AGG','TTTC'). */
  pam: string;
  strand: Strand;
  /** 0-based forward-strand start index of the PAM motif. */
  pamPosition: number;
  /** 0-based forward-strand start index of the 20-nt protospacer window. */
  protospacerStart: number;
}

/** A single genomic near-match discovered by the off-target search. */
export interface OffTargetSite {
  /** 0-based forward-strand start index of the 20-nt window in the genome. */
  position: number;
  strand: Strand;
  /** Hamming distance between guide and the (strand-oriented) genomic 20-mer. */
  mismatches: number;
  /** CFD-like cutting likelihood in (0,1]; 1.0 for a perfect match. */
  cfd: number;
}

export interface OffTargetResult {
  sites: OffTargetSite[];
  /** Σ CFD over all reported off-target sites. */
  totalCfd: number;
  /** Number of reported off-target sites. */
  offTargetCount: number;
  /** Aggregate specificity 1 / (1 + Σ CFD) in (0,1]. */
  specificity: number;
}

export interface GuideRecord {
  protospacer: string;
  pam: string;
  strand: Strand;
  /** Forward-strand start index of the protospacer window. */
  position: number;
  /** Predicted on-target activity in (0,1). */
  onTarget: number;
  offTargetCount: number;
  /** Aggregate off-target specificity in (0,1]. */
  specificity: number;
}

export interface CrisprDetail {
  enzyme: Enzyme;
  guides: GuideRecord[];
}

// ---------------------------------------------------------------------------
// Sequence utilities
// ---------------------------------------------------------------------------

const COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', C: 'G', G: 'C' };

/** Reverse complement of an A/C/G/T string (unknown chars pass through). */
export function revComp(seq: string): string {
  let out = '';
  for (let i = seq.length - 1; i >= 0; i--) out += COMPLEMENT[seq[i]] ?? seq[i];
  return out;
}

/** Hamming distance of two equal-length strings. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) throw new Error('hammingDistance: length mismatch');
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** GC fraction (0..1) of a nucleotide string; 0 for empty input. */
export function gcContent(seq: string): number {
  if (seq.length === 0) return 0;
  let gc = 0;
  for (const c of seq) if (c === 'G' || c === 'C') gc++;
  return gc / seq.length;
}

// ---------------------------------------------------------------------------
// PAM finding
// ---------------------------------------------------------------------------

/**
 * Scan the FORWARD strand of `s` and return designable PAM sites (i.e. those
 * with a full-length protospacer). Coordinates are local to `s`.
 *
 * SpCas9: motif NGG at [n,n+2]; protospacer is the 20 nt 5' of the PAM,
 *         so protospacerStart = n - 20  (requires n >= 20).
 * Cas12a: motif TTTV at [p,p+3]; protospacer is the 20 nt 3' of the PAM,
 *         so protospacerStart = p + 4  (requires p + 4 + 20 <= len).
 */
function scanForwardPams(s: string, enzyme: Enzyme): PamMatch[] {
  const out: PamMatch[] = [];
  const L = s.length;
  if (enzyme === 'SpCas9') {
    // Need s[n+1]=='G' and s[n+2]=='G'; N (s[n]) is any base.
    for (let n = PROTOSPACER_LEN; n + 2 < L; n++) {
      if (s[n + 1] === 'G' && s[n + 2] === 'G') {
        out.push({
          pam: s.slice(n, n + 3),
          strand: '+',
          pamPosition: n,
          protospacerStart: n - PROTOSPACER_LEN,
        });
      }
    }
  } else {
    // Cas12a: 5'-TTTV-3', V ∈ {A,C,G}.
    for (let p = 0; p + 4 + PROTOSPACER_LEN <= L; p++) {
      if (
        s[p] === 'T' &&
        s[p + 1] === 'T' &&
        s[p + 2] === 'T' &&
        (s[p + 3] === 'A' || s[p + 3] === 'C' || s[p + 3] === 'G')
      ) {
        out.push({
          pam: s.slice(p, p + 4),
          strand: '+',
          pamPosition: p,
          protospacerStart: p + 4,
        });
      }
    }
  }
  return out;
}

/**
 * Find all designable PAM sites on BOTH strands of `sequence`.
 *
 * Reverse-strand sites are obtained by scanning the reverse complement with the
 * same forward rule and mapping local coordinates back to forward-strand
 * coordinates. For a reverse-complement window starting at local index `a` with
 * length `len`, the corresponding forward-strand start is `L - a - len`.
 */
export function findPams(sequence: string, opts: { enzyme?: Enzyme } = {}): PamMatch[] {
  const seq = sequence.toUpperCase();
  const enzyme = opts.enzyme ?? 'SpCas9';
  const L = seq.length;

  // Forward strand: local coords are already forward coords.
  const forward = scanForwardPams(seq, enzyme);

  // Reverse strand: scan the reverse complement, then remap.
  const rc = revComp(seq);
  const reverse = scanForwardPams(rc, enzyme).map<PamMatch>((m) => ({
    pam: m.pam, // already read 5'->3' on the reverse strand
    strand: '-',
    pamPosition: L - m.pamPosition - m.pam.length,
    protospacerStart: L - m.protospacerStart - PROTOSPACER_LEN,
  }));

  // Deterministic order: forward before reverse, ascending protospacer start.
  return [...forward, ...reverse].sort(
    (a, b) =>
      a.protospacerStart - b.protospacerStart ||
      (a.strand < b.strand ? -1 : a.strand > b.strand ? 1 : 0),
  );
}

/**
 * Extract the 20-nt protospacer for a PAM match, written 5'->3' on the strand
 * the guide binds. Returns null if the window falls outside the sequence.
 */
export function extractProtospacer(sequence: string, match: PamMatch): string | null {
  const seq = sequence.toUpperCase();
  const start = match.protospacerStart;
  if (start < 0 || start + PROTOSPACER_LEN > seq.length) return null;
  const window = seq.slice(start, start + PROTOSPACER_LEN);
  return match.strand === '+' ? window : revComp(window);
}

// ---------------------------------------------------------------------------
// On-target activity
// ---------------------------------------------------------------------------

/** Tunable weights of the on-target heuristic (documented in the header). */
const OT = {
  intercept: 1.0,
  gcOpt: 0.55, // GC fraction of peak predicted activity
  gcAlpha: 8.0, // curvature of the GC penalty
  proxG: 0.3, // bonus: G at the PAM-proximal position (last spacer base)
  proxT: 0.3, // penalty: T at the PAM-proximal position
  ttttPenalty: 0.6, // penalty: contains TTTT (U6 Pol-III terminator)
} as const;

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Predicted on-target activity of a 20-nt protospacer, normalised to (0,1).
 *
 * additive score = intercept
 *                - gcAlpha·(GC - gcOpt)²           (GC-content optimum)
 *                + proxG·[last == G] - proxT·[last == T]   (PAM-proximal base)
 *                - ttttPenalty·[contains 'TTTT']   (Pol-III terminator)
 * then squashed through a logistic. Higher = more active.
 */
export function onTargetScore(protospacer: string): number {
  const p = protospacer.toUpperCase();
  const gc = gcContent(p);
  let raw = OT.intercept - OT.gcAlpha * (gc - OT.gcOpt) ** 2;

  const last = p[p.length - 1];
  if (last === 'G') raw += OT.proxG;
  else if (last === 'T') raw -= OT.proxT;

  if (p.includes('TTTT')) raw -= OT.ttttPenalty;

  return logistic(raw);
}

// ---------------------------------------------------------------------------
// Off-target search (CFD-like)
// ---------------------------------------------------------------------------

/** CFD position-factor endpoints: tolerant at the 5' distal end, harsh at seed. */
const CFD_MAX_TOL = 0.9; // factor for a mismatch at the 5'-most (distal) position
const CFD_MIN_TOL = 0.05; // factor for a mismatch at the PAM-proximal seed base

/**
 * Per-position mismatch factor for a spacer of length `n`. Index 0 is the
 * 5'-distal end (mismatch barely reduces activity → factor ≈ CFD_MAX_TOL);
 * index n-1 is the PAM-proximal seed (mismatch nearly abolishes activity →
 * factor ≈ CFD_MIN_TOL). Linear interpolation between the two endpoints.
 */
function mismatchFactor(i: number, n: number): number {
  if (n <= 1) return CFD_MIN_TOL;
  const frac = i / (n - 1); // 0 at distal, 1 at seed
  return CFD_MAX_TOL - (CFD_MAX_TOL - CFD_MIN_TOL) * frac;
}

/**
 * CFD-like cutting likelihood between a guide and an equal-length genomic
 * 20-mer (both oriented 5'->3', PAM-proximal base last). Product of the
 * per-position factors at every mismatched position; 1.0 for a perfect match.
 */
export function cfdScore(guide: string, site: string): number {
  if (guide.length !== site.length) throw new Error('cfdScore: length mismatch');
  const n = guide.length;
  let cfd = 1;
  for (let i = 0; i < n; i++) {
    if (guide[i] !== site[i]) cfd *= mismatchFactor(i, n);
  }
  return cfd;
}

export interface OffTargetOpts {
  /** Maximum Hamming distance for a window to count as a near-match. */
  maxMismatch?: number;
  /**
   * If given, a PERFECT match at exactly this forward position + strand is
   * treated as the intended on-target and excluded from the off-target set.
   * Used when a guide is searched against its own source sequence.
   */
  onTargetPosition?: number;
  onTargetStrand?: Strand;
}

/**
 * Enumerate near-matches of `guide` across both strands of `genome` within
 * `maxMismatch` mismatches, score each with `cfdScore`, and aggregate into a
 * specificity score  1 / (1 + Σ CFD).
 */
export function offTargetSearch(
  guide: string,
  genome: string,
  opts: OffTargetOpts = {},
): OffTargetResult {
  const g = guide.toUpperCase();
  const gen = genome.toUpperCase();
  const n = g.length;
  const maxMismatch = opts.maxMismatch ?? 3;
  const sites: OffTargetSite[] = [];

  const isExcluded = (pos: number, strand: Strand, mm: number): boolean =>
    mm === 0 && opts.onTargetPosition === pos && opts.onTargetStrand === strand;

  for (let s = 0; s + n <= gen.length; s++) {
    const window = gen.slice(s, s + n);

    // Forward strand: the guide binds this window directly.
    const mmF = hammingDistance(g, window);
    if (mmF <= maxMismatch && !isExcluded(s, '+', mmF)) {
      sites.push({ position: s, strand: '+', mismatches: mmF, cfd: cfdScore(g, window) });
    }

    // Reverse strand: the guide binds the reverse complement of this window.
    const rcWindow = revComp(window);
    const mmR = hammingDistance(g, rcWindow);
    if (mmR <= maxMismatch && !isExcluded(s, '-', mmR)) {
      sites.push({ position: s, strand: '-', mismatches: mmR, cfd: cfdScore(g, rcWindow) });
    }
  }

  let totalCfd = 0;
  for (const site of sites) totalCfd += site.cfd;
  const specificity = 1 / (1 + totalCfd);
  return { sites, totalCfd, offTargetCount: sites.length, specificity };
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Rank guides best-first by the product of on-target activity and specificity
 * (both in (0,1]), so a guide must be both efficient AND specific to rank high.
 * Ties break by ascending position then strand for determinism. Non-mutating.
 */
export function rankGuides(guides: readonly GuideRecord[]): GuideRecord[] {
  return [...guides].sort((a, b) => {
    const sa = a.onTarget * a.specificity;
    const sb = b.onTarget * b.specificity;
    if (sb !== sa) return sb - sa;
    if (a.position !== b.position) return a.position - b.position;
    return a.strand < b.strand ? -1 : a.strand > b.strand ? 1 : 0;
  });
}

/**
 * End-to-end guide design for a target sequence: find PAMs, extract spacers,
 * score on-target and specificity, and rank. `genome` defaults to `sequence`
 * (self-search), in which case each guide's own origin site is excluded from
 * its off-target tally so a genuinely unique guide scores specificity 1.0.
 */
export function designGuides(
  sequence: string,
  opts: { enzyme?: Enzyme; genome?: string; maxMismatch?: number } = {},
): GuideRecord[] {
  const seq = sequence.toUpperCase();
  const enzyme = opts.enzyme ?? 'SpCas9';
  const selfSearch = opts.genome === undefined;
  const genome = (opts.genome ?? seq).toUpperCase();
  const maxMismatch = opts.maxMismatch ?? 3;

  const guides: GuideRecord[] = [];
  for (const pam of findPams(seq, { enzyme })) {
    const protospacer = extractProtospacer(seq, pam);
    if (protospacer === null) continue;
    const ot = offTargetSearch(protospacer, genome, {
      maxMismatch,
      onTargetPosition: selfSearch ? pam.protospacerStart : undefined,
      onTargetStrand: selfSearch ? pam.strand : undefined,
    });
    guides.push({
      protospacer,
      pam: pam.pam,
      strand: pam.strand,
      position: pam.protospacerStart,
      onTarget: onTargetScore(protospacer),
      offTargetCount: ot.offTargetCount,
      specificity: ot.specificity,
    });
  }
  return rankGuides(guides);
}

// ---------------------------------------------------------------------------
// EngineSpec
// ---------------------------------------------------------------------------

const paramsSchema = z.object({
  /** Target DNA sequence (A/C/G/T). Case-insensitive; normalised to uppercase. */
  sequence: z
    .string()
    .min(1)
    .transform((s) => s.toUpperCase())
    .refine((s) => /^[ACGT]+$/.test(s), 'sequence must contain only A/C/G/T'),
  /** Nuclease PAM to design against. */
  enzyme: z.enum(['SpCas9', 'Cas12a']).default('SpCas9'),
  /** Optional off-target search space; defaults to the target sequence itself. */
  genome: z
    .string()
    .transform((s) => s.toUpperCase())
    .refine((s) => /^[ACGT]+$/.test(s), 'genome must contain only A/C/G/T')
    .optional(),
  /** Maximum mismatches when enumerating off-targets. */
  maxMismatch: z.number().int().min(0).max(6).default(3),
  /** Retained for provenance only; the engine is fully deterministic. */
  seed: z.union([z.number(), z.string()]).default('crispr'),
});

export type CrisprParams = z.infer<typeof paramsSchema>;

const SLUG = 'crispr';
const VERSION = '1.0.0';

function run(rawParams: CrisprParams): SimResult<CrisprDetail> {
  // Re-parse so defaults/normalisation apply even to loosely-shaped input.
  const p = paramsSchema.parse(rawParams);
  const guides = designGuides(p.sequence, {
    enzyme: p.enzyme,
    genome: p.genome,
    maxMismatch: p.maxMismatch,
  });

  const guideCount = guides.length;
  const bestOnTarget = guideCount ? Math.max(...guides.map((g) => g.onTarget)) : 0;
  const bestSpecificity = guideCount ? Math.max(...guides.map((g) => g.specificity)) : 0;

  const summary =
    guideCount === 0
      ? `No ${p.enzyme} guides found in the ${p.sequence.length}-nt target.`
      : `${guideCount} ${p.enzyme} guide(s); best on-target ${bestOnTarget.toFixed(2)}, ` +
        `best specificity ${bestSpecificity.toFixed(2)}.`;

  return {
    engine: SLUG,
    summary,
    metrics: [
      {
        key: 'guideCount',
        label: 'Candidate guides',
        value: guideCount,
        note: 'PAM sites with a full 20-nt protospacer on either strand.',
      },
      {
        key: 'bestOnTarget',
        label: 'Best on-target score',
        value: bestOnTarget,
        note: 'Highest predicted cutting activity (0..1).',
      },
      {
        key: 'bestSpecificity',
        label: 'Best specificity score',
        value: bestSpecificity,
        note: 'Highest aggregate off-target specificity (0..1).',
      },
    ],
    detail: { enzyme: p.enzyme, guides },
    provenance: provenance(SLUG, VERSION, { ...p }, p.seed),
  };
}

export const spec: EngineSpec<CrisprParams, CrisprDetail> = {
  slug: SLUG,
  title: 'CRISPR Guide Design & Off-target',
  domain: 'molecular-biology',
  version: VERSION,
  description:
    "Designs SpCas9 (5'-NGG-3') or Cas12a (5'-TTTV-3') guide RNAs against a target DNA sequence. " +
    'Locates PAMs on both strands, extracts 20-nt protospacers, predicts on-target activity with a ' +
    'position-weighted GC/nucleotide heuristic, and scores genome-wide specificity from CFD-like ' +
    'mismatch-penalised off-target enumeration. Fully deterministic.',
  references: [
    'Doench et al. (2014) Nat. Biotechnol. 32:1262 — on-target activity.',
    'Wang et al. (2014) Science 343:80 — sgRNA design trends.',
    'Doench et al. (2016) Nat. Biotechnol. 34:184 — CFD off-target model.',
    'Hsu et al. (2013) Nat. Biotechnol. 31:827 — MIT specificity score.',
    'Zetsche et al. (2015) Cell 163:759 — Cas12a/Cpf1 TTTV PAM.',
  ],
  // Single cast: zod's transform/default effects make the schema's input type
  // differ from its output type, which the invariant EngineSpec generic rejects.
  paramsSchema: paramsSchema as unknown as z.ZodType<CrisprParams>,
  run,
  example: {
    sequence: 'ACGTACGTACGTACGTACGTAGGCTAGCTAGCTAGCTAGCTTTTACCGGTACCGGTACCGGTACCGG',
    enzyme: 'SpCas9',
    maxMismatch: 3,
    seed: 'crispr',
  },
  tags: [
    'crispr',
    'cas9',
    'spcas9',
    'cas12a',
    'cpf1',
    'guide-rna',
    'off-target',
    'genome-editing',
    'pam',
  ],
};

export default spec;
