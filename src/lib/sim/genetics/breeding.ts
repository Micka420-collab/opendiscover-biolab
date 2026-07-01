/**
 * Mendelian breeding / genetic-crossing engine.
 *
 * Cross two diploid parents across one or more independent gene loci and get the
 * full offspring genotype and phenotype distributions — a generalised Punnett
 * square — plus a seeded sample of concrete offspring. Supports the three
 * classical dominance modes:
 *
 *   - complete      — one allele masks the other (classic 3:1 / 9:3:3:1 ratios)
 *   - incomplete    — heterozygote is an intermediate blend (1:2:1)
 *   - codominant    — heterozygote expresses both alleles jointly (1:2:1)
 *
 * Genes assort independently (Mendel's second law). Two-locus linkage with a
 * recombination frequency is provided separately via `recombinantGametes` for
 * test-cross analysis. Everything is a pure function of the parameters; the only
 * randomness is the offspring sample, drawn from the shared seeded PRNG.
 *
 * References:
 *   - Mendel G. (1866). Versuche über Pflanzen-Hybriden.
 *   - Griffiths et al. "Introduction to Genetic Analysis" — Punnett squares,
 *     dominance relationships, independent assortment, linkage & recombination.
 */

import { z } from 'zod';
import { createRng } from '../core/prng';
import { provenance } from '../core/types';
import type { EngineSpec, SimResult } from '../core/types';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

const alleleSchema = z.object({
  /** Short allele symbol, e.g. "A" or "a". */
  symbol: z.string().min(1),
  /** Human phenotype label this allele contributes, e.g. "Round". */
  label: z.string().min(1),
});

const geneSchema = z.object({
  /** Locus symbol, e.g. "A". */
  symbol: z.string().min(1),
  /** Human name, e.g. "Seed shape". */
  name: z.string().default(''),
  /** The alleles at this locus (exactly two are supported for `complete`). */
  alleles: z.array(alleleSchema).min(2),
  /** Dominance relationship between the alleles. */
  mode: z.enum(['complete', 'incomplete', 'codominant']).default('complete'),
  /** For `complete`: which allele symbol is dominant (defaults to alleles[0]). */
  dominant: z.string().optional(),
});

const genotypeSchema = z.record(z.tuple([z.string(), z.string()]));

export const breedingParams = z.object({
  /** Gene loci in play. */
  genes: z.array(geneSchema).min(1).max(5),
  /** Parent A genotype: locus symbol → [allele, allele]. */
  parentA: genotypeSchema,
  /** Parent B genotype: locus symbol → [allele, allele]. */
  parentB: genotypeSchema,
  /** How many concrete offspring to sample (seeded). */
  offspringCount: z.number().int().min(0).max(1000).default(12),
  /** RNG seed for the offspring sample. */
  seed: z.union([z.string(), z.number()]).default('breeding'),
});

export type BreedingParams = z.input<typeof breedingParams>;
type Gene = z.infer<typeof geneSchema>;

export interface BreedingDetail {
  phenotypeDistribution: { phenotype: string; probability: number }[];
  genotypeDistribution: { genotype: string; probability: number }[];
  phenotypicRatio: string;
  sampledOffspring: { genotype: string; phenotype: string }[];
}

// ---------------------------------------------------------------------------
// Core genetics
// ---------------------------------------------------------------------------

/** Canonical ordering of an allele pair by the gene's declared allele order. */
function orderPair(gene: Gene, a: string, b: string): [string, string] {
  const idx = (s: string) => gene.alleles.findIndex((al) => al.symbol === s);
  return idx(a) <= idx(b) ? [a, b] : [b, a];
}

function alleleLabel(gene: Gene, symbol: string): string {
  return gene.alleles.find((a) => a.symbol === symbol)?.label ?? symbol;
}

/** Phenotype expressed by one genotype at one locus, per its dominance mode. */
export function genePhenotype(gene: Gene, pair: [string, string]): string {
  const [x, y] = pair;
  if (gene.mode === 'complete') {
    const dom = gene.dominant ?? gene.alleles[0].symbol;
    if (x === dom || y === dom) return alleleLabel(gene, dom);
    // Neither allele dominant → recessive homozygote (or a second recessive allele).
    return alleleLabel(gene, x);
  }
  if (x === y) return alleleLabel(gene, x);
  const la = alleleLabel(gene, x);
  const lb = alleleLabel(gene, y);
  return gene.mode === 'incomplete' ? `${la}-${lb}` : `${la}/${lb}`;
}

/** Offspring genotype distribution at ONE locus from two parent allele pairs. */
export function crossLocus(
  gene: Gene,
  parent: [string, string],
  other: [string, string],
): Map<string, number> {
  const dist = new Map<string, number>();
  for (const gA of parent) {
    for (const gB of other) {
      const [a, b] = orderPair(gene, gA, gB);
      const key = `${a}${b}`;
      dist.set(key, (dist.get(key) ?? 0) + 0.25);
    }
  }
  return dist;
}

/**
 * Two-locus gamete frequencies under linkage with recombination frequency `r`.
 * `phase` gives the parent's coupling, e.g. [["A","B"],["a","b"]] (cis). Parental
 * gametes each get (1−r)/2, recombinant gametes each get r/2. r=0.5 recovers
 * independent assortment.
 */
export function recombinantGametes(
  phase: [[string, string], [string, string]],
  r: number,
): { gamete: [string, string]; frequency: number }[] {
  const [[a1, b1], [a2, b2]] = phase;
  const p = (1 - r) / 2;
  const q = r / 2;
  return [
    { gamete: [a1, b1], frequency: p },
    { gamete: [a2, b2], frequency: p },
    { gamete: [a1, b2], frequency: q },
    { gamete: [a2, b1], frequency: q },
  ];
}

/** Reduce a set of probabilities to an approximate small-integer ratio string. */
function ratioString(probs: number[]): string {
  const min = Math.min(...probs.filter((p) => p > 1e-9));
  if (!Number.isFinite(min) || min <= 0) return probs.map(() => 1).join(':');
  return probs.map((p) => Math.round(p / min)).join(':');
}

// ---------------------------------------------------------------------------
// Engine entry point
// ---------------------------------------------------------------------------

function run(rawParams: BreedingParams): SimResult<BreedingDetail> {
  const p = breedingParams.parse(rawParams);

  // Per-locus offspring distributions.
  const perLocus = p.genes.map((gene) => {
    const pa = p.parentA[gene.symbol];
    const pb = p.parentB[gene.symbol];
    if (!pa || !pb) {
      throw new Error(`Both parents must carry a genotype for locus "${gene.symbol}".`);
    }
    return { gene, dist: crossLocus(gene, pa, pb) };
  });

  // Combine loci by independent assortment (Cartesian product of distributions).
  let combos: { genotype: Record<string, string>; probability: number }[] = [
    { genotype: {}, probability: 1 },
  ];
  for (const { gene, dist } of perLocus) {
    const next: typeof combos = [];
    for (const combo of combos) {
      for (const [pair, prob] of dist) {
        next.push({
          genotype: { ...combo.genotype, [gene.symbol]: pair },
          probability: combo.probability * prob,
        });
      }
    }
    combos = next;
  }

  const genotypeLabel = (g: Record<string, string>) =>
    p.genes.map((gene) => g[gene.symbol]).join(' ');
  const phenotypeLabel = (g: Record<string, string>) =>
    p.genes
      .map((gene) => {
        const pair = g[gene.symbol];
        return genePhenotype(gene, [pair[0], pair[1]] as [string, string]);
      })
      .join(', ');

  // Aggregate phenotype distribution.
  const phenoMap = new Map<string, number>();
  for (const c of combos) {
    const ph = phenotypeLabel(c.genotype);
    phenoMap.set(ph, (phenoMap.get(ph) ?? 0) + c.probability);
  }

  const genotypeDistribution = combos
    .map((c) => ({ genotype: genotypeLabel(c.genotype), probability: c.probability }))
    .sort((a, b) => b.probability - a.probability);

  const phenotypeDistribution = [...phenoMap.entries()]
    .map(([phenotype, probability]) => ({ phenotype, probability }))
    .sort((a, b) => b.probability - a.probability);

  const phenotypicRatio = ratioString(phenotypeDistribution.map((d) => d.probability));

  // Seeded offspring sample, drawn from the genotype distribution.
  const rng = createRng(p.seed);
  const genos = combos.map((c) => c.genotype);
  const weights = combos.map((c) => c.probability);
  const sampledOffspring = Array.from({ length: p.offspringCount }, () => {
    const g = rng.weightedPick(genos, weights);
    return { genotype: genotypeLabel(g), phenotype: phenotypeLabel(g) };
  });

  const top = phenotypeDistribution[0];

  return {
    engine: 'breeding',
    summary: `${genotypeLabel(
      Object.fromEntries(p.genes.map((g) => [g.symbol, (p.parentA[g.symbol] ?? []).join('')])),
    )} × ${genotypeLabel(
      Object.fromEntries(p.genes.map((g) => [g.symbol, (p.parentB[g.symbol] ?? []).join('')])),
    )} → ${phenotypeDistribution.length} phenotype(s) in ${phenotypicRatio}; most common "${top.phenotype}" (${(top.probability * 100).toFixed(1)}%).`,
    metrics: [
      {
        key: 'phenotypeClasses',
        label: 'Distinct phenotypes',
        value: phenotypeDistribution.length,
      },
      { key: 'genotypeClasses', label: 'Distinct genotypes', value: genotypeDistribution.length },
      {
        key: 'topPhenotypeProbability',
        label: 'Most-likely phenotype probability',
        value: top.probability,
      },
      { key: 'sampledOffspring', label: 'Sampled offspring', value: sampledOffspring.length },
    ],
    detail: { phenotypeDistribution, genotypeDistribution, phenotypicRatio, sampledOffspring },
    provenance: provenance('breeding', '1.0.0', p, p.seed),
  };
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

export const spec: EngineSpec<BreedingParams, BreedingDetail> = {
  slug: 'breeding',
  title: 'Mendelian Breeding & Genetic Crossing',
  domain: 'population-genetics',
  version: '1.0.0',
  description:
    'Cross two diploid parents across independent gene loci and get the full offspring genotype ' +
    'and phenotype distributions (a generalised Punnett square) plus a seeded sample of concrete ' +
    'offspring. Supports complete dominance (3:1, 9:3:3:1), incomplete dominance and codominance ' +
    '(1:2:1), and two-locus linkage with recombination for test-cross analysis.',
  references: [
    'Mendel G. (1866). Versuche über Pflanzen-Hybriden.',
    'Griffiths et al. Introduction to Genetic Analysis — Punnett squares, dominance, linkage.',
  ],
  tags: ['genetics', 'mendel', 'punnett', 'breeding', 'cross', 'game'],
  paramsSchema: breedingParams,
  example: {
    genes: [
      {
        symbol: 'A',
        name: 'Seed shape',
        alleles: [
          { symbol: 'A', label: 'Round' },
          { symbol: 'a', label: 'Wrinkled' },
        ],
        mode: 'complete',
        dominant: 'A',
      },
      {
        symbol: 'B',
        name: 'Seed colour',
        alleles: [
          { symbol: 'B', label: 'Yellow' },
          { symbol: 'b', label: 'Green' },
        ],
        mode: 'complete',
        dominant: 'B',
      },
    ],
    parentA: { A: ['A', 'a'], B: ['B', 'b'] },
    parentB: { A: ['A', 'a'], B: ['B', 'b'] },
    offspringCount: 16,
    seed: 'peas',
  },
  run,
};
