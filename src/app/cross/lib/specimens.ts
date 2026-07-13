/**
 * CrossLab specimen catalog — the "worlds" you breed in.
 *
 * A {@link Cross} is a fully-specified genetic cross: which gene loci are in
 * play and the genotype of each of the two parents. It reuses the deterministic
 * `breeding` engine's own {@link Gene} shape verbatim, so a cross is nothing but
 * a set of parameters the engine already knows how to run — no new genetics is
 * invented here, only friendly framing (a world, an emoji, plain-language names).
 *
 * The daily gauntlet is a pure function of the `YYYY-MM-DD` date, so everyone on
 * Earth breeds the same specimens on the same day and a streamer's round is
 * reproducible byte-for-byte by every viewer.
 *
 * Pure module: no clock, no RNG, no DOM. Deterministic everywhere.
 */

import type { Gene } from '@/lib/sim/genetics/breeding';

/** One parent: a friendly name plus its genotype (locus symbol → allele pair). */
export interface Parent {
  name: string;
  genotype: Record<string, [string, string]>;
}

/** A fully-specified genetic cross, ready to hand to the `breeding` engine. */
export interface Cross {
  /** Stable id — used for date-seeding, sharing, and localStorage keys. */
  id: string;
  /** The world this cross lives in, e.g. "Pea plants". */
  world: string;
  /** Base organism emoji, tinted per-phenotype in the UI. */
  emoji: string;
  /** One plain-language sentence framing what the player is about to do. */
  blurb: string;
  /** The gene loci active in this cross (1–3). */
  genes: Gene[];
  parentA: Parent;
  parentB: Parent;
  /** Seed for the offspring litter sample — stable so the litter is shareable. */
  seed: string;
}

// ---------------------------------------------------------------------------
// Gene definitions, grouped by world. Each is a real Mendelian locus.
// ---------------------------------------------------------------------------

const peaShape: Gene = {
  symbol: 'S',
  name: 'Seed shape',
  alleles: [
    { symbol: 'S', label: 'Round' },
    { symbol: 's', label: 'Wrinkled' },
  ],
  mode: 'complete',
  dominant: 'S',
};

const peaColour: Gene = {
  symbol: 'C',
  name: 'Pod colour',
  alleles: [
    { symbol: 'C', label: 'Green' },
    { symbol: 'c', label: 'Yellow' },
  ],
  mode: 'complete',
  dominant: 'C',
};

const dragonFire: Gene = {
  symbol: 'F',
  name: 'Fire',
  alleles: [
    { symbol: 'F', label: 'Fire-breathing' },
    { symbol: 'f', label: 'Smokeless' },
  ],
  mode: 'complete',
  dominant: 'F',
};

const dragonWings: Gene = {
  symbol: 'W',
  name: 'Wings',
  alleles: [
    { symbol: 'W', label: 'Winged' },
    { symbol: 'w', label: 'Wingless' },
  ],
  mode: 'complete',
  dominant: 'W',
};

const snapdragonPetal: Gene = {
  symbol: 'P',
  name: 'Petal colour',
  alleles: [
    { symbol: 'R', label: 'Crimson' },
    { symbol: 'W', label: 'White' },
  ],
  // Incomplete dominance: the heterozygote is an intermediate blend (pink).
  mode: 'incomplete',
};

const cattleCoat: Gene = {
  symbol: 'C',
  name: 'Coat colour',
  alleles: [
    { symbol: 'R', label: 'Red' },
    { symbol: 'W', label: 'White' },
  ],
  // Codominance: the heterozygote shows BOTH colours at once (roan).
  mode: 'codominant',
};

const mouseCoat: Gene = {
  symbol: 'A',
  name: 'Coat colour',
  alleles: [
    { symbol: 'A', label: 'Brown' },
    { symbol: 'a', label: 'White' },
  ],
  mode: 'complete',
  dominant: 'A',
};

// ---------------------------------------------------------------------------
// The curated cross pool. Every entry is validated in specimens.test.ts, which
// runs the real breeding engine to prove each cross has a well-defined answer
// and that a beginner-legible set of phenotype options exists.
// ---------------------------------------------------------------------------

export const CROSS_POOL: Cross[] = [
  {
    id: 'peas-monohybrid',
    world: 'Pea plants',
    emoji: '🌱',
    blurb:
      'Two round-seeded pea plants — but each secretly carries a wrinkled allele. Cross them: what do the seeds look like?',
    genes: [peaShape],
    parentA: { name: 'Round pea', genotype: { S: ['S', 's'] } },
    parentB: { name: 'Round pea', genotype: { S: ['S', 's'] } },
    seed: 'peas-monohybrid',
  },
  {
    id: 'peas-testcross',
    world: 'Pea plants',
    emoji: '🌱',
    blurb:
      'A round-seeded plant that carries a hidden wrinkled allele, crossed with a wrinkled plant. This "test cross" reveals the hidden allele.',
    genes: [peaShape],
    parentA: { name: 'Round pea', genotype: { S: ['S', 's'] } },
    parentB: { name: 'Wrinkled pea', genotype: { S: ['s', 's'] } },
    seed: 'peas-testcross',
  },
  {
    id: 'peas-dihybrid',
    world: 'Pea plants',
    emoji: '🌱',
    blurb:
      'Mendel’s famous two-trait cross: two plants, each round-seeded with green pods but carrying wrinkled and yellow alleles.',
    genes: [peaShape, peaColour],
    parentA: { name: 'Round green pea', genotype: { S: ['S', 's'], C: ['C', 'c'] } },
    parentB: { name: 'Round green pea', genotype: { S: ['S', 's'], C: ['C', 'c'] } },
    seed: 'peas-dihybrid',
  },
  {
    id: 'dragons-fire-testcross',
    world: 'Dragons',
    emoji: '🐉',
    blurb:
      'A fire-breathing dragon carrying a smokeless allele meets a smokeless mate. Will the hatchlings breathe fire?',
    genes: [dragonFire],
    parentA: { name: 'Fire dragon', genotype: { F: ['F', 'f'] } },
    parentB: { name: 'Smokeless dragon', genotype: { F: ['f', 'f'] } },
    seed: 'dragons-fire-testcross',
  },
  {
    id: 'dragons-dihybrid',
    world: 'Dragons',
    emoji: '🐉',
    blurb:
      'Two fire-breathing, winged dragons — each carrying hidden smokeless and wingless alleles. What hatches from the clutch?',
    genes: [dragonFire, dragonWings],
    parentA: { name: 'Fire-winged dragon', genotype: { F: ['F', 'f'], W: ['W', 'w'] } },
    parentB: { name: 'Fire-winged dragon', genotype: { F: ['F', 'f'], W: ['W', 'w'] } },
    seed: 'dragons-dihybrid',
  },
  {
    id: 'snapdragon-blend',
    world: 'Snapdragons',
    emoji: '🌸',
    blurb:
      'Snapdragons blend their colours. Cross a pure crimson flower with a pure white one — what colour bloom appears?',
    genes: [snapdragonPetal],
    parentA: { name: 'Crimson snapdragon', genotype: { P: ['R', 'R'] } },
    parentB: { name: 'White snapdragon', genotype: { P: ['W', 'W'] } },
    seed: 'snapdragon-blend',
  },
  {
    id: 'snapdragon-pink-cross',
    world: 'Snapdragons',
    emoji: '🌸',
    blurb:
      'Two pink snapdragons (each one crimson allele, one white). When blenders breed, the colours split apart again.',
    genes: [snapdragonPetal],
    parentA: { name: 'Pink snapdragon', genotype: { P: ['R', 'W'] } },
    parentB: { name: 'Pink snapdragon', genotype: { P: ['R', 'W'] } },
    seed: 'snapdragon-pink-cross',
  },
  {
    id: 'cattle-roan',
    world: 'Cattle',
    emoji: '🐮',
    blurb:
      'Cattle coats are codominant: a red and a white parent make a "roan" that shows both. Cross two roans — what herd results?',
    genes: [cattleCoat],
    parentA: { name: 'Roan cow', genotype: { C: ['R', 'W'] } },
    parentB: { name: 'Roan bull', genotype: { C: ['R', 'W'] } },
    seed: 'cattle-roan',
  },
  {
    id: 'mice-carriers',
    world: 'Mice',
    emoji: '🐭',
    blurb:
      'Two brown mice that each secretly carry a white allele. Can two brown parents ever have a white pup?',
    genes: [mouseCoat],
    parentA: { name: 'Brown mouse', genotype: { A: ['A', 'a'] } },
    parentB: { name: 'Brown mouse', genotype: { A: ['A', 'a'] } },
    seed: 'mice-carriers',
  },
];

/** Look up one cross by id. */
export function crossById(id: string): Cross | undefined {
  return CROSS_POOL.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Deterministic date-seeding (FNV-1a, matching daily-challenge.ts's approach).
// ---------------------------------------------------------------------------

/** 32-bit FNV-1a hash of a string — deterministic, dependency-free. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministically draw `count` DISTINCT crosses from the pool, seeded by
 * `seed`. Uses a seeded Fisher–Yates on the pool indices so the same seed
 * always yields the same ordered, no-repeat selection.
 */
function pickDistinct(seed: string, count: number): Cross[] {
  const idx = CROSS_POOL.map((_, i) => i);
  // Seeded shuffle: each swap partner is chosen from a per-position hash.
  for (let i = idx.length - 1; i > 0; i--) {
    const j = fnv1a(`${seed}#${i}`) % (i + 1);
    const tmp = idx[i] as number;
    idx[i] = idx[j] as number;
    idx[j] = tmp;
  }
  return idx.slice(0, Math.min(count, CROSS_POOL.length)).map((i) => CROSS_POOL[i] as Cross);
}

/** How many rounds are in a daily gauntlet. */
export const DAILY_ROUNDS = 4;

/**
 * The daily gauntlet for an ISO date: {@link DAILY_ROUNDS} distinct crosses,
 * the same for everyone on that UTC day. Only the `YYYY-MM-DD` prefix is used.
 */
export function dailyCrosses(dateISO: string): Cross[] {
  return pickDistinct(dateISO.slice(0, 10), DAILY_ROUNDS);
}

/**
 * The nth endless-mode cross (0-based). Deterministic per index, and may repeat
 * worlds — endless is for practice, not the shared daily.
 */
export function endlessCross(index: number): Cross {
  const i = fnv1a(`endless#${index}`) % CROSS_POOL.length;
  return CROSS_POOL[i] as Cross;
}
