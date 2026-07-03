import { describe, expect, it } from 'vitest';
import { recombinationFrequency, run, spec } from './recombination-map';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('recombination-map (linkage mapping)', () => {
  it('for close genes all mapping functions give r ≈ distance (1 cM ≈ 1%)', () => {
    for (const fn of ['morgan', 'haldane', 'kosambi'] as const) {
      expect(recombinationFrequency(1, fn)).toBeCloseTo(0.01, 3);
    }
  });

  it('r saturates toward ½ for distant genes and never exceeds it', () => {
    expect(recombinationFrequency(500, 'haldane')).toBeGreaterThan(0.49);
    expect(recombinationFrequency(500, 'haldane')).toBeLessThan(0.5);
    expect(recombinationFrequency(1000, 'kosambi')).toBeLessThanOrEqual(0.5); // tanh saturates to ½
    expect(recombinationFrequency(200, 'morgan')).toBe(0.5); // Morgan clamps at ½
  });

  it('crossovers make the observed r under-read the true distance', () => {
    const r = run({ mapDistanceCm: 30, mapFunction: 'haldane' });
    expect(metric(r, 'recombinationFrequency')).toBeLessThan(0.3); // < naive 30%
    expect(metric(r, 'underReport')).toBeGreaterThan(0);
    expect(metric(r, 'recombinationFrequency')).toBeCloseTo(0.5 * (1 - Math.exp(-0.6)), 12);
  });

  it('recombination rises monotonically with distance', () => {
    let prev = -1;
    for (let d = 0; d <= 120; d += 5) {
      const r = recombinationFrequency(d, 'haldane');
      expect(r).toBeGreaterThanOrEqual(prev);
      expect(r).toBeLessThan(0.5 + 1e-9);
      prev = r;
    }
  });

  it('the linked flag flips to unlinked as r approaches ½', () => {
    expect(metric(run({ mapDistanceCm: 10 }), 'linked')).toBe(1);
    expect(metric(run({ mapDistanceCm: 100, mapFunction: 'morgan' }), 'linked')).toBe(0);
  });

  it('under-report stays consistent (≤ ½) past 50 cM: capped naive − under-report = observed r', () => {
    const r = run({ mapDistanceCm: 100, mapFunction: 'haldane' });
    const cappedNaive = Math.min(0.5, 100 / 100); // display caps the naive r at ½
    const under = metric(r, 'underReport');
    expect(under).toBeLessThanOrEqual(0.5 + 1e-9);
    expect(cappedNaive - under).toBeCloseTo(metric(r, 'recombinationFrequency'), 9);
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ distanceMaxCm: 5e-324 })).toThrow();
    const r = run({ mapDistanceCm: 1000, mapFunction: 'kosambi', distanceMaxCm: 1000 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.recombination ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the r-vs-distance curve and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.recombination).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('recombination-map');
    expect(spec.domain).toBe('population-genetics');
  });
});
