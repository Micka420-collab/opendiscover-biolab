import { describe, expect, it } from 'vitest';
import { metabolicRate, run, spec } from './allometric-scaling';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('allometric-scaling (Kleiber)', () => {
  it('a 1 kg animal is the reference: all relative scalings equal 1', () => {
    const r = run({ bodyMass: 1, scalingExponent: 0.75, normalization: 3.4 });
    expect(metric(r, 'metabolicRate')).toBeCloseTo(3.4, 12);
    expect(metric(r, 'heartRateRelative')).toBeCloseTo(1, 12);
    expect(metric(r, 'lifespanRelative')).toBeCloseTo(1, 12);
  });

  it("metabolic rate follows Kleiber's power law B0·M^b", () => {
    expect(metabolicRate(3.4, 0.75, 16)).toBeCloseTo(3.4 * 8, 9); // 16^0.75 = 8
    // slope on a log-log plot equals the exponent b
    const slope =
      (Math.log10(metabolicRate(3.4, 0.75, 100)) - Math.log10(metabolicRate(3.4, 0.75, 1))) /
      (Math.log10(100) - Math.log10(1));
    expect(slope).toBeCloseTo(0.75, 9);
  });

  it('bigger animals burn slower per kg but live longer', () => {
    const mouse = run({ bodyMass: 0.02 });
    const elephant = run({ bodyMass: 5000 });
    expect(metric(elephant, 'massSpecificRate')).toBeLessThan(metric(mouse, 'massSpecificRate'));
    expect(metric(elephant, 'lifespanRelative')).toBeGreaterThan(metric(mouse, 'lifespanRelative'));
    expect(metric(elephant, 'heartRateRelative')).toBeLessThan(metric(mouse, 'heartRateRelative'));
  });

  it('heartbeats per lifetime are ~constant across body sizes', () => {
    for (const m of [0.005, 1, 70, 5000]) {
      expect(metric(run({ bodyMass: m }), 'heartbeatsPerLifeRelative')).toBeCloseTo(1, 8);
    }
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ bodyMass: 5e-324 })).toThrow();
    expect(() => run({ normalization: 1e-160 })).toThrow();
    const r = run({
      bodyMass: 1e6,
      scalingExponent: 2,
      normalization: 1e6,
      massMin: 1e-9,
      massMax: 1e6,
    });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.metabolicRate ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the metabolic-rate curve and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.metabolicRate).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('allometric-scaling');
    expect(spec.domain).toBe('ecology');
  });
});
