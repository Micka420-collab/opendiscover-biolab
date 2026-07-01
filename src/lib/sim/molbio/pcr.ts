/**
 * In-silico PCR & primer design.
 * ================================
 *
 * This engine models the core of a Polymerase Chain Reaction on a *known*
 * linear DNA template, plus the bench-side primer-design decisions that go with
 * it. It is deliberately deterministic and analytical — no wet-lab noise — so it
 * can teach the mechanics and be validated against textbook formulae.
 *
 * Biological model & conventions
 * ------------------------------
 *  - The `template` is the top / plus / sense strand written 5'→3'.
 *  - A **forward primer** is IDENTICAL to a stretch of the top strand (it anneals
 *    to the bottom strand and is extended rightward/downstream). So we locate a
 *    forward primer by finding its sequence directly inside the template.
 *  - A **reverse primer** is identical to a stretch of the *bottom* strand, i.e.
 *    it equals the reverse-complement of a top-strand stretch. To locate it we
 *    search the top strand for `revComp(reversePrimer)`; the reverse primer's 3'
 *    end corresponds to the 5'-most base of that matched region.
 *  - The **amplicon** is the top-strand substring spanning from the forward
 *    primer's 5' end to the reverse primer binding region's 3' end. Its length is
 *    the classic "product size" reported by tools such as Primer-BLAST.
 *
 * Melting temperature (Tm)
 * ------------------------
 * Three standard schemes are provided:
 *  - `wallace`  — the "2·(A+T)+4·(G+C)" rule of thumb (Wallace 1979), valid for
 *                 very short oligos (< 14 nt).
 *  - `gc`       — the Marmur–Doty basic GC formula
 *                 Tm = 64.9 + 41·(nGC − 16.4)/N, valid for ~14–50 nt.
 *  - `nn`       — nearest-neighbour thermodynamics with the SantaLucia (1998)
 *                 unified parameter set, the modern gold standard. Returns full
 *                 ΔH/ΔS/ΔG37 and a salt-corrected Tm.
 *
 * References
 * ----------
 *  - SantaLucia J. (1998) "A unified view of polymer, dumbbell, and
 *    oligonucleotide DNA nearest-neighbor thermodynamics." PNAS 95:1460–1465.
 *  - Wallace R.B. et al. (1979) Nucleic Acids Res. 6:3543.
 *  - Marmur J., Doty P. (1962) J. Mol. Biol. 5:109.
 *  - Rychlik W. (1993) "Selection of primers for PCR." Methods Mol. Biol.
 */

import { z } from 'zod';
import { createRng } from '../core/prng';
import type { EngineSpec, SimResult } from '../core/types';
import { provenance } from '../core/types';

// ---------------------------------------------------------------------------
// Sequence primitives
// ---------------------------------------------------------------------------

const COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G' };

/** Watson–Crick complement of a single base (throws on non-ACGT). */
export function complementBase(base: string): string {
  const c = COMPLEMENT[base];
  if (!c) throw new Error(`complementBase: not a DNA base: ${base}`);
  return c;
}

/** Uppercase, strip whitespace, and assert the string is pure ACGT DNA. */
export function normalizeSeq(seq: string): string {
  const s = seq.toUpperCase().replace(/\s+/g, '');
  if (!/^[ACGT]+$/.test(s)) {
    throw new Error(`normalizeSeq: sequence must be non-empty ACGT DNA, got "${seq}"`);
  }
  return s;
}

/** Reverse-complement a DNA sequence (5'→3' in, 5'→3' out). */
export function revComp(seq: string): string {
  let out = '';
  for (let i = seq.length - 1; i >= 0; i--) out += complementBase(seq[i]);
  return out;
}

/** Two bases form a Watson–Crick pair. */
export function isComplement(a: string, b: string): boolean {
  return COMPLEMENT[a] === b;
}

/** Base composition counts. */
export function baseCounts(seq: string): { A: number; C: number; G: number; T: number } {
  const counts = { A: 0, C: 0, G: 0, T: 0 };
  for (const ch of seq) counts[ch as 'A' | 'C' | 'G' | 'T']++;
  return counts;
}

/** GC fraction in [0, 1]. */
export function gcContent(seq: string): number {
  const { G, C } = baseCounts(seq);
  return seq.length === 0 ? 0 : (G + C) / seq.length;
}

/** GC percentage in [0, 100]. */
export function gcPercent(seq: string): number {
  return 100 * gcContent(seq);
}

/** True if a sequence equals its own reverse-complement (a palindrome). */
export function isSelfComplementary(seq: string): boolean {
  return seq.length % 2 === 0 && seq === revComp(seq);
}

// ---------------------------------------------------------------------------
// Melting temperature
// ---------------------------------------------------------------------------

/** Wallace "2+4" rule: Tm = 2·(A+T) + 4·(G+C). Best for oligos < 14 nt. */
export function wallaceTm(seq: string): number {
  const { A, T, G, C } = baseCounts(seq);
  return 2 * (A + T) + 4 * (G + C);
}

/** Marmur–Doty basic GC formula: Tm = 64.9 + 41·(nGC − 16.4)/N. */
export function gcTm(seq: string): number {
  const { G, C } = baseCounts(seq);
  const n = seq.length;
  return 64.9 + (41 * (G + C - 16.4)) / n;
}

/**
 * SantaLucia (1998) unified nearest-neighbour parameters.
 * Keyed by the top-strand dinucleotide (5'→3'). ΔH in kcal/mol, ΔS in
 * cal/(mol·K). The set is internally symmetric: value(XY) == value(revComp(XY)).
 */
const NN_H: Record<string, number> = {
  AA: -7.9,
  AC: -8.4,
  AG: -7.8,
  AT: -7.2,
  CA: -8.5,
  CC: -8.0,
  CG: -10.6,
  CT: -7.8,
  GA: -8.2,
  GC: -9.8,
  GG: -8.0,
  GT: -8.4,
  TA: -7.2,
  TC: -8.2,
  TG: -8.5,
  TT: -7.9,
};
const NN_S: Record<string, number> = {
  AA: -22.2,
  AC: -22.4,
  AG: -21.0,
  AT: -20.4,
  CA: -22.7,
  CC: -19.9,
  CG: -27.2,
  CT: -21.0,
  GA: -22.2,
  GC: -24.4,
  GG: -19.9,
  GT: -22.4,
  TA: -21.3,
  TC: -22.2,
  TG: -22.7,
  TT: -22.2,
};
// Helix-initiation parameters (per terminal base pair).
const INIT_GC = { H: 0.1, S: -2.8 };
const INIT_AT = { H: 2.3, S: 4.1 };
const R_CAL = 1.987; // gas constant, cal/(mol·K)

export interface NnThermo {
  /** Total enthalpy ΔH° (kcal/mol). */
  dH: number;
  /** Total entropy ΔS° (cal/(mol·K)), at 1 M NaCl. */
  dS: number;
  /** Gibbs free energy at 37 °C (kcal/mol). */
  dG37: number;
}

/**
 * Nearest-neighbour ΔH°, ΔS° and ΔG°37 for a perfectly-matched duplex, using the
 * SantaLucia 1998 unified set (1 M NaCl reference state).
 */
export function nnThermo(seq: string): NnThermo {
  if (seq.length < 2) throw new Error('nnThermo: need at least 2 nt');
  let dH = 0;
  let dS = 0;
  for (let i = 0; i < seq.length - 1; i++) {
    const pair = seq.slice(i, i + 2);
    dH += NN_H[pair];
    dS += NN_S[pair];
  }
  // Initiation contributions from each terminal base pair.
  for (const end of [seq[0], seq[seq.length - 1]]) {
    const init = end === 'G' || end === 'C' ? INIT_GC : INIT_AT;
    dH += init.H;
    dS += init.S;
  }
  // Symmetry correction for self-complementary duplexes.
  if (isSelfComplementary(seq)) dS += -1.4;
  const dG37 = dH - (310.15 * dS) / 1000;
  return { dH, dS, dG37 };
}

export interface NnTmOptions {
  /** Monovalent cation (Na+) concentration in mol/L. Default 50 mM. */
  naM?: number;
  /** Total primer strand concentration in mol/L. Default 0.5 µM. */
  primerM?: number;
}

/**
 * Nearest-neighbour melting temperature (°C) with the SantaLucia monovalent salt
 * correction. Uses Tm = ΔH / (ΔS + R·ln(C_T/x)), x = 4 for non-self-complementary
 * primers in excess (x = 1 for a self-complementary duplex).
 */
export function nnTm(seq: string, opts: NnTmOptions = {}): number {
  const naM = opts.naM ?? 0.05;
  const primerM = opts.primerM ?? 0.5e-6;
  const { dH, dS } = nnThermo(seq);
  const n = seq.length;
  // SantaLucia 1998 entropy salt correction: ΔS(Na+) = ΔS(1M) + 0.368·(N−1)·ln[Na+].
  const dSsalt = dS + 0.368 * (n - 1) * Math.log(naM);
  const selfComp = isSelfComplementary(seq);
  const x = selfComp ? 1 : 4;
  const tmK = (dH * 1000) / (dSsalt + R_CAL * Math.log(primerM / x));
  return tmK - 273.15;
}

export type TmMethod = 'wallace' | 'gc' | 'nn' | 'auto';

/**
 * Unified Tm entry point. `auto` selects Wallace for short oligos (< 14 nt) and
 * the GC formula otherwise — a common heuristic.
 */
export function primerTm(seq: string, method: TmMethod = 'auto', opts: NnTmOptions = {}): number {
  const s = normalizeSeq(seq);
  switch (method) {
    case 'wallace':
      return wallaceTm(s);
    case 'gc':
      return gcTm(s);
    case 'nn':
      return nnTm(s, opts);
    default:
      return s.length < 14 ? wallaceTm(s) : gcTm(s);
  }
}

// ---------------------------------------------------------------------------
// Binding-site search
// ---------------------------------------------------------------------------

export interface BindingSite {
  /** 0-based start index of the match on the searched strand. */
  start: number;
  /** Exclusive end index. */
  end: number;
  /** Number of internal mismatches (always 0 for an exact match). */
  mismatches: number;
}

export interface FindOptions {
  /** Total mismatches tolerated across the primer. Default 0 (exact). */
  maxMismatches?: number;
  /**
   * Number of 3'-terminal bases that MUST match exactly. Polymerase cannot
   * extend from a mismatched 3' end, so anchored search enforces this. Ignored
   * when maxMismatches = 0.
   */
  threePrimeAnchor?: number;
}

/**
 * Find every position where `primer` anneals to `strand`. With the defaults this
 * is an exact substring search. Set `maxMismatches` > 0 to allow a 3'-anchored
 * approximate match: interior mismatches are tolerated but the last
 * `threePrimeAnchor` bases (the priming end) must be a perfect match.
 */
export function findBindingSites(
  strand: string,
  primer: string,
  opts: FindOptions = {},
): BindingSite[] {
  const s = normalizeSeq(strand);
  const p = normalizeSeq(primer);
  const maxMismatches = opts.maxMismatches ?? 0;
  const anchor = Math.min(opts.threePrimeAnchor ?? 5, p.length);
  const L = p.length;
  const sites: BindingSite[] = [];

  for (let i = 0; i + L <= s.length; i++) {
    let mm = 0;
    let ok = true;
    for (let j = 0; j < L; j++) {
      if (s[i + j] !== p[j]) {
        // A mismatch inside the 3'-terminal anchor window disqualifies the site.
        if (j >= L - anchor) {
          ok = false;
          break;
        }
        mm++;
        if (mm > maxMismatches) {
          ok = false;
          break;
        }
      }
    }
    if (ok) sites.push({ start: i, end: i + L, mismatches: mm });
  }
  return sites;
}

// ---------------------------------------------------------------------------
// PCR simulation
// ---------------------------------------------------------------------------

export interface Amplicon {
  /** 0-based start on the template (5' end of the forward primer). */
  start: number;
  /** Exclusive end on the template (3' end of the reverse binding region). */
  end: number;
  /** Product length in base pairs. */
  length: number;
  /** The double-stranded product's top strand, 5'→3'. */
  sequence: string;
  /** Mismatches carried by the forward / reverse primer at their sites. */
  fwdMismatches: number;
  revMismatches: number;
}

export interface SimulatePcrOptions extends FindOptions {
  /** Discard products longer than this (mimics extension-time limits). */
  maxProductLength?: number;
}

/**
 * Predict the amplicon(s) produced from a template by a forward/reverse primer
 * pair. The forward primer is matched directly on the top strand; the reverse
 * primer is matched via its reverse-complement (i.e. it binds the reverse
 * strand). Every valid forward-upstream / reverse-downstream pairing yields a
 * product; results are sorted by genomic start then by length.
 */
export function simulatePcr(
  template: string,
  forwardPrimer: string,
  reversePrimer: string,
  opts: SimulatePcrOptions = {},
): Amplicon[] {
  const t = normalizeSeq(template);
  const fwd = normalizeSeq(forwardPrimer);
  const rev = normalizeSeq(reversePrimer);
  const maxProductLength = opts.maxProductLength ?? Number.POSITIVE_INFINITY;

  const fwdSites = findBindingSites(t, fwd, opts);
  // The reverse primer binds the reverse strand, so on the top strand it appears
  // as its reverse-complement.
  const revSites = findBindingSites(t, revComp(rev), opts);

  const amplicons: Amplicon[] = [];
  for (const f of fwdSites) {
    for (const r of revSites) {
      // Forward primer must sit upstream of (or level with) the reverse binding
      // region, and the two must not read past one another.
      if (f.start <= r.start && f.end <= r.end && r.end > f.start) {
        const length = r.end - f.start;
        if (length <= maxProductLength) {
          amplicons.push({
            start: f.start,
            end: r.end,
            length,
            sequence: t.slice(f.start, r.end),
            fwdMismatches: f.mismatches,
            revMismatches: r.mismatches,
          });
        }
      }
    }
  }
  amplicons.sort((a, b) => a.start - b.start || a.length - b.length);
  return amplicons;
}

// ---------------------------------------------------------------------------
// Self-dimer & hairpin checks
// ---------------------------------------------------------------------------

export interface SelfDimerResult {
  /** Longest run of consecutive complementary base pairs across all frames. */
  maxRun: number;
  /** True if a complementary run involves the primer's 3' end (extendable dimer). */
  threePrimeDimer: boolean;
}

/**
 * Self-dimer check: slide two antiparallel copies of the primer over each other
 * and report the longest run of consecutive Watson–Crick pairs. A run that
 * reaches a primer's 3' end is especially harmful because polymerase can extend
 * it into a primer-dimer artefact.
 */
export function selfDimer(primer: string): SelfDimerResult {
  const p = normalizeSeq(primer);
  const n = p.length;
  let maxRun = 0;
  let threePrimeDimer = false;

  // Bottom copy is antiparallel: column c aligns top[i] with bottom = p[n-1-(i-s)].
  for (let s = -(n - 1); s <= n - 1; s++) {
    let run = 0;
    for (let i = 0; i < n; i++) {
      const k = n - 1 - i + s; // index into p for the antiparallel partner
      if (k < 0 || k >= n) {
        run = 0;
        continue;
      }
      if (isComplement(p[i], p[k])) {
        run++;
        if (run > maxRun) maxRun = run;
        // Does this pairing touch either strand's 3' end (index n-1)?
        if (i === n - 1 || k === n - 1) threePrimeDimer = true;
      } else {
        run = 0;
      }
    }
  }
  return { maxRun, threePrimeDimer };
}

export interface HairpinResult {
  hasHairpin: boolean;
  /** Length of the strongest complementary stem found. */
  stemLength: number;
  /** Number of unpaired loop bases between the stem arms. */
  loopSize: number;
}

/**
 * Hairpin check: the primer folds back on itself when a 5' segment is
 * reverse-complementary to a 3' segment with an intervening single-stranded
 * loop. Returns the strongest stem (longest, then smallest loop) meeting the
 * minimum stem/loop thresholds.
 */
export function hairpin(primer: string, minStem = 3, minLoop = 3): HairpinResult {
  const p = normalizeSeq(primer);
  const n = p.length;
  let best: HairpinResult = { hasHairpin: false, stemLength: 0, loopSize: 0 };

  for (let i = 0; i < n; i++) {
    for (let j = n - 1; j > i; j--) {
      // Grow a stem: p[i+t] pairs with p[j-t].
      let s = 0;
      while (i + s < j - s && isComplement(p[i + s], p[j - s])) s++;
      if (s < minStem) continue;
      const loop = j - s + 1 - (i + s - 1) - 1; // unpaired bases between arms
      if (loop < minLoop) continue;
      if (s > best.stemLength || (s === best.stemLength && loop < best.loopSize)) {
        best = { hasHairpin: true, stemLength: s, loopSize: loop };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Primer design
// ---------------------------------------------------------------------------

export interface DesignOptions {
  /** Preferred primer length (used to seed the search). Default 20. */
  length?: number;
  /** Target Tm in °C. Default 58. */
  tmTarget?: number;
  /** Tm method used while designing. Default 'gc'. */
  tmMethod?: TmMethod;
  /** Length search window. */
  minLength?: number;
  maxLength?: number;
}

export interface DesignedPrimer {
  sequence: string;
  length: number;
  tm: number;
  gcPercent: number;
  /** True if the 3' base is G or C (a stabilising GC clamp). */
  gcClamp: boolean;
}

export interface PrimerPair {
  forward: DesignedPrimer;
  reverse: DesignedPrimer;
  /** The exact template region the pair would amplify. */
  productLength: number;
}

function describePrimer(seq: string, method: TmMethod): DesignedPrimer {
  const last = seq[seq.length - 1];
  return {
    sequence: seq,
    length: seq.length,
    tm: primerTm(seq, method),
    gcPercent: gcPercent(seq),
    gcClamp: last === 'G' || last === 'C',
  };
}

/**
 * Pick a primer length that lands closest to `tmTarget`, preferring candidates
 * that end in a GC clamp. `slice(len)` returns the candidate primer of a given
 * length (already oriented 5'→3').
 */
function pickLength(
  minLen: number,
  maxLen: number,
  tmTarget: number,
  method: TmMethod,
  slice: (len: number) => string | null,
): string {
  let best: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let len = minLen; len <= maxLen; len++) {
    const cand = slice(len);
    if (!cand) continue;
    const last = cand[cand.length - 1];
    const clamp = last === 'G' || last === 'C';
    // Objective: distance to target Tm, with a bonus (−5 °C-equivalent) for a
    // GC clamp so a slightly-off clamped primer beats a perfect non-clamped one.
    const score = Math.abs(primerTm(cand, method) - tmTarget) - (clamp ? 5 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  if (!best) throw new Error('pickLength: no candidate primer fits the length window');
  return best;
}

/**
 * Design a forward/reverse primer pair flanking `target` (given 5'→3', top
 * strand). The forward primer is taken from the 5' end, the reverse primer is
 * the reverse-complement of the 3' end. Lengths are chosen to approach the
 * target Tm while favouring a 3' GC clamp.
 */
export function designPrimers(target: string, opts: DesignOptions = {}): PrimerPair {
  const t = normalizeSeq(target);
  const tmTarget = opts.tmTarget ?? 58;
  const method = opts.tmMethod ?? 'gc';
  const minLen = opts.minLength ?? Math.max(15, (opts.length ?? 20) - 4);
  const maxLen = opts.maxLength ?? (opts.length ?? 20) + 6;
  if (t.length < maxLen) {
    throw new Error(
      `designPrimers: target (${t.length} nt) shorter than max primer length (${maxLen})`,
    );
  }

  const fwdSeq = pickLength(minLen, maxLen, tmTarget, method, (len) => t.slice(0, len));
  const revSeq = pickLength(minLen, maxLen, tmTarget, method, (len) =>
    revComp(t.slice(t.length - len)),
  );

  const forward = describePrimer(fwdSeq, method);
  const reverse = describePrimer(revSeq, method);
  // The pair amplifies the whole target: from the forward 5' end to the reverse
  // primer's binding region 3' end, i.e. the entire target here.
  const productLength = t.length;
  return { forward, reverse, productLength };
}

// ---------------------------------------------------------------------------
// EngineSpec
// ---------------------------------------------------------------------------

const paramsSchema = z.object({
  /** Top-strand template DNA, 5'→3'. */
  template: z.string().min(1).describe('Template DNA (top strand, 5′→3′)'),
  /** Optional forward primer; auto-designed from the template if omitted. */
  forwardPrimer: z.string().optional().describe('Forward primer 5′→3′ (optional)'),
  /** Optional reverse primer; auto-designed if omitted. */
  reversePrimer: z.string().optional().describe('Reverse primer 5′→3′ (optional)'),
  /** Preferred primer length when auto-designing. */
  primerLength: z.number().int().min(6).max(60).default(20),
  /** Target Tm (°C) when auto-designing. */
  tmTarget: z.number().min(30).max(90).default(58),
  /** Tm reporting method. */
  tmMethod: z.enum(['wallace', 'gc', 'nn', 'auto']).default('auto'),
  /** Mismatches tolerated during binding-site search (3'-anchored). */
  maxMismatches: z.number().int().min(0).max(5).default(0),
  /** Seed (kept for provenance; the engine is fully deterministic). */
  seed: z.union([z.number(), z.string()]).default('pcr'),
});

export type PcrParams = z.input<typeof paramsSchema>;

export interface PcrDetail {
  amplicon: Amplicon | null;
  allAmplicons: Amplicon[];
  primers: {
    forward: string;
    reverse: string;
    fwdTm: number;
    revTm: number;
    fwdGcPercent: number;
    revGcPercent: number;
    autoDesigned: boolean;
  };
  quality: {
    fwdSelfDimer: SelfDimerResult;
    revSelfDimer: SelfDimerResult;
    fwdHairpin: HairpinResult;
    revHairpin: HairpinResult;
  };
  warnings: string[];
}

function run(rawParams: PcrParams): SimResult<PcrDetail> {
  const params = paramsSchema.parse(rawParams);
  // Touch the RNG so provenance/seed is meaningful and the API mirrors the
  // stochastic engines; PCR itself is deterministic so we consume nothing.
  createRng(params.seed);

  const template = normalizeSeq(params.template);
  const warnings: string[] = [];

  // Resolve primers: use those supplied, else auto-design a flanking pair.
  let fwd: string;
  let rev: string;
  let autoDesigned = false;
  if (params.forwardPrimer && params.reversePrimer) {
    fwd = normalizeSeq(params.forwardPrimer);
    rev = normalizeSeq(params.reversePrimer);
  } else {
    autoDesigned = true;
    const pair = designPrimers(template, {
      length: params.primerLength,
      tmTarget: params.tmTarget,
      tmMethod: params.tmMethod === 'auto' ? 'gc' : params.tmMethod,
    });
    fwd = params.forwardPrimer ? normalizeSeq(params.forwardPrimer) : pair.forward.sequence;
    rev = params.reversePrimer ? normalizeSeq(params.reversePrimer) : pair.reverse.sequence;
  }

  const amplicons = simulatePcr(template, fwd, rev, { maxMismatches: params.maxMismatches });
  const amplicon = amplicons[0] ?? null;

  const fwdTm = primerTm(fwd, params.tmMethod);
  const revTm = primerTm(rev, params.tmMethod);
  const fwdGc = gcPercent(fwd);
  const revGc = gcPercent(rev);
  const productGcPercent = amplicon ? gcPercent(amplicon.sequence) : 0;

  // Quality flags.
  const fwdSelfDimer = selfDimer(fwd);
  const revSelfDimer = selfDimer(rev);
  const fwdHairpin = hairpin(fwd);
  const revHairpin = hairpin(rev);

  if (!amplicon) warnings.push('No amplicon: primers do not flank a product on this template.');
  if (amplicons.length > 1)
    warnings.push(`${amplicons.length} possible products — primers are not specific.`);
  if (Math.abs(fwdTm - revTm) > 5)
    warnings.push(`Primer Tm mismatch of ${Math.abs(fwdTm - revTm).toFixed(1)} °C (>5 °C).`);
  if (fwdSelfDimer.threePrimeDimer || revSelfDimer.threePrimeDimer)
    warnings.push('3′ self-dimer risk detected.');
  if (fwdHairpin.hasHairpin && fwdHairpin.stemLength >= 4)
    warnings.push('Forward primer may form a hairpin.');
  if (revHairpin.hasHairpin && revHairpin.stemLength >= 4)
    warnings.push('Reverse primer may form a hairpin.');
  if (fwdGc < 40 || fwdGc > 60)
    warnings.push(`Forward primer GC ${fwdGc.toFixed(0)}% outside 40–60% comfort zone.`);
  if (revGc < 40 || revGc > 60)
    warnings.push(`Reverse primer GC ${revGc.toFixed(0)}% outside 40–60% comfort zone.`);

  const detail: PcrDetail = {
    amplicon,
    allAmplicons: amplicons,
    primers: {
      forward: fwd,
      reverse: rev,
      fwdTm,
      revTm,
      fwdGcPercent: fwdGc,
      revGcPercent: revGc,
      autoDesigned,
    },
    quality: { fwdSelfDimer, revSelfDimer, fwdHairpin, revHairpin },
    warnings,
  };

  const summary = amplicon
    ? `PCR on a ${template.length} nt template yields a ${amplicon.length} bp product (GC ${productGcPercent.toFixed(0)}%); primer Tm ${fwdTm.toFixed(1)}/${revTm.toFixed(1)} °C.`
    : `No PCR product: the ${autoDesigned ? 'designed' : 'supplied'} primers do not flank an amplicon on this ${template.length} nt template.`;

  return {
    engine: 'pcr',
    summary,
    metrics: [
      { key: 'ampliconLength', label: 'Amplicon length', value: amplicon?.length ?? 0, unit: 'bp' },
      { key: 'fwdTm', label: 'Forward primer Tm', value: fwdTm, unit: '°C' },
      { key: 'revTm', label: 'Reverse primer Tm', value: revTm, unit: '°C' },
      { key: 'productGcPercent', label: 'Product GC content', value: productGcPercent, unit: '%' },
    ],
    detail,
    provenance: provenance('pcr', '1.0.0', params, params.seed),
  };
}

export const spec: EngineSpec<PcrParams, PcrDetail> = {
  slug: 'pcr',
  title: 'In-silico PCR & Primer Design',
  domain: 'molecular-biology',
  version: '1.0.0',
  description:
    'Deterministic in-silico PCR on a known linear template. Locates forward/reverse ' +
    'primer binding sites (exact or 3′-anchored), predicts amplicon start/end/length/sequence ' +
    '(the reverse primer binding the reverse-complement strand), computes primer Tm by the ' +
    'Wallace, Marmur–Doty GC, or SantaLucia nearest-neighbour models, auto-designs flanking ' +
    'primers with a 3′ GC clamp near a target Tm, and flags self-dimer/hairpin risks.',
  references: [
    'SantaLucia J. (1998) PNAS 95:1460–1465 — unified nearest-neighbour DNA thermodynamics.',
    'Wallace R.B. et al. (1979) Nucleic Acids Res. 6:3543 — the 2+4 Tm rule.',
    'Marmur J. & Doty P. (1962) J. Mol. Biol. 5:109 — GC-based Tm.',
    'Rychlik W. (1993) Methods Mol. Biol. — primer selection guidelines.',
  ],
  paramsSchema,
  run,
  example: {
    template:
      'CAGTCAGTCAATGCGTACCGGATCCAAGCTCGATTAGCGCTAGGTTCACCTGATCGATCACTGGATCCTTAGCACGTTACGGATCGTACATTGCAGCTAAGGCATCGTACGGATCCGGAT',
    forwardPrimer: 'ATGCGTACCGGATCCAAGCT',
    reversePrimer: 'GTACGATGCCTTAGCTGCAA',
    primerLength: 20,
    tmTarget: 58,
    tmMethod: 'auto',
    maxMismatches: 0,
    seed: 'pcr',
  },
  tags: ['pcr', 'primer-design', 'molecular-biology', 'tm', 'amplicon', 'nearest-neighbor'],
};

export default spec;
