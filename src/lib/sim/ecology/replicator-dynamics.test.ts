import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { classifyGame, run } from './replicator-dynamics';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('replicator-dynamics', () => {
  it('classifies Hawk–Dove as coexistence with a stable mixed ESS at x*=0.5', () => {
    const g = classifyGame(-1, 2, 0, 1, 0.2); // V=2, C=4
    expect(g.type).toBe('coexistence');
    expect(g.interior).toBeCloseTo(0.5, 10);
    expect(g.essFractionA).toBeCloseTo(0.5, 10);
  });

  it('classifies the Stag Hunt as bistable with an unstable threshold, outcome set by x0', () => {
    // Stag=A, Hare=B: SS=4, SH=0, HS=3, HH=3 → threshold x*=0.75.
    const below = classifyGame(4, 0, 3, 3, 0.2);
    const above = classifyGame(4, 0, 3, 3, 0.9);
    expect(below.type).toBe('bistable');
    expect(below.interior).toBeCloseTo(0.75, 10);
    expect(below.essFractionA).toBe(0); // start below threshold → all Hare
    expect(above.essFractionA).toBe(1); // start above threshold → all Stag
  });

  it('classifies the Prisoner’s Dilemma as dominance of defection (B), no interior point', () => {
    // Cooperate=A, Defect=B: CC=3, CD=0, DC=5, DD=1.
    const g = classifyGame(3, 0, 5, 1, 0.5);
    expect(g.type).toBe('dominance-B');
    expect(g.interior).toBeNull();
    expect(g.essFractionA).toBe(0);
  });

  it('classifies equal payoffs as a neutral game that never moves', () => {
    const g = classifyGame(1, 1, 1, 1, 0.37);
    expect(g.type).toBe('neutral');
    expect(g.essFractionA).toBe(0.37); // stays put at x0
    const r = run({ aa: 1, ab: 1, ba: 1, bb: 1, x0: 0.37 });
    expect(metric(r, 'finalFraction')).toBeCloseTo(0.37, 6);
  });

  it('converges to the Hawk–Dove mixed ESS from a low start', () => {
    const r = run({ aa: -1, ab: 2, ba: 0, bb: 1, x0: 0.05, tEnd: 200 });
    expect(metric(r, 'gameType')).toBe(3); // coexistence
    expect(metric(r, 'finalFraction')).toBeCloseTo(0.5, 3);
  });

  it('drives a dominant strategy to fixation (A wins)', () => {
    // A strictly dominates: beats B against either opponent.
    const r = run({ aa: 3, ab: 3, ba: 0, bb: 0, x0: 0.1, tEnd: 200 });
    expect(metric(r, 'gameType')).toBe(1); // dominance-A
    expect(metric(r, 'finalFraction')).toBeGreaterThan(0.99);
  });

  it('keeps the fraction within [0, 1]', () => {
    const r = run({ aa: 2, ab: -1, ba: -1, bb: 2, x0: 0.5 }); // bistable, knife-edge
    for (const s of r.series ?? []) {
      for (const v of s.y.fractionA) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('replicator-dynamics', { aa: -1, ab: 2, ba: 0, bb: 1 });
    const b = runEngine('replicator-dynamics', { aa: -1, ab: 2, ba: 0, bb: 1 });
    expect(a).toEqual(b);
  });
});
