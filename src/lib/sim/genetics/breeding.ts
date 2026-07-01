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
 * Genes assort independently (Mendel's second law) — `run()` always combines loci via
 * an independent Cartesian product (equivalent to unlinked loci / recombination
 * frequency r = 0.5). Two-locus linkage with an arbitrary recombination frequency is
 * available as a standalone helper, `recombinantGametes`, for test-cross gamete-frequency
 * analysis; it is not wired into the cross computation performed by `run()`. Everything is
 * a pure function of the parameters; the only randomness is the offspring sample, drawn
 * from the shared seeded PRNG.
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
  /**
   * Per-allele point-mutation probability applied to the SAMPLED offspring
   * only (0 = off, the default). A mutated allele copy is replaced by a
   * uniformly random *different* allele at that locus. This does NOT alter
   * `phenotypeDistribution` / `genotypeDistribution` / `phenotypicRatio`,
   * which remain the exact classical Mendelian calculation for the cross as
   * specified — mutation is an illustrative property of the individuals
   * actually drawn, not a change to the underlying cross's theory.
   */
  mutationRate: z.number().min(0).max(1).default(0),
  /** RNG seed for the offspring sample. */
  seed: z.union([z.string(), z.number()]).default('breeding'),
});

export type BreedingParams = z.input<typeof breedingParams>;
type Gene = z.infer<typeof geneSchema>;

export interface BreedingDetail {
  phenotypeDistribution: { phenotype: string; probability: number }[];
  genotypeDistribution: { genotype: string; probability: number }[];
  phenotypicRatio: string;
  sampledOffspring: { genotype: string; phenotype: string; mutatedLoci: string[] }[];
}

/**
 * With probability `rate`, replace `current` with a uniformly random
 * *different* allele symbol at this locus (a simple point-mutation model).
 * If the locus has only one allele defined, there is nothing to mutate to.
 */
function maybeMutateAllele(
  current: string,
  gene: Gene,
  rate: number,
  rng: ReturnType<typeof createRng>,
): string {
  if (rate <= 0 || !rng.bernoulli(rate)) return current;
  const others = gene.alleles.map((a) => a.symbol).filter((s) => s !== current);
  return others.length > 0 ? rng.pick(others) : current;
}

/** Apply independent per-allele mutation across every locus of a genotype. */
function mutateGenotype(
  genotype: Record<string, [string, string]>,
  genes: Gene[],
  rate: number,
  rng: ReturnType<typeof createRng>,
): { genotype: Record<string, [string, string]>; mutatedLoci: string[] } {
  const result: Record<string, [string, string]> = {};
  const mutatedLoci: string[] = [];
  for (const gene of genes) {
    const [a, b] = genotype[gene.symbol];
    const newA = maybeMutateAllele(a, gene, rate, rng);
    const newB = maybeMutateAllele(b, gene, rate, rng);
    // Re-canonicalize order (e.g. always "Aa", never "aA") so a mutated
    // genotype label is indistinguishable in style from an unmutated one.
    result[gene.symbol] = orderPair(gene, newA, newB);
    if (newA !== a || newB !== b) mutatedLoci.push(gene.symbol);
  }
  return { genotype: result, mutatedLoci };
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
      const pair = orderPair(gene, gA, gB);
      // Reversible key: JSON-encode the ordered pair rather than concatenate the two
      // allele symbols. Concatenation is lossy/ambiguous whenever a symbol is not
      // exactly one character (e.g. an ABO-style locus with "IA"/"IB"/"i"), since the
      // two symbols can no longer be recovered by splitting at a fixed character index.
      const key = JSON.stringify(pair);
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

// ---------------------------------------------------------------------------
// X-linked (sex-linked) inheritance — a standalone helper, like
// `recombinantGametes` above, not wired into `run()`'s autosomal Punnett-
// square machinery (a fundamentally different transmission mechanism).
// ---------------------------------------------------------------------------

export type Sex = 'female' | 'male';

export interface XLinkedOffspringClass {
  sex: Sex;
  /** Daughters: 2-character diploid genotype (e.g. "Aa"). Sons: the single
   * hemizygous allele they carry (e.g. "a") — they have no second X allele. */
  genotype: string;
  phenotype: string;
  /** Probability of this (sex, genotype) class, out of 1 across ALL classes. */
  probability: number;
}

/**
 * Cross one X-linked locus. The mother (XX) contributes one of her two
 * alleles, chosen with equal 50% probability, to EVERY offspring regardless
 * of sex. The father (XY) contributes his single X allele to every daughter
 * and his Y (no allele at this locus) to every son. A son therefore expresses
 * whatever single allele he receives directly (hemizygous — there is no
 * second copy to be dominant or recessive against), independent of the
 * gene's declared dominance `mode`.
 *
 * This reproduces the textbook X-linked recessive pattern (e.g. red-green
 * colour blindness, haemophilia): a carrier mother (heterozygous) crossed
 * with an unaffected father never has an affected daughter (every daughter
 * gets the father's normal allele), but 50% of her sons are affected.
 *
 * References:
 *   - Morgan TH (1910). "Sex limited inheritance in Drosophila." Science 32:120
 *     — the original white-eye X-linkage discovery.
 *   - Griffiths et al. "Introduction to Genetic Analysis" — X-linked inheritance.
 */
export function crossXLinked(
  gene: Gene,
  motherAlleles: readonly [string, string],
  fatherAllele: string,
): XLinkedOffspringClass[] {
  const merged = new Map<string, XLinkedOffspringClass>();
  const add = (sex: Sex, genotype: string, phenotype: string, probability: number) => {
    const key = `${sex}|${genotype}`;
    const existing = merged.get(key);
    if (existing) existing.probability += probability;
    else merged.set(key, { sex, genotype, phenotype, probability });
  };

  for (const motherAllele of motherAlleles) {
    // Daughter: [father's X, this maternal X] — normal diploid dominance applies.
    const daughterPair = orderPair(gene, fatherAllele, motherAllele);
    add('female', daughterPair.join(''), genePhenotype(gene, daughterPair), 0.25);
    // Son: just this maternal X (hemizygous) — expressed directly, no masking.
    add('male', motherAllele, alleleLabel(gene, motherAllele), 0.25);
  }

  return [...merged.values()].sort((a, b) => b.probability - a.probability);
}

// ---------------------------------------------------------------------------
// Epistasis — a standalone helper, like `recombinantGametes` and
// `crossXLinked` above, not wired into `run()`. Two independent biallelic
// complete-dominance loci are crossed via the existing `crossLocus` machinery,
// then the four dihybrid genotype classes are re-grouped into phenotype
// classes according to one of the four classical two-gene interaction
// patterns (each is a hand-derivable re-grouping of the standard 9:3:3:1
// dihybrid baseline: 9 A_B_ : 3 A_bb : 3 aaB_ : 1 aabb).
// ---------------------------------------------------------------------------

export type LocusExpression = 'dominant' | 'recessive';

export type EpistasisKind = 'recessive' | 'dominant' | 'duplicate-recessive' | 'duplicate-dominant';

export interface EpistasisClass {
  phenotype: string;
  probability: number;
}

function epistasisLabel(
  kind: EpistasisKind,
  aExpr: LocusExpression,
  bExpr: LocusExpression,
  domALabel: string,
  recALabel: string,
  domBLabel: string,
  recBLabel: string,
): string {
  switch (kind) {
    case 'recessive':
      // aa is epistatic to B: a recessive-A offspring shows ONLY the A-recessive
      // phenotype no matter what B is (9:3:4 — e.g. classic mouse albino epistasis).
      return aExpr === 'recessive'
        ? recALabel
        : `${domALabel}, ${bExpr === 'dominant' ? domBLabel : recBLabel}`;
    case 'dominant':
      // A_ is epistatic to B: a dominant-A offspring shows ONLY the A-dominant
      // phenotype no matter what B is (12:3:1 — e.g. summer squash fruit colour).
      return aExpr === 'dominant'
        ? domALabel
        : `${recALabel}, ${bExpr === 'dominant' ? domBLabel : recBLabel}`;
    case 'duplicate-recessive':
      // Complementary gene action: both loci need a dominant allele to produce
      // the combined phenotype; any recessive homozygote alone blocks it (9:7).
      return aExpr === 'dominant' && bExpr === 'dominant'
        ? `${domALabel} + ${domBLabel}`
        : `neither (${recALabel}/${recBLabel} pathway blocked)`;
    case 'duplicate-dominant':
      // Either locus's dominant allele alone is sufficient; only the double
      // recessive homozygote shows the alternate phenotype (15:1).
      return aExpr === 'dominant' || bExpr === 'dominant'
        ? `${domALabel} or ${domBLabel}`
        : `${recALabel}, ${recBLabel}`;
  }
}

/**
 * Cross two independent biallelic, complete-dominance loci and re-group the
 * resulting dihybrid genotype classes into phenotype classes under one of the
 * four classical epistasis (gene-interaction) patterns.
 *
 * References:
 *   - Griffiths et al. "Introduction to Genetic Analysis" — epistasis and
 *     modified dihybrid ratios (9:3:4, 12:3:1, 9:7, 15:1).
 */
export function crossEpistatic(
  geneA: Gene,
  geneB: Gene,
  parents: {
    parentA: { A: [string, string]; B: [string, string] };
    parentB: { A: [string, string]; B: [string, string] };
  },
  kind: EpistasisKind,
): EpistasisClass[] {
  const distA = crossLocus(geneA, parents.parentA.A, parents.parentB.A);
  const distB = crossLocus(geneB, parents.parentA.B, parents.parentB.B);

  const domA = geneA.dominant ?? geneA.alleles[0].symbol;
  const domB = geneB.dominant ?? geneB.alleles[0].symbol;
  const domALabel = alleleLabel(geneA, domA);
  const domBLabel = alleleLabel(geneB, domB);
  const recALabel = alleleLabel(
    geneA,
    geneA.alleles.find((a) => a.symbol !== domA)?.symbol ?? domA,
  );
  const recBLabel = alleleLabel(
    geneB,
    geneB.alleles.find((a) => a.symbol !== domB)?.symbol ?? domB,
  );

  const phenoMap = new Map<string, number>();
  for (const [keyA, pA] of distA) {
    const pairA = JSON.parse(keyA) as [string, string];
    const aExpr: LocusExpression = pairA.includes(domA) ? 'dominant' : 'recessive';
    for (const [keyB, pB] of distB) {
      const pairB = JSON.parse(keyB) as [string, string];
      const bExpr: LocusExpression = pairB.includes(domB) ? 'dominant' : 'recessive';
      const label = epistasisLabel(kind, aExpr, bExpr, domALabel, recALabel, domBLabel, recBLabel);
      phenoMap.set(label, (phenoMap.get(label) ?? 0) + pA * pB);
    }
  }

  return [...phenoMap.entries()]
    .map(([phenotype, probability]) => ({ phenotype, probability }))
    .sort((a, b) => b.probability - a.probability);
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
  // Each locus's genotype is kept as an actual [allele, allele] tuple (never
  // concatenated into a single string) so it can be handed straight to
  // `genePhenotype` without re-splitting by character position — see `crossLocus`.
  let combos: { genotype: Record<string, [string, string]>; probability: number }[] = [
    { genotype: {}, probability: 1 },
  ];
  for (const { gene, dist } of perLocus) {
    const next: typeof combos = [];
    for (const combo of combos) {
      for (const [key, prob] of dist) {
        const pair = JSON.parse(key) as [string, string];
        next.push({
          genotype: { ...combo.genotype, [gene.symbol]: pair },
          probability: combo.probability * prob,
        });
      }
    }
    combos = next;
  }

  const genotypeLabel = (g: Record<string, [string, string]>) =>
    p.genes.map((gene) => g[gene.symbol].join('')).join(' ');
  const phenotypeLabel = (g: Record<string, [string, string]>) =>
    p.genes.map((gene) => genePhenotype(gene, g[gene.symbol])).join(', ');

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

  // Seeded offspring sample, drawn from the genotype distribution. An optional
  // mutationRate perturbs only the sampled individuals (see BreedingDetail doc).
  const rng = createRng(p.seed);
  const genos = combos.map((c) => c.genotype);
  const weights = combos.map((c) => c.probability);
  const sampledOffspring = Array.from({ length: p.offspringCount }, () => {
    const drawn = rng.weightedPick(genos, weights);
    const { genotype: g, mutatedLoci } = mutateGenotype(drawn, p.genes, p.mutationRate, rng);
    return { genotype: genotypeLabel(g), phenotype: phenotypeLabel(g), mutatedLoci };
  });

  const top = phenotypeDistribution[0];

  return {
    engine: 'breeding',
    summary: `${genotypeLabel(
      Object.fromEntries(p.genes.map((g) => [g.symbol, p.parentA[g.symbol] ?? ['', '']])),
    )} × ${genotypeLabel(
      Object.fromEntries(p.genes.map((g) => [g.symbol, p.parentB[g.symbol] ?? ['', '']])),
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
    'offspring, with an optional per-allele mutation rate perturbing the sampled individuals shown ' +
    '(never the theoretical distribution). Supports complete dominance (3:1, 9:3:3:1), incomplete ' +
    "dominance and codominance (1:2:1) under independent assortment (Mendel's second law). A " +
    'separate standalone helper, `recombinantGametes`, computes two-locus linked-gene gamete ' +
    'frequencies for test-cross analysis; it is not used by this cross calculator, which always ' +
    'treats loci as unlinked. Another standalone helper, `crossXLinked`, computes X-linked/sex-' +
    'linked inheritance (sons are hemizygous — a fundamentally different transmission mechanism ' +
    'from the autosomal loci above); it is likewise not used by this cross calculator. A third ' +
    'standalone helper, `crossEpistatic`, re-groups a two-locus dihybrid cross into the four ' +
    'classical epistasis ratios (9:3:4 recessive, 12:3:1 dominant, 9:7 duplicate-recessive, 15:1 ' +
    "duplicate-dominant) — cross-locus gene interaction, distinct from this calculator's per-locus " +
    'independent phenotype reporting, and likewise not used by it.',
  references: [
    'Mendel G. (1866). Versuche über Pflanzen-Hybriden.',
    'Griffiths et al. Introduction to Genetic Analysis — Punnett squares, dominance, linkage, epistasis.',
    'Morgan TH (1910). Science 32:120 — X-linked inheritance (Drosophila white-eye).',
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
