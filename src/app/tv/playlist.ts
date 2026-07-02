import type { GalleryEntry } from '@/content/gallery';
import { experimentSharePath } from '@/lib/lab/share';

/** One item on the Lab TV auto-cycle. Shared by the page, the client, and tests. */
export interface PlaylistItem {
  engine: string;
  params: Record<string, unknown>;
  title: string;
  author: string;
  blurb: string;
  engineTitle: string;
  sharePath: string;
}

/** The engine-registry fields Lab TV needs to synthesize a filler item. */
interface EngineSummary {
  slug: string;
  title: string;
  description: string;
  example: Record<string, unknown>;
}

/**
 * Build the Lab TV playlist: every curated gallery entry first, then a synthesized
 * filler for each engine that has NO gallery entry — using the engine's own
 * `example` params, which are guaranteed runnable. This way the hands-off showcase
 * cycles the WHOLE catalog (every engine appears at least once), not just the
 * curated subset, while curated runs still lead. Pure and unit-testable.
 */
export function buildPlaylist(
  galleryEntries: readonly GalleryEntry[],
  engines: readonly EngineSummary[],
): PlaylistItem[] {
  const curated: PlaylistItem[] = galleryEntries.map((e) => ({
    engine: e.engine,
    params: e.params,
    title: e.title,
    author: e.author,
    blurb: e.blurb,
    engineTitle: e.engineTitle,
    sharePath: e.sharePath,
  }));

  const covered = new Set(curated.map((i) => i.engine));
  const fillers: PlaylistItem[] = engines
    .filter((spec) => !covered.has(spec.slug))
    .map((spec) => ({
      engine: spec.slug,
      params: spec.example,
      title: spec.title,
      author: 'OpenDiscover',
      blurb: spec.description,
      engineTitle: spec.title,
      sharePath: experimentSharePath({ engine: spec.slug, params: spec.example }),
    }));

  return [...curated, ...fillers];
}

/** xmur3 string hash → a 32-bit seed for the PRNG. */
function xmur3(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32 — a tiny deterministic PRNG in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher–Yates shuffle keyed by a string seed. Same seed → same
 * permutation (stable within a day when seeded by the date); different seeds →
 * a different order. Returns a NEW array; the input is never mutated.
 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const rand = mulberry32(xmur3(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * The daily Lab TV playlist: full-catalog coverage (via {@link buildPlaylist}),
 * with curated gallery runs still leading, each group independently shuffled by the
 * day seed so the channel opens on a different experiment each day without ever
 * dropping an engine. Pure.
 */
export function dailyPlaylist(
  galleryEntries: readonly GalleryEntry[],
  engines: readonly EngineSummary[],
  seed: string,
): PlaylistItem[] {
  const full = buildPlaylist(galleryEntries, engines);
  const curatedCount = galleryEntries.length;
  const curated = seededShuffle(full.slice(0, curatedCount), seed);
  const fillers = seededShuffle(full.slice(curatedCount), `${seed}:fillers`);
  return [...curated, ...fillers];
}
