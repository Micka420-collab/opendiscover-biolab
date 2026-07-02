/**
 * The daily AURORA gauntlet — the same five specimens for everyone on Earth.
 *
 * Selection is a pure function of the `YYYY-MM-DD` date string: a seeded shuffle of
 * CHALLENGE_POOL, first five distinct rounds. No clock, no RNG, no server — any
 * timestamp on the same UTC day yields the same gauntlet on every machine, so a
 * streamer and their chat play the identical run and share reproducible `?x=` links.
 *
 * The win bar for every round stays the pool's own `meetsBar`; this module only
 * chooses and orders rounds and tallies the (share-token-independent) score.
 */

import { CHALLENGE_POOL, type Challenge } from '@/lib/lab/daily-challenge';

export const GAUNTLET_SIZE = 5;

/** 32-bit FNV-1a — the same hash the daily challenge uses. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seeded PRNG (mulberry32) — deterministic, never Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The five (or fewer) date-seeded rounds, distinct, drawn only from the pool. */
export function buildGauntlet(dateISO: string, size = GAUNTLET_SIZE): Challenge[] {
  const day = dateISO.slice(0, 10);
  const rng = mulberry32(fnv1a(day));
  const idx = CHALLENGE_POOL.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = idx[i];
    idx[i] = idx[j];
    idx[j] = tmp;
  }
  const take = Math.max(1, Math.min(size, CHALLENGE_POOL.length));
  return idx.slice(0, take).map((i) => CHALLENGE_POOL[i] as Challenge);
}

export interface RoundScore {
  base: number;
  comboBonus: number;
  perfectBonus: number;
  total: number;
}

/**
 * Score one cleared round. A pure meta-layer over the game — combo and perfect
 * bonuses reward skill but NEVER enter the shareable `?x=` token (which encodes only
 * {engine, params}), so a shared run is judged purely by the engine, not the score.
 */
export function scoreRound({ combo, perfect }: { combo: number; perfect: boolean }): RoundScore {
  const base = 1000;
  const comboBonus = Math.max(0, combo - 1) * 250;
  const perfectBonus = perfect ? 500 : 0;
  return { base, comboBonus, perfectBonus, total: base + comboBonus + perfectBonus };
}
