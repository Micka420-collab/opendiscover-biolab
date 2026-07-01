/**
 * Protocol: Codon-bias HGT signature.
 *
 * Scientific rationale
 * --------------------
 * Horizontally transferred (HGT) genes often retain the codon-usage signature
 * of their donor genome for many generations after transfer. Compute the
 * codon-usage frequency vector of a target gene, compare it to the host
 * genome's bulk codon usage AND to a panel of putative donor genomes. If the
 * closest match by Jensen-Shannon divergence is NOT the host, the gene is
 * an HGT candidate.
 *
 * Citizen-discoverable signal: a gene whose codon-usage profile fits an
 * unrelated taxon better than its host. A panel of antibiotic-resistance
 * genes across wastewater metagenomes is a particularly fruitful target.
 */

import { canonicalHash } from '@/lib/util/hash';

export interface CodonBiasInput {
  /** Host genome identifier */
  hostGenomeId: string;
  /** Bulk codon usage of the host (frequencies summing to ~1) */
  hostBulkUsage: Record<string, number>;
  /** The gene of interest, as DNA (in-frame) */
  geneDna: string;
  /** Gene identifier (locus tag or accession) */
  geneId: string;
  /** Panel of candidate donor genomes: { donorId → bulk usage } */
  donorPanel: Record<string, Record<string, number>>;
  /** Stable slice key */
  sliceKey: string;
}

export interface CodonBiasOutput {
  hostGenomeId: string;
  geneId: string;
  geneUsage: Record<string, number>;
  jsDivergence: { host: number; donors: Record<string, number> };
  bestMatch: { id: string; divergence: number; isHost: boolean };
  hgtCandidate: boolean;
  /** "Strength" of HGT signature: (host JS) − (best-donor JS). Positive = HGT-like. */
  signal: number;
  schemaVersion: 1;
}

/* ─── Utilities ────────────────────────────────────────────────────── */

function geneCodonUsage(dna: string): Record<string, number> {
  const seq = dna.toUpperCase();
  const counts: Record<string, number> = {};
  let total = 0;
  for (let i = 0; i + 2 < seq.length; i += 3) {
    const c = seq.slice(i, i + 3);
    if (c.includes('N')) continue;
    counts[c] = (counts[c] ?? 0) + 1;
    total++;
  }
  const freqs: Record<string, number> = {};
  if (total === 0) return freqs;
  for (const k of Object.keys(counts).sort()) freqs[k] = counts[k]! / total;
  return freqs;
}

/** Jensen-Shannon divergence (symmetric, bounded [0, ln 2]). */
function jsDivergence(p: Record<string, number>, q: Record<string, number>): number {
  const keys = new Set([...Object.keys(p), ...Object.keys(q)]);
  const m: Record<string, number> = {};
  for (const k of keys) m[k] = 0.5 * ((p[k] ?? 0) + (q[k] ?? 0));
  const klPM = kl(p, m);
  const klQM = kl(q, m);
  return 0.5 * klPM + 0.5 * klQM;
}

function kl(p: Record<string, number>, q: Record<string, number>): number {
  let s = 0;
  for (const k of Object.keys(p)) {
    const pk = p[k]!;
    const qk = q[k] ?? 0;
    if (pk > 0 && qk > 0) s += pk * Math.log(pk / qk);
  }
  return s;
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

/* ─── Main ─────────────────────────────────────────────────────────── */

export function runCodonBiasHgt(input: CodonBiasInput): CodonBiasOutput {
  const geneUsage = geneCodonUsage(input.geneDna);
  const hostDiv = jsDivergence(geneUsage, input.hostBulkUsage);

  const donorDivs: Record<string, number> = {};
  for (const id of Object.keys(input.donorPanel).sort()) {
    donorDivs[id] = jsDivergence(geneUsage, input.donorPanel[id]!);
  }

  let bestId = input.hostGenomeId;
  let bestDiv = hostDiv;
  for (const [id, d] of Object.entries(donorDivs)) {
    if (d < bestDiv) {
      bestDiv = d;
      bestId = id;
    }
  }

  const isHost = bestId === input.hostGenomeId;
  const signal = hostDiv - bestDiv;

  return {
    hostGenomeId: input.hostGenomeId,
    geneId: input.geneId,
    geneUsage: roundMap(geneUsage, 4),
    jsDivergence: {
      host: round(hostDiv, 4),
      donors: roundMap(donorDivs, 4),
    },
    bestMatch: { id: bestId, divergence: round(bestDiv, 4), isHost },
    hgtCandidate: !isHost && signal > 0.02,
    signal: round(signal, 4),
    schemaVersion: 1,
  };
}

export async function hashCodonBiasOutput(o: CodonBiasOutput): Promise<string> {
  return canonicalHash(o);
}
