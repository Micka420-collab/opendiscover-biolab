import { engines } from '@/lib/sim';
import { describe, expect, it } from 'vitest';
import { ENGINE_HELP, helpForEngine } from './engine-help';

describe('engine help content', () => {
  it('every registered engine has a complete plain-language card', () => {
    for (const e of engines) {
      const card = helpForEngine(e.slug);
      expect(card, `${e.slug} needs an engine help card`).not.toBeNull();
      expect(card?.plainWhat.length ?? 0, e.slug).toBeGreaterThan(20);
      expect(card?.plainWhy.length ?? 0, e.slug).toBeGreaterThan(20);
      expect(card?.plainHow.length ?? 0, e.slug).toBeGreaterThan(20);
    }
  });

  it('stays jargon-free: no equations or bare Greek symbols in the prose', () => {
    // Accessibility safety net for every card (verified or grounded-draft): no roots,
    // sums, or Greek letters in the sentences. (A code example like a SMILES string may
    // contain "=", which is legitimate, so that character is not banned here.)
    const banned = /[√∑βλμΔπ]/;
    for (const [slug, card] of Object.entries(ENGINE_HELP)) {
      const prose = `${card.plainWhat} ${card.plainWhy} ${card.plainHow}`;
      expect(banned.test(prose), `${slug} prose must be jargon-free`).toBe(false);
    }
  });
});
