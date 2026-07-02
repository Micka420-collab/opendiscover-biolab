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

  it('unlocks half-the-lab at ceil(total/2) engines and scales with the catalog', () => {
    const half = (s: ReturnType<typeof computeAchievements>) =>
      s.achievements.find((a) => a.id === 'half-the-lab');
    // 5 engines → need ceil(5/2) = 3.
    expect(half(computeAchievements(['a', 'b'], catalog))?.need).toBe(3);
    expect(unlocked(computeAchievements(['a', 'b'], catalog), 'half-the-lab')).toBe(false);
    expect(unlocked(computeAchievements(['a', 'b', 'c'], catalog), 'half-the-lab')).toBe(true);
  });

  it('unlocks domain-specialist only when a whole substantial (≥3) domain is finished', () => {
    // A domain of 3 engines (eco) plus a one-engine domain (structural).
    const deep: CatalogEntry[] = [
      { slug: 'e1', domain: 'ecology' },
      { slug: 'e2', domain: 'ecology' },
      { slug: 'e3', domain: 'ecology' },
      { slug: 's1', domain: 'structural' },
    ];
    const spec = (s: ReturnType<typeof computeAchievements>) =>
      s.achievements.find((a) => a.id === 'domain-specialist');
    // Ecology is the only substantial (≥3) domain, so the badge tracks it.
    const partial = computeAchievements(['e1', 'e2'], deep);
    expect(spec(partial)?.have).toBe(2);
    expect(spec(partial)?.need).toBe(3);
    expect(unlocked(partial, 'domain-specialist')).toBe(false);
    // Finishing the whole 3-engine domain unlocks it.
    expect(unlocked(computeAchievements(['e1', 'e2', 'e3'], deep), 'domain-specialist')).toBe(true);
    // Finishing only the one-engine 'structural' domain does NOT (too small to count).
    expect(unlocked(computeAchievements(['s1'], deep), 'domain-specialist')).toBe(false);
  });

  it('caps progress `have` at the goal `need`', () => {
    const s = computeAchievements(['a', 'b', 'c', 'd', 'e'], catalog);
    const first = s.achievements.find((a) => a.id === 'first-run');
    expect(first?.have).toBe(1);
    expect(first?.need).toBe(1);
  });
});
