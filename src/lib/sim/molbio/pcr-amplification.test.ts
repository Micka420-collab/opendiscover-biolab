import { describe, expect, it } from 'vitest';
import { pcrCopies, run, spec } from './pcr-amplification';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('pcr-amplification', () => {
  it('copies grow as N₀·(1+E)^cycles until the plateau caps them', () => {
    expect(pcrCopies(1000, 1, 10, 1e15)).toBe(1000 * 2 ** 10); // perfect doubling
    expect(pcrCopies(1000, 0.9, 30, 1e12)).toBeCloseTo(1000 * 1.9 ** 30, 0);
    // plateau caps the copy number
    expect(pcrCopies(1000, 1, 40, 1e6)).toBe(1e6);
  });

  it('reports fold amplification, ideal fold, and effective doublings', () => {
    const r = run({ initialCopies: 1000, efficiency: 0.9, cycles: 30, plateau: 1e15 });
    expect(metric(r, 'theoreticalFold')).toBeCloseTo(1.9 ** 30, 0);
    expect(metric(r, 'foldAmplification')).toBeCloseTo(1.9 ** 30, 0);
    expect(metric(r, 'effectiveDoublings')).toBeCloseTo(30 * Math.log2(1.9), 6);
  });

  it('a perfect reaction does exactly one doubling per cycle', () => {
    const r = run({ initialCopies: 1000, efficiency: 1, cycles: 20, plateau: 1e15 });
    expect(metric(r, 'effectiveDoublings')).toBeCloseTo(20, 9);
    expect(metric(r, 'foldAmplification')).toBeCloseTo(2 ** 20, 6);
  });

  it('effective doublings rise monotonically with efficiency (the challenge)', () => {
    const doublings = (e: number) =>
      metric(
        run({ initialCopies: 1000, efficiency: e, cycles: 25, plateau: 1e15 }),
        'effectiveDoublings',
      );
    expect(doublings(0.9)).toBeGreaterThan(doublings(0.5));
    // challenge: ~20 doublings (a million-fold) in 25 cycles needs E ≈ 0.74
    expect(doublings(0.74)).toBeCloseTo(20, 0);
  });

  it('no amplification at E=0, and the plateau flag shows in the summary', () => {
    const flat = run({ initialCopies: 1000, efficiency: 0, cycles: 30 });
    expect(metric(flat, 'foldAmplification')).toBe(1);
    expect(metric(flat, 'effectiveDoublings')).toBe(0);
    const capped = run({ initialCopies: 1000, efficiency: 1, cycles: 40, plateau: 1e6 });
    expect(capped.summary).toContain('plateau');
  });

  it('rejects non-integer cycles and stays finite at the schema bounds', () => {
    expect(() => run({ cycles: 2.5 })).toThrow();
    const r = run({ initialCopies: 1e12, efficiency: 1, cycles: 60, plateau: 1e15 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.copies ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the copies-vs-cycle curve (one point per cycle) and is deterministic', () => {
    const r = run({ cycles: 20 });
    expect(r.series?.[0]?.x).toHaveLength(21); // 0..20
    expect(r.series?.[0]?.y.copies).toHaveLength(21);
    expect(r.series?.[0]?.y.copies?.[0]).toBe(1000); // cycle 0 = starting copies
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('pcr-amplification');
    expect(spec.domain).toBe('molecular-biology');
  });
});
