import { describe, expect, it } from 'vitest';
import { claim, probe, questParams, regimeAt } from './core';
import { getQuest, listQuests } from './index';
import { logisticRoadToChaos as quest } from './quests/logistic-road-to-chaos';

// Every expected regime below was verified against the real logistic-map engine
// (through runEngine, with this quest's exact fixed params) and matches the
// textbook bifurcation landmarks — the golden rule for this project.
describe('discovery — logistic Road to Chaos classification', () => {
  const cases: [number, string][] = [
    [0.8, 'extinction'], // r < 1: population dies out
    [2.5, 'fixed-point'], // stable equilibrium x* = 0.6
    [3.2, 'period-2'], // first period-doubling
    [3.5, 'period-4'], // second doubling
    [3.55, 'period-8'], // third doubling
    [3.58, 'chaos'], // past the Feigenbaum point (~3.5699)
    [3.84, 'period-3-window'], // the famous Li–Yorke window
    [3.9, 'chaos'],
    [4.0, 'full-chaos'], // λ = ln 2 exactly
    [3.739, 'period-5-window'], // a rare odd window (NOT catalogued ⇒ novel)
    [3.627, 'period-6-window'], // another rare window (novel)
  ];
  for (const [r, expected] of cases) {
    it(`r=${r} is classified as "${expected}"`, () => {
      expect(regimeAt(quest, { r }).id).toBe(expected);
    });
  }

  it('full-chaos at r=4 reports a Lyapunov exponent of exactly ln 2', () => {
    const detail = regimeAt(quest, { r: 4 }).detail;
    // λ = ln 2 ≈ 0.693 — the exact, well-known value for the fully-developed map.
    expect(detail).toContain('0.693');
  });
});

describe('discovery — probe reveals only a coarse signal', () => {
  it('a chaotic r reads a "high" band with a positive Lyapunov exponent', () => {
    const p = probe(quest, { r: 3.9 });
    expect(p.band).toBe('high');
    expect(p.signalValue).toBeGreaterThan(0);
  });

  it('a stable r reads a "low" band with a negative Lyapunov exponent', () => {
    const p = probe(quest, { r: 2.5 });
    expect(p.band).toBe('low');
    expect(p.signalValue).toBeLessThan(0);
  });

  it('questParams merges tuned axes over the fixed params', () => {
    const params = questParams(quest, { r: 3.14 });
    expect(params.r).toBe(3.14);
    expect(params.x0).toBe(quest.fixedParams.x0);
    expect(params.transient).toBe(quest.fixedParams.transient);
  });
});

describe('discovery — claim verdict, novelty and proof hash', () => {
  it('a catalogued regime is identified as known, with its citation', async () => {
    const v = await claim(quest, { r: 3.84 }); // period-3 window
    expect(v.regime.id).toBe('period-3-window');
    expect(v.isNovel).toBe(false);
    expect(v.known?.name).toContain('Period-3');
    expect(v.message).toContain('Li');
  });

  it('an uncatalogued regime is flagged as a genuinely novel find', async () => {
    const v = await claim(quest, { r: 3.739 }); // period-5 window — not in the catalogue
    expect(v.regime.id).toBe('period-5-window');
    expect(v.isNovel).toBe(true);
    expect(v.known).toBeNull();
    expect(v.message).toContain('Novel');
  });

  it('a novel find outscores a common catalogued one at equal effort', async () => {
    const novel = await claim(quest, { r: 3.739 }, 0); // period-5 window (novel)
    const common = await claim(quest, { r: 2.5 }, 0); // stable equilibrium (rarity 0.1)
    expect(novel.score).toBeGreaterThan(common.score);
  });

  it('spending fewer probes scores higher for the same find', async () => {
    const efficient = await claim(quest, { r: 3.84 }, 1);
    const wasteful = await claim(quest, { r: 3.84 }, quest.probeBudget);
    expect(efficient.score).toBeGreaterThan(wasteful.score);
  });

  it('the proof hash is a deterministic 64-char SHA-256 that depends on the params', async () => {
    const a = await claim(quest, { r: 3.84 });
    const b = await claim(quest, { r: 3.84 });
    const c = await claim(quest, { r: 3.9 });
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(b.hash); // reproducible: same params ⇒ same proof
    expect(a.hash).not.toBe(c.hash); // different params ⇒ different proof
  });
});

describe('discovery — quest registry', () => {
  it('exposes the Road to Chaos quest by slug', () => {
    expect(getQuest('road-to-chaos')).toBe(quest);
    expect(getQuest('nope')).toBeUndefined();
    expect(listQuests().length).toBeGreaterThanOrEqual(1);
  });

  it('every catalogued regime id is reachable by the classifier vocabulary', () => {
    // Guard against a catalogue entry whose id the classifier can never emit
    // (a typo would make that "known" regime unreachable and silently novel).
    const emittable = new Set([
      'extinction',
      'fixed-point',
      'period-2',
      'period-4',
      'period-8',
      'period-16',
      'period-3-window',
      'chaos',
      'full-chaos',
      'edge-of-chaos',
    ]);
    for (const known of quest.knownCatalog) {
      expect(emittable.has(known.id)).toBe(true);
    }
  });
});
