import { SHARE_PARAM, decodeExperiment } from '@/lib/lab/share';
import { runEngine } from '@/lib/sim';
import { describe, expect, it } from 'vitest';
import { galleryByDomain, galleryEntries } from './index';

describe('community gallery', () => {
  it('loads at least one validated entry', () => {
    expect(galleryEntries.length).toBeGreaterThan(0);
  });

  it('galleryByDomain partitions every entry exactly once, grouped by its domain', () => {
    const groups = galleryByDomain();
    const flat = groups.flatMap((g) => g.entries);
    expect(flat.length).toBe(galleryEntries.length); // no drops
    expect(new Set(flat.map((e) => e.slug)).size).toBe(galleryEntries.length); // no dupes
    for (const g of groups) {
      expect(g.entries.length).toBeGreaterThan(0);
      for (const e of g.entries) expect(e.domain).toBe(g.domain);
    }
  });

  for (const entry of galleryEntries) {
    it(`${entry.slug}: share link round-trips and the run executes`, () => {
      const token = new URL(`https://x${entry.sharePath}`).searchParams.get(SHARE_PARAM);
      expect(decodeExperiment(token)).toEqual({ engine: entry.engine, params: entry.params });

      // "Open in Lab" must resolve to a real, runnable experiment.
      const result = runEngine(entry.engine, entry.params);
      expect(result.metrics.length).toBeGreaterThan(0);
    });
  }
});
