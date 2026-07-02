import { SHARE_PARAM, decodeExperiment } from '@/lib/lab/share';
import { runEngine } from '@/lib/sim';
import { describe, expect, it } from 'vitest';
import { galleryEntries } from './index';

describe('community gallery', () => {
  it('loads at least one validated entry', () => {
    expect(galleryEntries.length).toBeGreaterThan(0);
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
