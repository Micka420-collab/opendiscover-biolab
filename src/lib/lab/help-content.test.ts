import { describe, expect, it } from 'vitest';
import { CHALLENGE_POOL } from './daily-challenge';
import { HELP_CARDS, helpForChallenge } from './help-content';

describe('plain-language help content', () => {
  it('every pooled challenge has a complete help card', () => {
    for (const c of CHALLENGE_POOL) {
      const card = helpForChallenge(c.id);
      expect(card, `${c.id} needs a help card`).not.toBeNull();
      expect(card?.plainWhat.length ?? 0, c.id).toBeGreaterThan(20);
      expect(card?.plainWhy.length ?? 0, c.id).toBeGreaterThan(20);
      expect(card?.plainHow.length ?? 0, c.id).toBeGreaterThan(20);
    }
  });

  it('stays jargon-free: no equations or bare Greek symbols in the prose', () => {
    // The whole point is accessibility. Temperatures (°C) and % are fine; equations and
    // bare Greek letters are not. Any unavoidable term lives in the glossary, not the prose.
    const banned = /[=√∑βλμΔπ]/;
    for (const [id, card] of Object.entries(HELP_CARDS)) {
      const prose = `${card.plainWhat} ${card.plainWhy} ${card.plainHow}`;
      expect(banned.test(prose), `${id} prose must be jargon-free (found a symbol/equation)`).toBe(
        false,
      );
    }
  });
});
