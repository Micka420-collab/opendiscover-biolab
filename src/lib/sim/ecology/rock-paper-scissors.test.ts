import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { payoff, run } from './rock-paper-scissors';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('rock-paper-scissors', () => {
  it('has the correct cyclic payoff structure', () => {
    // Rock(0) beats Scissors(2), loses to Paper(1); ties are 0.
    expect(payoff(0, 2, 1, 1)).toBe(1);
    expect(payoff(0, 1, 1, 1)).toBe(-1);
    expect(payoff(1, 0, 1, 1)).toBe(1); // Paper beats Rock
    expect(payoff(2, 1, 1, 1)).toBe(1); // Scissors beats Paper
    expect(payoff(1, 1, 1, 1)).toBe(0);
  });

  it('conserves V = xR·xP·xS in the zero-sum case (a = b)', () => {
    const r = run({ winPayoff: 1, lossPayoff: 1 });
    expect(metric(r, 'conservedDriftPct')).toBeLessThan(1);
    expect(metric(r, 'stabilityIndex')).toBe(0);
  });

  it('keeps the simplex sum at 1', () => {
    const r = run({});
    const s = (r.series ?? [])[0];
    for (let k = 0; k < s.x.length; k++) {
      expect((s.y.rock[k] ?? 0) + (s.y.paper[k] ?? 0) + (s.y.scissors[k] ?? 0)).toBeCloseTo(1, 6);
    }
  });

  it('spirals to the center when a > b', () => {
    const r = run({ winPayoff: 1.5, lossPayoff: 1, tEnd: 600 });
    const s = (r.series ?? [])[0];
    const last = s.x.length - 1;
    expect(Math.abs((s.y.rock[last] ?? 0) - 1 / 3)).toBeLessThan(0.08);
    expect(Math.abs((s.y.paper[last] ?? 0) - 1 / 3)).toBeLessThan(0.08);
  });

  it('spirals out toward the edges when a < b', () => {
    const r = run({ winPayoff: 1, lossPayoff: 1.5, tEnd: 300 });
    expect(metric(r, 'minFrequency')).toBeLessThan(0.02);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('rock-paper-scissors', { winPayoff: 1, lossPayoff: 1.2 });
    const b = runEngine('rock-paper-scissors', { winPayoff: 1, lossPayoff: 1.2 });
    expect(a).toEqual(b);
  });
});
