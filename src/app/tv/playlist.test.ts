import { galleryEntries } from '@/content/gallery';
import { engines, getEngine, runEngine } from '@/lib/sim';
import { describe, expect, it } from 'vitest';
import { buildPlaylist } from './playlist';

describe('Lab TV playlist', () => {
  const playlist = buildPlaylist(galleryEntries, engines);

  it('cycles every engine in the registry (no engine is invisible on the showcase)', () => {
    const shown = new Set(playlist.map((i) => i.engine));
    expect(shown.size).toBe(engines.length);
    for (const spec of engines) {
      expect(shown.has(spec.slug)).toBe(true);
    }
  });

  it('leads with the curated gallery entries, then appends fillers', () => {
    // The first galleryEntries.length items are exactly the curated ones, in order.
    for (let i = 0; i < galleryEntries.length; i++) {
      expect(playlist[i]?.engine).toBe(galleryEntries[i]?.engine);
    }
    expect(playlist.length).toBeGreaterThanOrEqual(engines.length);
  });

  it('every item has runnable params (validates + produces metrics)', () => {
    for (const item of playlist) {
      const spec = getEngine(item.engine);
      expect(spec, `unknown engine ${item.engine}`).toBeDefined();
      if (!spec) continue;
      expect(spec.paramsSchema.safeParse(item.params).success).toBe(true);
      const result = runEngine(item.engine, item.params);
      expect(result.metrics.length).toBeGreaterThan(0);
    }
  });

  it('every item carries the fields Lab TV renders', () => {
    for (const item of playlist) {
      expect(item.title).toBeTruthy();
      expect(item.blurb).toBeTruthy();
      expect(item.engineTitle).toBeTruthy();
      expect(item.author).toBeTruthy();
      expect(item.sharePath).toMatch(/^\/lab\//);
    }
  });
});
