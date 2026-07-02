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
