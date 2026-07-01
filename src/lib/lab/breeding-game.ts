/**
 * Breeding game — a playful shell around the deterministic `breeding` engine.
 *
 * The engine does the genetics; this module supplies a curated, fun gene library
 * for a fictional bioluminescent lab creature ("Glowzoa"), a few starter
 * specimens to cross, and the small pure helpers the UI needs (rarity scoring,
 * new-phenotype discovery). Keeping the data + logic here (not in the React
 * component) means the game rules are unit-tested and reusable.
 */

export interface GameAllele {
  symbol: string;
  label: string;
}

export interface GameGene {
  symbol: string;
  name: string;
  alleles: GameAllele[];
  mode: 'complete' | 'incomplete' | 'codominant';
  dominant?: string;
}

export interface Specimen {
  id: string;
  name: string;
  emoji: string;
  /** locus symbol → [allele, allele]. */
  genotype: Record<string, [string, string]>;
}

/** The Glowzoa gene library — four loci, one per dominance flavour. */
export const GLOWZOA_GENES: GameGene[] = [
  {
    symbol: 'B',
    name: 'Body colour',
    mode: 'complete',
    dominant: 'B',
    alleles: [
      { symbol: 'B', label: 'Teal' },
      { symbol: 'b', label: 'Amber' },
    ],
  },
  {
    symbol: 'G',
    name: 'Bioluminescence',
    mode: 'incomplete',
    alleles: [
      { symbol: 'G', label: 'Radiant' },
      { symbol: 'g', label: 'Faint' },
    ],
  },
  {
    symbol: 'P',
    name: 'Membrane pattern',
    mode: 'complete',
    dominant: 'P',
    alleles: [
      { symbol: 'P', label: 'Spotted' },
      { symbol: 'p', label: 'Smooth' },
    ],
  },
  {
    symbol: 'F',
    name: 'Flagella',
    mode: 'codominant',
    alleles: [
      { symbol: 'F', label: 'Twin' },
      { symbol: 'f', label: 'Single' },
    ],
  },
];

/** Starter specimens the player can cross. */
export const STARTER_SPECIMENS: Specimen[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    emoji: '☄️',
    genotype: { B: ['B', 'b'], G: ['G', 'g'], P: ['P', 'p'], F: ['F', 'f'] },
  },
  {
    id: 'sundrop',
    name: 'Sundrop',
    emoji: '🌟',
    genotype: { B: ['b', 'b'], G: ['G', 'G'], P: ['p', 'p'], F: ['F', 'F'] },
  },
  {
    id: 'nightshade',
    name: 'Nightshade',
    emoji: '🌙',
    genotype: { B: ['B', 'B'], G: ['g', 'g'], P: ['P', 'P'], F: ['f', 'f'] },
  },
  {
    id: 'prism',
    name: 'Prism',
    emoji: '🔮',
    genotype: { B: ['B', 'b'], G: ['G', 'G'], P: ['P', 'p'], F: ['F', 'f'] },
  },
];

export interface CrossOptions {
  offspringCount?: number;
  seed?: string | number;
  genes?: GameGene[];
}

/** Build the `breeding` engine params object for crossing two specimens. */
export function buildCrossParams(a: Specimen, b: Specimen, opts: CrossOptions = {}) {
  const genes = opts.genes ?? GLOWZOA_GENES;
  return {
    genes,
    parentA: a.genotype,
    parentB: b.genotype,
    offspringCount: opts.offspringCount ?? 8,
    seed: opts.seed ?? `${a.id}x${b.id}`,
  };
}

/**
 * Promote one sampled offspring (the engine's space-joined "Bb Gg Pp Ff"
 * genotype string, one 2-character token per locus, in `genes` order) into a
 * full `Specimen` that can be bred again — multi-generation play (F1 x F1,
 * or F1 x a starter). Safe because every Glowzoa allele symbol is a single
 * character; this is NOT a general parser for arbitrary (possibly
 * multi-character) allele symbols the underlying engine also supports.
 */
export function offspringToSpecimen(
  offspring: { genotype: string; phenotype: string },
  id: string,
  name: string,
  emoji: string,
  genes: GameGene[] = GLOWZOA_GENES,
): Specimen {
  const tokens = offspring.genotype.split(' ');
  if (tokens.length !== genes.length) {
    throw new Error(
      `genotype "${offspring.genotype}" has ${tokens.length} loci, expected ${genes.length}`,
    );
  }
  const genotype: Record<string, [string, string]> = {};
  genes.forEach((gene, i) => {
    const token = tokens[i];
    if (token.length !== 2) {
      throw new Error(`locus "${gene.symbol}" token "${token}" is not exactly 2 characters`);
    }
    genotype[gene.symbol] = [token[0], token[1]];
  });
  return { id, name, emoji, genotype };
}

/**
 * Rarity score for a phenotype: the reciprocal of its probability, so a 1-in-16
 * offspring scores 16 and a common one scores low. Clamped to keep the UI sane.
 */
export function rarityScore(probability: number): number {
  if (!Number.isFinite(probability) || probability <= 0) return 999;
  return Math.min(999, Math.max(1, Math.round(1 / probability)));
}

/** A qualitative rarity tier for colouring the UI. */
export function rarityTier(score: number): 'common' | 'uncommon' | 'rare' | 'legendary' {
  if (score >= 32) return 'legendary';
  if (score >= 12) return 'rare';
  if (score >= 4) return 'uncommon';
  return 'common';
}

/** Which of `phenotypes` are not yet in `known` (deduped, order preserved). */
export function discoverNew(known: Iterable<string>, phenotypes: string[]): string[] {
  const seen = new Set(known);
  const fresh: string[] = [];
  for (const p of phenotypes) {
    if (!seen.has(p)) {
      seen.add(p);
      fresh.push(p);
    }
  }
  return fresh;
}
