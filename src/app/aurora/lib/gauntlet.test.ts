import { CHALLENGE_POOL } from '@/lib/lab/daily-challenge';
import { describe, expect, it } from 'vitest';
import { GAUNTLET_SIZE, buildGauntlet, scoreRound } from './gauntlet';

describe('aurora gauntlet', () => {
  it('is deterministic and date-only (any time on a day maps to the same gauntlet)', () => {
    const a = buildGauntlet('2026-07-03');
    const b = buildGauntlet('2026-07-03T23:59:59Z');
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(buildGauntlet('2026-07-03').map((c) => c.id)).toEqual(a.map((c) => c.id));
  });

  it('draws GAUNTLET_SIZE distinct rounds only from the pool', () => {
    const g = buildGauntlet('2026-07-03');
    expect(g).toHaveLength(Math.min(GAUNTLET_SIZE, CHALLENGE_POOL.length));
    const ids = g.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const pool = new Set(CHALLENGE_POOL.map((c) => c.id));
    for (const id of ids) expect(pool.has(id)).toBe(true);
  });

  it('varies the line-up across dates', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 20; d++) {
      const iso = `2026-03-${String(d).padStart(2, '0')}`;
      seen.add(
        buildGauntlet(iso)
          .map((c) => c.id)
          .join(','),
      );
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('scores combo + perfect bonuses on top of a fixed base', () => {
    expect(scoreRound({ combo: 1, perfect: false }).total).toBe(1000);
    expect(scoreRound({ combo: 3, perfect: false }).total).toBe(1500);
    expect(scoreRound({ combo: 1, perfect: true }).total).toBe(1500);
    expect(scoreRound({ combo: 0, perfect: false }).comboBonus).toBe(0);
  });
});
