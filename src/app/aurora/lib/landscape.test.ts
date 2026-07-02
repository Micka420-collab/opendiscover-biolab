import { CHALLENGE_POOL } from '@/lib/lab/daily-challenge';
import { runEngine } from '@/lib/sim';
import { describe, expect, it } from 'vitest';
import { autoTune, sampleLandscape, valueAtKnob } from './landscape';

describe('aurora landscape', () => {
  it('the auto-tuner clears the pool bar for every challenge (the game is winnable)', () => {
    for (const c of CHALLENGE_POOL) {
      const sol = autoTune(c, runEngine);
      expect(sol.met, `${c.id} should be winnable`).toBe(true);
      expect(Number.isFinite(sol.value), c.id).toBe(true);
    }
  });

  it('samples a finite, drawable landscape with clamped signals for every challenge', () => {
    for (const c of CHALLENGE_POOL) {
      const land = sampleLandscape(c, runEngine, 48);
      expect(land.samples, c.id).toHaveLength(48);
      expect(Number.isFinite(land.yDomain[0]), c.id).toBe(true);
      expect(Number.isFinite(land.yDomain[1]), c.id).toBe(true);
      expect(land.yDomain[1]).toBeGreaterThan(land.yDomain[0]);
      for (const s of land.samples) {
        expect(Number.isFinite(s.signal), c.id).toBe(true);
        expect(s.signal).toBeGreaterThanOrEqual(0);
        expect(s.signal).toBeLessThanOrEqual(1);
      }
      const mid = (c.knob.min + c.knob.max) / 2;
      expect(Number.isFinite(valueAtKnob(land, mid)), c.id).toBe(true);
      expect(land.marker, c.id).not.toBeNull();
    }
  });

  it('dense sampling surfaces a pass band for the large majority of rounds', () => {
    // The authoritative winnability guarantee is the auto-tuner test above (fine step).
    // Here we only sanity-check that 72-sample drawing surfaces a visible pass band for
    // most rounds — a few bands are narrower than 1/72 of the range and are reachable
    // only via the fine-step auto-tuner, which is expected.
    let withBand = 0;
    for (const c of CHALLENGE_POOL) {
      if (sampleLandscape(c, runEngine, 72).passBands.length > 0) withBand++;
    }
    expect(withBand).toBeGreaterThan(CHALLENGE_POOL.length * 0.6);
  });
});
