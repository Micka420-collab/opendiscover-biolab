/**
 * Solve a {@link Cross} into the exact, deterministic outcome the game reveals.
 *
 * Everything here is read straight off the `breeding` engine's own output — the
 * engine is the single source of truth for the genetics, so there is no answer
 * key to store and no way for the UI to disagree with the science. The engine is
 * pure and seeded, so a solved cross is identical on every machine and can be
 * pre-computed during server render without any hydration mismatch.
 */

import { runEngine } from '@/lib/sim';
import { type Gene, genePhenotype } from '@/lib/sim/genetics/breeding';
import type { BreedingDetail } from '@/lib/sim/genetics/breeding';
import type { Cross } from './specimens';

/** Offspring drawn for the visible "litter". 16 → a tidy 4×4 grid. */
export const LITTER_SIZE = 16;

export interface PhenotypeShare {
  label: string;
  /** Probability in 0..1 (an exact Mendelian fraction). */
  probability: number;
}

export interface PunnettCell {
  genotype: string;
  phenotype: string;
}

/** A single-locus Punnett square: parent gametes down the side and across the top. */
export interface Punnett {
  gene: Gene;
  gametesA: string[];
  gametesB: string[];
  /** cells[row][col] for gametesA[row] × gametesB[col]. */
  cells: PunnettCell[][];
}

export interface SolvedCross {
  /** Distinct phenotypes, sorted by label — the stable prediction choices. */
  options: PhenotypeShare[];
  /** Same shares, sorted most-likely first — the reveal order. */
  ranked: PhenotypeShare[];
  /** The engine's small-integer phenotypic ratio string, e.g. "3:1". */
  ratio: string;
  /** The most-likely phenotype label(s) — more than one only on an exact tie. */
  mostCommon: string[];
  /** A seeded, concrete litter of offspring — the watchable payoff. */
  litter: { phenotype: string; genotype: string }[];
  parentAPhenotype: string;
  parentBPhenotype: string;
  /** Offspring looks that NEITHER parent visibly shows (the recessive "surprise"). */
  hiddenLooks: string[];
  /** The Punnett square, for single-locus crosses only (null for di-/tri-hybrid). */
  punnett: Punnett | null;
}

/** Canonical ordering of an allele pair by the gene's declared allele order. */
function orderPair(gene: Gene, a: string, b: string): [string, string] {
  const idx = (s: string) => gene.alleles.findIndex((al) => al.symbol === s);
  return idx(a) <= idx(b) ? [a, b] : [b, a];
}

/** The distinct gametes a diploid parent can make at one locus (order-preserved). */
function gametesAt(pair: [string, string]): string[] {
  return pair[0] === pair[1] ? [pair[0]] : [pair[0], pair[1]];
}

/** Every distinct phenotype a single gene can express, across all its genotypes. */
function genePhenotypes(gene: Gene): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < gene.alleles.length; i++) {
    for (let j = i; j < gene.alleles.length; j++) {
      const a = gene.alleles[i]?.symbol as string;
      const b = gene.alleles[j]?.symbol as string;
      const p = genePhenotype(gene, orderPair(gene, a, b));
      if (!seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    }
  }
  return out;
}

/**
 * The full phenotype "vocabulary" a cross can produce — the Cartesian product of
 * each gene's possible looks. This is the set of multiple-choice options the
 * player picks from: it stays a real choice even when only one look actually
 * occurs (e.g. red × white snapdragons producing only pink), which is exactly
 * the surprising kind of round we want.
 */
function allPhenotypes(genes: Gene[]): string[] {
  let combos: string[] = [''];
  for (const gene of genes) {
    const looks = genePhenotypes(gene);
    const next: string[] = [];
    for (const combo of combos) {
      for (const look of looks) next.push(combo ? `${combo}, ${look}` : look);
    }
    combos = next;
  }
  return combos;
}

/** The phenotype a parent shows, across all active loci, as a joined label. */
function parentPhenotype(cross: Cross, parent: Record<string, [string, string]>): string {
  return cross.genes
    .map((gene) => {
      const raw = parent[gene.symbol];
      if (!raw) return '';
      return genePhenotype(gene, orderPair(gene, raw[0], raw[1]));
    })
    .filter(Boolean)
    .join(', ');
}

/** Build the parameters the `breeding` engine expects for this cross. */
export function buildBreedingParams(cross: Cross): Record<string, unknown> {
  return {
    genes: cross.genes,
    parentA: cross.parentA.genotype,
    parentB: cross.parentB.genotype,
    offspringCount: LITTER_SIZE,
    seed: cross.seed,
  };
}

function buildPunnett(cross: Cross): Punnett | null {
  if (cross.genes.length !== 1) return null;
  const gene = cross.genes[0] as Gene;
  const pa = cross.parentA.genotype[gene.symbol];
  const pb = cross.parentB.genotype[gene.symbol];
  if (!pa || !pb) return null;
  const gametesA = gametesAt(pa);
  const gametesB = gametesAt(pb);
  const cells = gametesA.map((ga) =>
    gametesB.map((gb) => {
      const pair = orderPair(gene, ga, gb);
      return { genotype: pair.join(''), phenotype: genePhenotype(gene, pair) };
    }),
  );
  return { gene, gametesA, gametesB, cells };
}

/** Run the deterministic engine and normalise it into everything the UI needs. */
export function solveCross(cross: Cross): SolvedCross {
  const result = runEngine('breeding', buildBreedingParams(cross));
  const detail = result.detail as BreedingDetail;

  const dist = detail.phenotypeDistribution;
  const probByLabel = new Map(dist.map((d) => [d.phenotype, d.probability]));

  // Options = the full phenotype vocabulary (a real multiple choice even when
  // one look dominates), each carrying its actual probability (0 if it can't occur).
  const options = allPhenotypes(cross.genes)
    .map((label) => ({ label, probability: probByLabel.get(label) ?? 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Ranked = only the looks that actually occur, most-likely first (reveal order).
  const ranked = [...dist].sort(
    (a, b) => b.probability - a.probability || a.phenotype.localeCompare(b.phenotype),
  );

  const top = ranked[0]?.probability ?? 0;
  const mostCommon = dist.filter((d) => d.probability >= top - 1e-9).map((d) => d.phenotype);

  const parentAPhenotype = parentPhenotype(cross, cross.parentA.genotype);
  const parentBPhenotype = parentPhenotype(cross, cross.parentB.genotype);
  const parentLooks = new Set([parentAPhenotype, parentBPhenotype]);
  const hiddenLooks = dist.map((d) => d.phenotype).filter((p) => !parentLooks.has(p));

  return {
    options,
    ranked: ranked.map((d) => ({ label: d.phenotype, probability: d.probability })),
    ratio: detail.phenotypicRatio,
    mostCommon,
    litter: detail.sampledOffspring.map((o) => ({ phenotype: o.phenotype, genotype: o.genotype })),
    parentAPhenotype,
    parentBPhenotype,
    hiddenLooks,
    punnett: buildPunnett(cross),
  };
}
