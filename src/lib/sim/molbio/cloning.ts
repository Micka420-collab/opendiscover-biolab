/**
 * Restriction Digest & Assembly — an in-silico molecular cloning engine.
 * =====================================================================
 *
 * Models the two most common bench operations in molecular cloning:
 *
 *   1. **Restriction digestion.** Type II restriction endonucleases recognise a
 *      short (usually palindromic) DNA sequence and cleave both strands at a
 *      fixed position relative to that site. We store each enzyme as its
 *      recognition sequence plus the top-strand cut offset. For a *palindromic*
 *      (Type IIP) enzyme the bottom-strand cut is the mirror image, so a single
 *      offset fully specifies the cut. From the two cut coordinates we derive the
 *      single-stranded overhang (5', 3', or blunt) that the fragment ends carry.
 *
 *   2. **Overlap (Gibson-style) assembly.** Fragments that share identical
 *      terminal sequence homology can be stitched into a single contig by
 *      collapsing the shared overlap. This mimics the isothermal Gibson reaction
 *      where a 5'-exonuclease, polymerase and ligase join fragments that overlap.
 *
 * ASSUMPTIONS / SCOPE
 * -------------------
 *   - The bundled enzyme table contains only palindromic Type IIP enzymes, whose
 *     recognition site reads identically on both strands. Forward-strand search
 *     therefore finds every physical site exactly once (no reverse-strand pass
 *     needed, and no double counting). Non-palindromic / Type IIS enzymes would
 *     need a separate bottom-strand cut offset and are intentionally out of scope.
 *   - Fragment "length" is the number of base pairs between consecutive
 *     top-strand cut coordinates — the value a gel reports. For a linear molecule
 *     the fragment lengths sum exactly to the input length.
 *   - Sequences are matched case-insensitively over the alphabet {A,C,G,T,N};
 *     exact base matching is used (no IUPAC-ambiguous recognition sites here).
 *
 * The module is pure and deterministic: no clock, no I/O, no unseeded randomness.
 * It performs no stochastic sampling, so no RNG is required.
 *
 * References:
 *   - Roberts et al., REBASE — the Restriction Enzyme Database, NAR 2015.
 *   - New England Biolabs enzyme catalog (recognition sites & cut positions).
 *   - Gibson et al., "Enzymatic assembly of DNA molecules up to several hundred
 *     kilobases", Nature Methods 6:343–345 (2009).
 */

import { z } from 'zod';
import type { EngineSpec, SimResult } from '../core/types';
import { provenance } from '../core/types';

// ---------------------------------------------------------------------------
// Enzyme table
// ---------------------------------------------------------------------------

/** Kind of DNA end left by a cut. */
export type OverhangType = 'blunt' | "5'" | "3'";

/**
 * A Type IIP restriction enzyme.
 *
 * `cut` is the top-strand cleavage offset measured from the start of `site`
 * (i.e. the number of bases of the site that stay on the 5' fragment). For a
 * palindromic site of length L the bottom strand is cleaved at offset `L - cut`,
 * which is all that is needed to reconstruct the overhang.
 *
 * Example — EcoRI, `G^AATTC`: site `GAATTC` (L = 6), cut = 1, bottom cut = 5,
 * leaving a four-base 5' overhang `AATT`.
 */
export interface Enzyme {
  name: string;
  /** Recognition sequence, 5'->3', uppercase. */
  site: string;
  /** Top-strand cut offset from the start of `site`. */
  cut: number;
}

/**
 * Twelve canonical Type IIP enzymes, using the classic `X^YZ...` cut notation.
 * The `^` position in the comment equals the `cut` offset.
 */
export const ENZYMES: readonly Enzyme[] = [
  { name: 'EcoRI', site: 'GAATTC', cut: 1 }, // G^AATTC  -> 5' AATT
  { name: 'BamHI', site: 'GGATCC', cut: 1 }, // G^GATCC  -> 5' GATC
  { name: 'HindIII', site: 'AAGCTT', cut: 1 }, // A^AGCTT -> 5' AGCT
  { name: 'NotI', site: 'GCGGCCGC', cut: 2 }, // GC^GGCCGC -> 5' GGCC
  { name: 'XhoI', site: 'CTCGAG', cut: 1 }, // C^TCGAG  -> 5' TCGA
  { name: 'PstI', site: 'CTGCAG', cut: 5 }, // CTGCA^G  -> 3' TGCA
  { name: 'SmaI', site: 'CCCGGG', cut: 3 }, // CCC^GGG  -> blunt
  { name: 'EcoRV', site: 'GATATC', cut: 3 }, // GAT^ATC -> blunt
  { name: 'KpnI', site: 'GGTACC', cut: 5 }, // GGTAC^C  -> 3' GTAC
  { name: 'SacI', site: 'GAGCTC', cut: 5 }, // GAGCT^C  -> 3' AGCT
  { name: 'SpeI', site: 'ACTAGT', cut: 1 }, // A^CTAGT  -> 5' CTAG
  { name: 'NcoI', site: 'CCATGG', cut: 1 }, // C^CATGG  -> 5' CATG
];

const ENZYME_BY_NAME: ReadonlyMap<string, Enzyme> = new Map(
  ENZYMES.map((e) => [e.name.toUpperCase(), e]),
);

/** Look up an enzyme by name (case-insensitive). Throws on unknown names. */
export function getEnzyme(name: string): Enzyme {
  const e = ENZYME_BY_NAME.get(name.trim().toUpperCase());
  if (!e) {
    throw new Error(`Unknown enzyme "${name}". Known: ${ENZYMES.map((x) => x.name).join(', ')}`);
  }
  return e;
}

// ---------------------------------------------------------------------------
// Sequence utilities
// ---------------------------------------------------------------------------

const COMPLEMENT: Record<string, string> = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' };

/** Strip whitespace, uppercase, and validate the DNA alphabet. */
export function sanitize(sequence: string): string {
  const s = sequence.replace(/\s+/g, '').toUpperCase();
  if (s.length === 0) throw new Error('sequence is empty');
  if (!/^[ACGTN]+$/.test(s)) {
    throw new Error('sequence contains characters outside {A,C,G,T,N}');
  }
  return s;
}

/** Reverse complement of a DNA string (5'->3'). */
export function reverseComplement(sequence: string): string {
  let out = '';
  for (let i = sequence.length - 1; i >= 0; i--) {
    out += COMPLEMENT[sequence[i]] ?? 'N';
  }
  return out;
}

/**
 * Overhang left by an enzyme, read on the top strand between the two cut sites.
 * `cut < L-cut` => 5' overhang, `cut > L-cut` => 3' overhang, equal => blunt.
 */
function overhangOf(enzyme: Enzyme): { seq: string; type: OverhangType } {
  const L = enzyme.site.length;
  const bottom = L - enzyme.cut;
  const lo = Math.min(enzyme.cut, bottom);
  const hi = Math.max(enzyme.cut, bottom);
  const seq = enzyme.site.slice(lo, hi);
  const type: OverhangType = enzyme.cut < bottom ? "5'" : enzyme.cut > bottom ? "3'" : 'blunt';
  return { seq, type };
}

// ---------------------------------------------------------------------------
// Site finding
// ---------------------------------------------------------------------------

/** A recognition site occurrence with its derived cut coordinate and overhang. */
export interface SiteHit {
  enzyme: string;
  /** 0-based index of the recognition-site start on the top strand. */
  position: number;
  /** Absolute top-strand cut coordinate (mod length for circular templates). */
  cutPosition: number;
  /** Single-stranded overhang sequence (top-strand reading). */
  overhang: string;
  overhangType: OverhangType;
}

/**
 * Find every occurrence of one enzyme's recognition site.
 *
 * For a circular template the search wraps the origin by scanning the sequence
 * concatenated with its own leading (L-1) bases; cut coordinates are taken
 * modulo the length. Because the bundled enzymes are palindromic, scanning the
 * top strand alone is complete.
 */
export function findSites(sequence: string, enzyme: Enzyme, circular = false): SiteHit[] {
  const seq = sanitize(sequence);
  const n = seq.length;
  const L = enzyme.site.length;
  const { seq: overhang, type } = overhangOf(enzyme);
  const hits: SiteHit[] = [];

  if (L > n) return hits;

  // Extend for wrap-around matches on circular templates.
  const haystack = circular ? seq + seq.slice(0, L - 1) : seq;
  const lastStart = circular ? n - 1 : n - L;

  for (let i = 0; i <= lastStart; i++) {
    if (haystack.startsWith(enzyme.site, i)) {
      hits.push({
        enzyme: enzyme.name,
        position: i,
        cutPosition: (i + enzyme.cut) % n,
        overhang,
        overhangType: type,
      });
    }
  }
  return hits;
}

/** Find sites for several enzymes at once, sorted by cut coordinate. */
export function findAllSites(sequence: string, enzymeNames: string[], circular = false): SiteHit[] {
  const hits = enzymeNames.flatMap((name) => findSites(sequence, getEnzyme(name), circular));
  return hits.sort((a, b) => a.cutPosition - b.cutPosition || a.position - b.position);
}

// ---------------------------------------------------------------------------
// Digestion
// ---------------------------------------------------------------------------

/** One end of a fragment. `enzyme` is null for a native (uncut) linear terminus. */
export interface FragmentEnd {
  enzyme: string | null;
  overhang: string;
  overhangType: OverhangType;
}

/** A double-stranded restriction fragment described by its top strand. */
export interface Fragment {
  index: number;
  /** Top-strand start coordinate (inclusive). */
  start: number;
  /**
   * Top-strand end coordinate (exclusive), satisfying `end - start === length`
   * and therefore always `end >= start`. For a linear digest, or a circular
   * fragment that does not cross the origin, `end` is a plain index into the
   * sequence (0..n). For the one circular fragment per digest that wraps the
   * origin, `end` is reported as `start + length` and so can exceed the
   * sequence length `n` — it is a coordinate on the circle "unrolled" past the
   * origin, not a direct index. Do not `sequence.slice(start, end)` on a
   * wrapping fragment; use the fragment's own `.sequence` field (or take
   * `end % n`) instead.
   */
  end: number;
  /** Length in base pairs (top-strand span between cuts). */
  length: number;
  /** Top-strand sequence of the fragment. */
  sequence: string;
  leftEnd: FragmentEnd;
  rightEnd: FragmentEnd;
}

const NATIVE_END: FragmentEnd = { enzyme: null, overhang: '', overhangType: 'blunt' };

function endFromHit(hit: SiteHit): FragmentEnd {
  return { enzyme: hit.enzyme, overhang: hit.overhang, overhangType: hit.overhangType };
}

export interface DigestOptions {
  circular?: boolean;
}

/**
 * Digest a sequence with one or more enzymes.
 *
 * Linear templates yield (cuts + 1) fragments; circular templates yield (cuts)
 * fragments — so the same template digested linear vs circular differs by one
 * fragment. A template with no sites yields a single fragment (the intact
 * molecule).
 */
export function digest(
  sequence: string,
  enzymeNames: string[],
  options: DigestOptions = {},
): Fragment[] {
  const circular = options.circular ?? false;
  const seq = sanitize(sequence);
  const n = seq.length;

  // Collect cut coordinates; dedupe if two enzymes cut the exact same bond.
  const hits = findAllSites(seq, enzymeNames, circular);
  const cuts: SiteHit[] = [];
  const seen = new Set<number>();
  for (const h of hits) {
    if (!seen.has(h.cutPosition)) {
      seen.add(h.cutPosition);
      cuts.push(h);
    }
  }

  const fragments: Fragment[] = [];

  if (!circular) {
    // Boundaries: 0 (native), each cut, then n (native).
    for (let k = 0; k <= cuts.length; k++) {
      const start = k === 0 ? 0 : cuts[k - 1].cutPosition;
      const end = k === cuts.length ? n : cuts[k].cutPosition;
      fragments.push({
        index: k,
        start,
        end,
        length: end - start,
        sequence: seq.slice(start, end),
        leftEnd: k === 0 ? NATIVE_END : endFromHit(cuts[k - 1]),
        rightEnd: k === cuts.length ? NATIVE_END : endFromHit(cuts[k]),
      });
    }
    return fragments;
  }

  // Circular template.
  if (cuts.length === 0) {
    // Intact, uncut circle: one fragment spanning the whole molecule.
    fragments.push({
      index: 0,
      start: 0,
      end: n,
      length: n,
      sequence: seq,
      leftEnd: NATIVE_END,
      rightEnd: NATIVE_END,
    });
    return fragments;
  }

  for (let k = 0; k < cuts.length; k++) {
    const cur = cuts[k];
    const next = cuts[(k + 1) % cuts.length];
    const start = cur.cutPosition;
    const nextPos = next.cutPosition;
    const raw = (nextPos - start + n) % n;
    const length = raw === 0 ? n : raw; // single-cut circle -> full length
    // Report end = start + length so end >= start always holds, even for the
    // wrap-around fragment (where nextPos <= start on the raw coordinate
    // line). The wrap-aware sequence slice below still uses the true modular
    // nextPos, independent of how `end` is reported.
    const end = start + length;
    const fragSeq =
      nextPos > start ? seq.slice(start, nextPos) : seq.slice(start) + seq.slice(0, nextPos);
    fragments.push({
      index: k,
      start,
      end,
      length,
      sequence: fragSeq,
      leftEnd: endFromHit(cur),
      rightEnd: endFromHit(next),
    });
  }
  return fragments;
}

// ---------------------------------------------------------------------------
// Overlap (Gibson-style) assembly
// ---------------------------------------------------------------------------

/**
 * Length of the largest terminal overlap where the 3' end (suffix) of `a`
 * exactly matches the 5' start (prefix) of `b`, requiring at least `minOverlap`
 * bases. Returns 0 when no qualifying overlap exists.
 */
export function overlapLength(a: string, b: string, minOverlap: number): number {
  const max = Math.min(a.length, b.length);
  for (let k = max; k >= minOverlap; k--) {
    if (a.slice(a.length - k) === b.slice(0, k)) return k;
  }
  return 0;
}

/** Join two fragments whose overlap length is `k`, collapsing the shared region. */
export function mergeOverlap(a: string, b: string, k: number): string {
  return a + b.slice(k);
}

export interface AssemblyResult {
  /** The primary (longest) assembled contig. */
  product: string;
  /** Every contig remaining after greedy assembly (usually one). */
  contigs: string[];
  contigCount: number;
  /** True when the product was closed into a circle on a terminal self-overlap. */
  circular: boolean;
}

/**
 * Greedy overlap-layout assembly of fragments sharing terminal homology.
 *
 * Repeatedly merges the fragment pair with the largest qualifying overlap
 * (ties broken by lowest indices for determinism) until no pair overlaps by at
 * least `minOverlap`. Optionally circularises the final contig if its own 3' end
 * overlaps its 5' start (as in a Gibson circular assembly).
 */
export function assemble(
  fragments: string[],
  options: { minOverlap?: number; circular?: boolean } = {},
): AssemblyResult {
  const minOverlap = options.minOverlap ?? 15;
  const wantCircular = options.circular ?? false;
  let contigs = fragments.map((f) => sanitize(f));

  // Greedy: collapse the best available overlap each round.
  for (;;) {
    let bestK = 0;
    let bi = -1;
    let bj = -1;
    for (let i = 0; i < contigs.length; i++) {
      for (let j = 0; j < contigs.length; j++) {
        if (i === j) continue;
        const k = overlapLength(contigs[i], contigs[j], minOverlap);
        if (k > bestK) {
          bestK = k;
          bi = i;
          bj = j;
        }
      }
    }
    if (bestK === 0) break;
    const merged = mergeOverlap(contigs[bi], contigs[bj], bestK);
    // Remove the two consumed contigs (higher index first) and add the merge.
    const hi = Math.max(bi, bj);
    const lo = Math.min(bi, bj);
    contigs.splice(hi, 1);
    contigs.splice(lo, 1);
    contigs.push(merged);
  }

  // Present the longest contig first for a stable primary product.
  contigs = contigs.sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));

  let circular = false;
  if (wantCircular && contigs.length === 1) {
    const c = contigs[0];
    // Largest terminal self-overlap strictly shorter than the contig.
    for (let k = c.length - 1; k >= minOverlap; k--) {
      if (c.slice(c.length - k) === c.slice(0, k)) {
        contigs[0] = c.slice(0, c.length - k);
        circular = true;
        break;
      }
    }
  }

  return {
    product: contigs[0] ?? '',
    contigs,
    contigCount: contigs.length,
    circular,
  };
}

// ---------------------------------------------------------------------------
// Engine spec
// ---------------------------------------------------------------------------

const paramsSchema = z.object({
  /** DNA sequence to digest (whitespace ignored, case-insensitive). */
  sequence: z.string().min(1),
  /** One or more enzyme names from ENZYMES. */
  enzymes: z.array(z.string()).min(1),
  /** Treat the template as a closed circle (e.g. a plasmid). Defaults to false. */
  circular: z.boolean().optional(),
});

export type CloningParams = z.infer<typeof paramsSchema>;

export interface CloningDetail {
  circular: boolean;
  length: number;
  fragments: Fragment[];
  sites: SiteHit[];
  enzymes: Enzyme[];
}

function runCloning(rawParams: CloningParams): SimResult<CloningDetail> {
  const params = paramsSchema.parse(rawParams);
  const seq = sanitize(params.sequence);
  const circular = params.circular ?? false;

  const sites = findAllSites(seq, params.enzymes, circular);
  const fragments = digest(seq, params.enzymes, { circular });
  const lengths = fragments.map((f) => f.length);
  const largest = lengths.length ? Math.max(...lengths) : 0;
  const smallest = lengths.length ? Math.min(...lengths) : 0;
  const usedEnzymes = params.enzymes.map(getEnzyme);

  // Virtual gel: fragment bands sorted large -> small (as they'd migrate).
  const ladder = [...lengths].sort((a, b) => b - a);

  const summary =
    `${params.enzymes.join(' + ')} digest of a ${seq.length} bp ` +
    `${circular ? 'circular' : 'linear'} template -> ${sites.length} site` +
    `${sites.length === 1 ? '' : 's'}, ${fragments.length} fragment` +
    `${fragments.length === 1 ? '' : 's'}.`;

  return {
    engine: cloningSpec.slug,
    summary,
    metrics: [
      { key: 'fragmentCount', label: 'Fragments', value: fragments.length },
      { key: 'siteCount', label: 'Restriction sites', value: sites.length },
      { key: 'largestFragment', label: 'Largest fragment', value: largest, unit: 'bp' },
      { key: 'smallestFragment', label: 'Smallest fragment', value: smallest, unit: 'bp' },
    ],
    series: [
      {
        x: ladder.map((_, i) => i + 1),
        y: { length: ladder },
        xLabel: 'band',
        yLabel: 'fragment length (bp)',
      },
    ],
    detail: {
      circular,
      length: seq.length,
      fragments,
      sites,
      enzymes: usedEnzymes,
    },
    provenance: provenance(cloningSpec.slug, cloningSpec.version, {
      sequence: seq,
      enzymes: params.enzymes,
      circular,
    }),
  };
}

/** The registrable engine specification. */
export const cloningSpec: EngineSpec<CloningParams, CloningDetail> = {
  slug: 'cloning',
  title: 'Restriction Digest & Assembly',
  domain: 'molecular-biology',
  version: '1.0.0',
  description:
    'Deterministic molecular-cloning workbench. Digests linear or circular DNA ' +
    'with a table of twelve canonical Type IIP restriction enzymes, reporting ' +
    'fragment sizes and sticky (5-prime / 3-prime) or blunt overhangs, and joins ' +
    'fragments sharing terminal homology via a greedy Gibson-style overlap assembly.',
  references: [
    'Roberts et al., REBASE — the Restriction Enzyme Database, NAR 2015.',
    'New England Biolabs enzyme catalog (recognition sites & cut positions).',
    'Gibson et al., Nature Methods 6:343-345 (2009), isothermal DNA assembly.',
  ],
  paramsSchema,
  run: runCloning,
  example: {
    // pUC-style multiple cloning site fragment with EcoRI + BamHI sites.
    sequence: 'AAAAGAATTCCCCCCGGATCCTTTT',
    enzymes: ['EcoRI', 'BamHI'],
    circular: false,
  },
  tags: ['cloning', 'restriction', 'digest', 'gibson', 'assembly', 'plasmid', 'dna'],
};

export default cloningSpec;
