import { galleryEntries } from '@/content/gallery';
import { engines, getEngine, runEngine } from '@/lib/sim';
import { describe, expect, it } from 'vitest';
import { buildPlaylist, dailyPlaylist, seededShuffle } from './playlist';

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

describe('seededShuffle', () => {
  const src = Array.from({ length: 20 }, (_, i) => i);

  it('is deterministic: same seed → identical permutation', () => {
    expect(seededShuffle(src, '2026-07-02')).toEqual(seededShuffle(src, '2026-07-02'));
  });

  it('is a true permutation (same multiset, same length)', () => {
    const out = seededShuffle(src, 'abc');
    expect(out.length).toBe(src.length);
    expect([...out].sort((a, b) => a - b)).toEqual(src);
  });

  it('reorders across different seeds', () => {
    expect(seededShuffle(src, 'monday')).not.toEqual(seededShuffle(src, 'tuesday'));
  });

  it('does not mutate its input', () => {
    const copy = [...src];
    seededShuffle(src, 'x');
    expect(src).toEqual(copy);
  });
});

describe('dailyPlaylist', () => {
  it('preserves full 42-engine coverage after shuffling', () => {
    const pl = dailyPlaylist(galleryEntries, engines, '2026-07-02');
    const shown = new Set(pl.map((i) => i.engine));
    expect(shown.size).toBe(engines.length);
    expect(pl.length).toBe(buildPlaylist(galleryEntries, engines).length);
  });

  it('is stable within a day and reorders across days', () => {
    const a = dailyPlaylist(galleryEntries, engines, '2026-07-02');
    const a2 = dailyPlaylist(galleryEntries, engines, '2026-07-02');
    const b = dailyPlaylist(galleryEntries, engines, '2026-07-03');
    expect(a.map((i) => i.engine)).toEqual(a2.map((i) => i.engine));
    expect(a.map((i) => i.engine)).not.toEqual(b.map((i) => i.engine));
  });

  it('still leads with curated gallery items (before the fillers)', () => {
    const pl = dailyPlaylist(galleryEntries, engines, 'seed');
    const curatedEngines = new Set(galleryEntries.map((e) => e.engine));
    for (let i = 0; i < galleryEntries.length; i++) {
      expect(curatedEngines.has(pl[i]?.engine ?? '')).toBe(true);
    }
  });
});
