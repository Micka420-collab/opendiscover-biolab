import { describe, expect, it } from 'vitest';
import {
  GLOWZOA_GENES,
  STARTER_SPECIMENS,
  buildCrossParams,
  discoverNew,
  rarityScore,
  rarityTier,
} from './breeding-game';
import { runExperiment } from './runner';

const byId = (id: string) => {
  const s = STARTER_SPECIMENS.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};

describe('breeding game data', () => {
  it('every starter specimen has a genotype for every gene', () => {
    for (const s of STARTER_SPECIMENS) {
      for (const g of GLOWZOA_GENES) {
        expect(s.genotype[g.symbol], `${s.id}/${g.symbol}`).toHaveLength(2);
      }
    }
  });

  it('buildCrossParams produces params the breeding engine accepts', async () => {
    const params = buildCrossParams(byId('aurora'), byId('prism'), {
      offspringCount: 6,
      seed: 't',
    });
    const rec = await runExperiment('breeding', params);
    expect(rec.engine).toBe('breeding');
    const detail = rec.result.detail as { sampledOffspring: unknown[] };
    expect(detail.sampledOffspring).toHaveLength(6);
  });

  it('a fully heterozygous self-cross yields many phenotypes', async () => {
    // Aurora is BbGgPpFf → the four-locus cross is highly diverse.
    const rec = await runExperiment('breeding', buildCrossParams(byId('aurora'), byId('aurora')));
    const detail = rec.result.detail as { phenotypeDistribution: unknown[] };
    expect(detail.phenotypeDistribution.length).toBeGreaterThan(8);
  });
});

describe('rarity + discovery helpers', () => {
  it('rarity is the reciprocal of probability, clamped', () => {
    expect(rarityScore(0.5)).toBe(2);
    expect(rarityScore(1 / 16)).toBe(16);
    expect(rarityScore(0)).toBe(999);
    expect(rarityScore(1)).toBe(1);
  });

  it('rarity tiers escalate with score', () => {
    expect(rarityTier(1)).toBe('common');
    expect(rarityTier(6)).toBe('uncommon');
    expect(rarityTier(16)).toBe('rare');
    expect(rarityTier(64)).toBe('legendary');
  });

  it('discoverNew returns only unseen phenotypes, deduped', () => {
    const known = ['Teal', 'Amber'];
    expect(discoverNew(known, ['Teal', 'Radiant-Faint', 'Radiant-Faint', 'Amber'])).toEqual([
      'Radiant-Faint',
    ]);
  });
});
