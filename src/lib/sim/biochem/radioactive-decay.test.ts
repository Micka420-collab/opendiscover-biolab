import { describe, expect, it } from 'vitest';
import { fractionRemaining, run, spec } from './radioactive-decay';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('radioactive-decay (first-order half-life)', () => {
  it('halves every half-life: 1 → 1/2 → 1/4', () => {
    expect(fractionRemaining(5730, 0)).toBe(1);
    expect(fractionRemaining(5730, 5730)).toBeCloseTo(0.5, 12);
    expect(fractionRemaining(5730, 2 * 5730)).toBeCloseTo(0.25, 12);
  });

  it('decay constant is ln2/t½ and mean lifetime is its reciprocal', () => {
    const r = run({ halfLife: 5730 });
    expect(metric(r, 'decayConstant')).toBeCloseTo(Math.LN2 / 5730, 12);
    expect(metric(r, 'meanLifetime')).toBeCloseTo(1 / metric(r, 'decayConstant'), 9);
  });

  it('fraction falls monotonically and stays in (0,1]', () => {
    let prev = 2;
    for (let t = 0; t <= 30000; t += 1000) {
      const f = fractionRemaining(5730, t);
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThanOrEqual(1);
      expect(f).toBeLessThanOrEqual(prev);
      prev = f;
    }
  });

  it('carbon dating: a quarter of the carbon-14 left means two half-lives (~11,460 yr)', () => {
    const r = run({ halfLife: 5730, time: 2 * 5730, initialAmount: 100 });
    expect(metric(r, 'fractionRemaining')).toBeCloseTo(0.25, 12);
    expect(metric(r, 'halfLivesElapsed')).toBeCloseTo(2, 12);
    expect(metric(r, 'remainingAmount')).toBeCloseTo(25, 9);
  });

  it('time to 10% remaining actually leaves 10%', () => {
    const r = run({ halfLife: 5730 });
    const t10 = metric(r, 'timeTo10Pct');
    expect(fractionRemaining(5730, t10)).toBeCloseTo(0.1, 9);
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ halfLife: 5e-324 })).toThrow();
    expect(() => run({ initialAmount: 5e-324 })).toThrow();
    const r = run({ halfLife: 1e-6, time: 1e15, initialAmount: 1e15, tMax: 1e15 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.remaining ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the decay curve and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.remaining).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('radioactive-decay');
    expect(spec.domain).toBe('biochemistry');
  });
});
