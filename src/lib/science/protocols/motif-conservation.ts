/**
 * Protocol: Motif conservation across genomes.
 *
 * Scientific rationale
 * --------------------
 * A short protein motif (≤25 aa) conserved across distantly related genomes
 * but located in regions NOT annotated as known PFAM/InterPro domains is a
 * strong candidate for an undescribed functional element. Asgardarchaeota
 * conserved motifs are a famous source of such signals.
 *
 * Algorithm: scan each genome's predicted proteome for exact + low-mismatch
 * matches of a query motif, count distinct genomes harboring it, exclude
 * matches falling inside annotated domain coordinates supplied per genome.
 * Score is "novelty conservation" = (genomes hit) × (median motif distance
 * from any annotated domain).
 */

import { canonicalHash } from '@/lib/util/hash';

export interface MotifConservationInput {
  motif: string; // protein sequence, 5–25 aa
  /** Per-genome data: predicted proteome + known annotated domain ranges */
  genomes: Array<{
    genomeId: string;
    proteins: Array<{
      proteinId: string;
      sequence: string;
      annotatedDomains?: Array<{ start: number; end: number; name?: string }>;
    }>;
  }>;
  /** Maximum mismatch tolerance (Hamming) */
  maxMismatches?: number;
  sliceKey: string;
}

export interface MotifHit {
  genomeId: string;
  proteinId: string;
  start: number;
  end: number;
  mismatches: number;
  insideAnnotatedDomain: boolean;
  nearestDomainDistance: number; // residues; Infinity if no domains annotated
}

export interface MotifConservationOutput {
  motif: string;
  hits: MotifHit[];
  hitGenomes: string[];
  conservedOutsideDomains: number;
  noveltyConservationScore: number;
  schemaVersion: 1;
}

function hammingDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

function scanProtein(
  motif: string,
  protein: string,
  maxMismatches: number,
): Array<{ start: number; end: number; mismatches: number }> {
  const hits = [];
  const L = motif.length;
  for (let i = 0; i + L <= protein.length; i++) {
    const slice = protein.slice(i, i + L);
    const m = hammingDistance(motif, slice);
    if (m <= maxMismatches) hits.push({ start: i, end: i + L - 1, mismatches: m });
  }
  return hits;
}

function distanceFromDomains(
  start: number,
  end: number,
  domains: Array<{ start: number; end: number }>,
): { inside: boolean; nearest: number } {
  if (!domains.length) return { inside: false, nearest: Number.POSITIVE_INFINITY };
  let nearest = Number.POSITIVE_INFINITY;
  let inside = false;
  for (const d of domains) {
    if (start >= d.start && end <= d.end) inside = true;
    const before = d.start - end;
    const after = start - d.end;
    const gap = Math.max(0, Math.max(before, after));
    if (gap < nearest) nearest = gap;
  }
  return { inside, nearest };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export function runMotifConservation(input: MotifConservationInput): MotifConservationOutput {
  const motif = input.motif.toUpperCase();
  if (motif.length < 5 || motif.length > 25) {
    throw new Error('motif must be 5–25 amino acids');
  }
  const maxMismatches = input.maxMismatches ?? 1;

  const allHits: MotifHit[] = [];
  for (const g of input.genomes) {
    for (const p of g.proteins) {
      const localHits = scanProtein(motif, p.sequence.toUpperCase(), maxMismatches);
      for (const h of localHits) {
        const { inside, nearest } = distanceFromDomains(h.start, h.end, p.annotatedDomains ?? []);
        allHits.push({
          genomeId: g.genomeId,
          proteinId: p.proteinId,
          start: h.start,
          end: h.end,
          mismatches: h.mismatches,
          insideAnnotatedDomain: inside,
          nearestDomainDistance: Number.isFinite(nearest) ? nearest : -1,
        });
      }
    }
  }

  allHits.sort((a, b) =>
    a.genomeId !== b.genomeId
      ? a.genomeId.localeCompare(b.genomeId)
      : a.proteinId !== b.proteinId
        ? a.proteinId.localeCompare(b.proteinId)
        : a.start - b.start,
  );

  const hitGenomes = Array.from(new Set(allHits.map((h) => h.genomeId))).sort();
  const outsideHits = allHits.filter((h) => !h.insideAnnotatedDomain);
  const conservedOutsideDomains = new Set(outsideHits.map((h) => h.genomeId)).size;
  const distances = outsideHits
    .map((h) => h.nearestDomainDistance)
    .filter((d) => d >= 0);
  const medianDist = median(distances);

  // Score: rewards genomes-hit-outside-domains × evidence that motif sits in
  // genuinely unannotated regions.
  const noveltyConservationScore =
    conservedOutsideDomains * Math.min(1, medianDist / 50);

  return {
    motif,
    hits: allHits,
    hitGenomes,
    conservedOutsideDomains,
    noveltyConservationScore: Math.round(noveltyConservationScore * 1000) / 1000,
    schemaVersion: 1,
  };
}

export async function hashMotifOutput(o: MotifConservationOutput): Promise<string> {
  return canonicalHash(o);
}
