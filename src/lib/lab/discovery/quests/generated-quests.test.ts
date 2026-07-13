import { describe, expect, it } from 'vitest';
import { regimeAt } from '../core';
import { generatedLandmarks } from './all-generated';

// Each generated quest was authored + verified against the real engine by the
// quest-authoring workflow. These tests RE-VERIFY every landmark (params →
// regime) independently, through runEngine — the golden-rule safety net that
// catches any wrong metric key, threshold, or landmark before it can ship.
describe('generated discovery quests', () => {
  it('at least one quest was generated', () => {
    expect(generatedLandmarks.length).toBeGreaterThanOrEqual(1);
  });

  for (const { quest, landmarks } of generatedLandmarks) {
    describe(quest.title, () => {
      it('is well-formed (axes, probe signal, catalogue, targets)', () => {
        expect(quest.axes.length).toBeGreaterThanOrEqual(1);
        expect(quest.probeSignal.metric.length).toBeGreaterThan(0);
        expect(quest.knownCatalog.length).toBeGreaterThanOrEqual(1);
        expect(quest.targets.length).toBeGreaterThanOrEqual(1);
        expect(landmarks.length).toBeGreaterThanOrEqual(4);
      });

      for (const lm of landmarks) {
        it(`${JSON.stringify(lm.axisValues)} is classified as "${lm.expectedRegimeId}"`, () => {
          expect(regimeAt(quest, lm.axisValues).id).toBe(lm.expectedRegimeId);
        });
      }

      it('never leaves a landmark unclassified (rules cover the space)', () => {
        for (const lm of landmarks) {
          expect(regimeAt(quest, lm.axisValues).id).not.toBe('unclassified');
        }
      });
    });
  }
});
