import { describe, expect, it } from 'vitest';
import { LITTER_SIZE, solveCross } from './solve';
import { crossById } from './specimens';

/** Fetch a pool cross by id or fail loudly (keeps the tests readable). */
function cross(id: string) {
  const c = crossById(id);
  if (!c) throw new Error(`test fixture missing cross "${id}"`);
  return c;
}

describe('solveCross — matches textbook Mendelian genetics', () => {
  it('Ss × Ss gives the classic 3:1 monohybrid ratio', () => {
    const s = solveCross(cross('peas-monohybrid'));
    expect(s.ratio).toBe('3:1');
    expect(s.mostCommon).toEqual(['Round']);
    const round = s.options.find((o) => o.label === 'Round');
    const wrinkled = s.options.find((o) => o.label === 'Wrinkled');
    expect(round?.probability).toBeCloseTo(0.75, 9);
    expect(wrinkled?.probability).toBeCloseTo(0.25, 9);
    // Both parents are Round, yet Wrinkled can appear — the recessive surprise.
    expect(s.hiddenLooks).toEqual(['Wrinkled']);
  });

  it('Ss × ss is a 1:1 test cross (a genuine tie for most-common)', () => {
    const s = solveCross(cross('peas-testcross'));
    expect(s.ratio).toBe('1:1');
    expect(new Set(s.mostCommon)).toEqual(new Set(['Round', 'Wrinkled']));
    for (const o of s.options) expect(o.probability).toBeCloseTo(0.5, 9);
  });

  it('SsCc × SsCc gives the 9:3:3:1 dihybrid distribution and no Punnett grid', () => {
    const s = solveCross(cross('peas-dihybrid'));
    expect(s.options.length).toBe(4);
    expect(s.mostCommon).toEqual(['Round, Green']);
    const top = s.options.find((o) => o.label === 'Round, Green');
    expect(top?.probability).toBeCloseTo(9 / 16, 9);
    expect(s.punnett).toBeNull();
  });

  it('incomplete dominance blends: RR × WW → 100% intermediate, red/pink/white on offer', () => {
    const s = solveCross(cross('snapdragon-blend'));
    // Options are the full colour vocabulary (crimson / pink / white) — a real
    // choice — but only the intermediate blend actually occurs.
    expect(s.options.length).toBe(3);
    expect(s.mostCommon.length).toBe(1);
    const winner = s.options.find((o) => o.label === s.mostCommon[0]);
    expect(winner?.probability).toBeCloseTo(1, 9);
    // The bloom is a colour NEITHER pure parent shows.
    expect(s.hiddenLooks.length).toBe(1);
  });

  it('incomplete dominance splits: pink × pink → 1:2:1 with the blend most common', () => {
    const s = solveCross(cross('snapdragon-pink-cross'));
    // The engine renders the ratio biggest-first, so 1:2:1 reads as "2:1:1".
    expect(s.ratio.split(':').sort()).toEqual(['1', '1', '2']);
    expect(s.mostCommon.length).toBe(1);
    expect(s.options.find((o) => o.label === s.mostCommon[0])?.probability).toBeCloseTo(0.5, 9);
  });

  it('codominance: roan × roan → 1:2:1 (both alleles show together)', () => {
    const s = solveCross(cross('cattle-roan'));
    expect(s.ratio.split(':').sort()).toEqual(['1', '1', '2']);
    expect(s.options.length).toBe(3);
  });

  it('a single-locus Punnett grid dimensions match the parent gametes', () => {
    const s = solveCross(cross('peas-monohybrid'));
    const p = s.punnett;
    expect(p).not.toBeNull();
    if (!p) return;
    // Ss makes two gametes on each side → a 2×2 grid.
    expect(p.gametesA.length).toBe(2);
    expect(p.gametesB.length).toBe(2);
    expect(p.cells.length).toBe(2);
    expect(p.cells.every((row) => row.length === 2)).toBe(true);
  });

  it('is byte-for-byte deterministic (same litter every run)', () => {
    const a = solveCross(cross('mice-carriers'));
    const b = solveCross(cross('mice-carriers'));
    expect(a.litter).toEqual(b.litter);
    expect(a.litter.length).toBe(LITTER_SIZE);
  });
});
