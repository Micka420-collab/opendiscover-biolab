import { describe, expect, it } from 'vitest';
import { regimeAt } from '../core';
import {
  fitzhughNagumoExcitabilityMapLandmarks as landmarks,
  fitzhughNagumoExcitabilityMap as quest,
} from './fitzhugh-nagumo-excitability-map';

// A two-axis (I, a) quest. Every landmark below was verified against the real
// FitzHugh–Nagumo engine before being written; these tests re-verify each one
// through runEngine — and confirm the spiking region is genuinely 2D (the same
// current is spiking at one a and silent at another).
describe('discovery — FitzHugh–Nagumo excitability map (2D)', () => {
  it('has two tunable axes', () => {
    expect(quest.axes).toHaveLength(2);
    expect(quest.axes.map((a) => a.key).sort()).toEqual(['a', 'current']);
  });

  for (const lm of landmarks) {
    it(`I=${lm.axisValues.current}, a=${lm.axisValues.a} → ${lm.expectedRegimeId}`, () => {
      expect(regimeAt(quest, lm.axisValues).id).toBe(lm.expectedRegimeId);
    });
  }

  it('the spiking island is truly 2D: current 0 spikes at a=0.4 but rests at a=0.7', () => {
    // If the regime depended on current alone, these two would agree — they don't,
    // which is what makes this a 2D hunt rather than a disguised 1D slider.
    expect(regimeAt(quest, { current: 0, a: 0.4 }).id).toBe('repetitive-spiking');
    expect(regimeAt(quest, { current: 0, a: 0.7 }).id).toBe('resting');
  });

  it('depolarization-block is the off-catalogue (novel) regime', () => {
    expect(quest.knownCatalog.some((k) => k.id === 'depolarization-block')).toBe(false);
    expect(regimeAt(quest, { current: 2, a: 0.7 }).id).toBe('depolarization-block');
  });
});
