/**
 * Community experiment gallery — a PR-contributed, credited collection of
 * interesting deterministic runs.
 *
 * Each entry is ONE JSON file in this folder. At load time (build) every file is
 * validated twice: against the entry schema below, and against the target
 * engine's own Zod parameter schema. A bad slug or malformed params throws here,
 * which fails the build/CI — so a broken entry can never render. Contributing is
 * a one-file PR (see CONTRIBUTING.md); curation is the human merge review.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { experimentSharePath } from '@/lib/lab/share';
import { getEngine, listDomains } from '@/lib/sim';
import { z } from 'zod';

const entrySchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'slug must be kebab-case'),
  title: z.string().min(1),
  engine: z.string().min(1),
  params: z.record(z.unknown()),
  author: z.string().min(1),
  /** A profile URL or an @handle. */
  credit: z.string().min(1),
  blurb: z.string().min(1),
});

export interface GalleryEntry extends z.infer<typeof entrySchema> {
  /** `/lab/<engine>?x=<token>` — opens the exact run in the playground. */
  sharePath: string;
  domain: string;
  engineTitle: string;
}

function load(): GalleryEntry[] {
  const dir = join(process.cwd(), 'src/content/gallery');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  const entries = files.map((file) => {
    const raw = JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown;
    const parsed = entrySchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Gallery entry ${file} is invalid: ${parsed.error.message}`);
    }
    const entry = parsed.data;
    const spec = getEngine(entry.engine);
    if (!spec) {
      throw new Error(`Gallery entry ${file}: unknown engine "${entry.engine}".`);
    }
    // The params must be a valid run for that engine, or the "Open in Lab" link
    // would 422. Validate against the engine's own schema.
    const check = spec.paramsSchema.safeParse(entry.params);
    if (!check.success) {
      throw new Error(
        `Gallery entry ${file}: params do not satisfy the ${entry.engine} schema: ${check.error.message}`,
      );
    }
    return {
      ...entry,
      sharePath: experimentSharePath({ engine: entry.engine, params: entry.params }),
      domain: spec.domain,
      engineTitle: spec.title,
    } satisfies GalleryEntry;
  });

  return entries.sort((a, b) => a.engine.localeCompare(b.engine) || a.title.localeCompare(b.title));
}

export const galleryEntries: GalleryEntry[] = load();

/**
 * Gallery entries grouped by domain, in engine-catalog domain order (domains with
 * no entries are omitted). Pure over {@link galleryEntries}; a partition — every
 * entry appears exactly once.
 */
export function galleryByDomain(): { domain: string; entries: GalleryEntry[] }[] {
  const groups = new Map<string, GalleryEntry[]>();
  for (const entry of galleryEntries) {
    const list = groups.get(entry.domain) ?? [];
    list.push(entry);
    groups.set(entry.domain, list);
  }
  const order = listDomains();
  const known = order
    .filter((d) => groups.has(d))
    .map((domain) => ({ domain, entries: groups.get(domain) ?? [] }));
  // Defensive: any domain not in the registry order (shouldn't happen) still shows.
  const extra = [...groups.keys()]
    .filter((d) => !order.includes(d))
    .map((domain) => ({ domain, entries: groups.get(domain) ?? [] }));
  return [...known, ...extra];
}
