import { describe, expect, it } from 'vitest';
import {
  GLOWZOA_GENES,
  STARTER_SPECIMENS,
  buildCrossParams,
  discoverNew,
  offspringToSpecimen,
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

describe('offspringToSpecimen — multi-generation breeding (F1 x F1, or F1 x starter)', () => {
  it('round-trips exactly: re-deriving the genotype label from the specimen matches the original', async () => {
    const rec = await runExperiment(
      'breeding',
      buildCrossParams(byId('aurora'), byId('aurora'), { offspringCount: 8, seed: 'rt-check' }),
    );
    const detail = rec.result.detail as {
      sampledOffspring: { genotype: string; phenotype: string }[];
    };
    for (const offspring of detail.sampledOffspring) {
      const specimen = offspringToSpecimen(offspring, 'f1', 'F1', '🧬');
      const rebuilt = GLOWZOA_GENES.map((g) => specimen.genotype[g.symbol].join('')).join(' ');
      expect(rebuilt).toBe(offspring.genotype);
    }
  });

  it('rejects a genotype string with the wrong number of loci', () => {
    expect(() =>
      offspringToSpecimen({ genotype: 'Bb Gg', phenotype: '' }, 'x', 'X', '❓'),
    ).toThrow();
  });

  it('a promoted F1 can be bred again, and Mendelian inheritance still holds: a GG parent can never contribute a "Faint" (g) allele', async () => {
    // Cross Aurora (Bb Gg Pp Ff) with itself, then take a heterozygous-Gg
    // offspring forward and breed it with Sundrop (homozygous GG). Since
    // Sundrop has no 'g' allele to give, NO resulting phenotype can show pure
    // "Faint" bioluminescence -- only "Radiant" (if F1 also gave G) or the
    // "Radiant-Faint" incomplete-dominance blend (if F1 gave g). This is a
    // basic Mendelian gamete-formation fact, not a fitted/memorized value.
    const rec1 = await runExperiment(
      'breeding',
      buildCrossParams(byId('aurora'), byId('aurora'), { offspringCount: 20, seed: 'multi-gen-1' }),
    );
    const detail1 = rec1.result.detail as {
      sampledOffspring: { genotype: string; phenotype: string }[];
    };
    const hetGg = detail1.sampledOffspring.find((o) => o.genotype.split(' ')[1] === 'Gg');
    expect(hetGg, 'expected at least one Gg offspring in 20 samples').toBeTruthy();

    const f1 = offspringToSpecimen(hetGg!, 'f1-het', 'F1', '🧬');
    expect(f1.genotype.G).toEqual(['G', 'g']);

    const rec2 = await runExperiment(
      'breeding',
      buildCrossParams(f1, byId('sundrop'), { offspringCount: 0, seed: 'multi-gen-2' }),
    );
    const detail2 = rec2.result.detail as { phenotypeDistribution: { phenotype: string }[] };
    // Gene order is [B, G, P, F], so the G-locus phenotype is comma-segment index 1.
    const gLocusPhenotypes = detail2.phenotypeDistribution.map((d) => d.phenotype.split(', ')[1]);
    expect(gLocusPhenotypes).not.toContain('Faint');
    // And it must be possible to see the Radiant-Faint blend (Sundrop's G x F1's g).
    expect(gLocusPhenotypes).toContain('Radiant-Faint');
  });
});
