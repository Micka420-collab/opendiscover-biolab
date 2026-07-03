import { describe, expect, it } from 'vitest';
import { responseToSelection, run, spec } from './breeders-equation';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('breeders-equation', () => {
  it('response per generation is R = h²·S and never exceeds S', () => {
    expect(responseToSelection(0.5, 2)).toBe(1);
    const r = run({ heritability: 0.5, selectionDifferential: 2 });
    expect(metric(r, 'responsePerGeneration')).toBe(1);
    // R ≤ S (only the heritable fraction carries over)
    expect(responseToSelection(0.3, 10)).toBeLessThanOrEqual(10);
    expect(responseToSelection(1, 10)).toBe(10); // h²=1 ⇒ full response
    expect(responseToSelection(0, 10)).toBe(0); // h²=0 ⇒ no response
  });

  it('the mean climbs linearly to M₀ + generations·h²·S', () => {
    const r = run({
      initialMean: 100,
      heritability: 0.5,
      selectionDifferential: 2,
      generations: 10,
    });
    expect(metric(r, 'totalResponse')).toBe(10); // 10·0.5·2
    expect(metric(r, 'finalMean')).toBe(110);
  });

  it('a bigger selection differential lifts the final mean (monotonic — the challenge)', () => {
    const finalMean = (s: number) =>
      metric(
        run({ initialMean: 100, heritability: 0.5, selectionDifferential: s, generations: 10 }),
        'finalMean',
      );
    expect(finalMean(5)).toBeGreaterThan(finalMean(2));
    // challenge: S=10 lifts 100 → 150 in 10 generations at h²=0.5
    expect(finalMean(10)).toBeCloseTo(150, 9);
  });

  it('more heritable traits respond faster', () => {
    const low = metric(
      run({ heritability: 0.1, selectionDifferential: 5 }),
      'responsePerGeneration',
    );
    const high = metric(
      run({ heritability: 0.9, selectionDifferential: 5 }),
      'responsePerGeneration',
    );
    expect(high).toBeGreaterThan(low);
  });

  it('the trajectory starts at M₀ and rises with a constant slope', () => {
    const r = run({
      initialMean: 50,
      heritability: 0.4,
      selectionDifferential: 3,
      generations: 20,
      outputPoints: 21,
    });
    const mean = r.series?.[0]?.y.mean ?? [];
    expect(mean[0]).toBeCloseTo(50, 9);
    // constant increments (linear)
    const d1 = mean[1] - mean[0];
    const d2 = mean[2] - mean[1];
    expect(d1).toBeCloseTo(d2, 9);
  });

  it('rejects denormal / non-integer inputs and stays finite at the schema bounds', () => {
    expect(() => run({ generations: 2.5 })).toThrow(); // not an integer
    const r = run({
      initialMean: 1e9,
      heritability: 1,
      selectionDifferential: 1e6,
      generations: 1e6,
    });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.mean ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the trajectory and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.mean).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('breeders-equation');
    expect(spec.domain).toBe('population-genetics');
  });
});
