import { describe, expect, it } from 'vitest';
import { type CatalogEntry, computeAchievements } from './achievements';

const catalog: CatalogEntry[] = [
  { slug: 'a', domain: 'molecular-biology' },
  { slug: 'b', domain: 'molecular-biology' },
  { slug: 'c', domain: 'protein' },
  { slug: 'd', domain: 'ecology' },
  { slug: 'e', domain: 'epidemiology' },
];

const unlocked = (s: ReturnType<typeof computeAchievements>, id: string) =>
  s.achievements.find((a) => a.id === id)?.unlocked;

describe('computeAchievements', () => {
  it('counts distinct explored engines and domains, ignoring unknown slugs', () => {
    const s = computeAchievements(['a', 'b', 'zzz', 'a'], catalog);
    expect(s.exploredCount).toBe(2); // a, b (zzz ignored, a deduped)
    expect(s.total).toBe(5);
    expect(s.domainsCovered).toBe(1); // both molecular-biology
    expect(s.totalDomains).toBe(4);
  });

  it('unlocks first-run after one engine', () => {
    expect(unlocked(computeAchievements([], catalog), 'first-run')).toBe(false);
    expect(unlocked(computeAchievements(['a'], catalog), 'first-run')).toBe(true);
  });

  it('unlocks completionist only when every engine is explored', () => {
    const partial = computeAchievements(['a', 'b', 'c', 'd'], catalog);
    expect(unlocked(partial, 'completionist')).toBe(false);
    const full = computeAchievements(['a', 'b', 'c', 'd', 'e'], catalog);
    expect(unlocked(full, 'completionist')).toBe(true);
  });

  it('unlocks all-domains when every domain is covered', () => {
    // one engine per distinct domain: a (mol-bio), c (protein), d (ecology), e (epi)
    const s = computeAchievements(['a', 'c', 'd', 'e'], catalog);
    expect(s.domainsCovered).toBe(4);
    expect(unlocked(s, 'all-domains')).toBe(true);
  });

  it('caps progress `have` at the goal `need`', () => {
    const s = computeAchievements(['a', 'b', 'c', 'd', 'e'], catalog);
    const first = s.achievements.find((a) => a.id === 'first-run');
    expect(first?.have).toBe(1);
    expect(first?.need).toBe(1);
  });
});
