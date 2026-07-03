import { describe, expect, it } from 'vitest';
import { permeability, run, spec } from './membrane-permeation';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('membrane-permeation (Fick)', () => {
  it('permeability is D·K/L and flux is P·ΔC', () => {
    expect(permeability(1e-6, 1, 1e-6)).toBeCloseTo(1, 12);
    const r = run({ diffusionCoeff: 1e-6, partitionCoeff: 1, thickness: 1e-6, concOutside: 100, concInside: 0 });
    expect(metric(r, 'permeability')).toBeCloseTo(1, 12);
    expect(metric(r, 'initialFlux')).toBeCloseTo(100, 9); // P·(100−0)
    expect(metric(r, 'rateConstant')).toBeCloseTo(2, 12); // 2·P·A/V
    expect(metric(r, 'halfEquilibrationTime')).toBeCloseTo(Math.LN2 / 2, 12);
  });

  it('the curves start at the initial concentrations and conserve total (equal volumes)', () => {
    const r = run({ concOutside: 80, concInside: 20, tEnd: 5, outputPoints: 50 });
    const out = r.series?.[0]?.y.outside ?? [];
    const ins = r.series?.[0]?.y.inside ?? [];
    expect(out[0]).toBeCloseTo(80, 9);
    expect(ins[0]).toBeCloseTo(20, 9);
    for (let i = 0; i < out.length; i++) {
      expect(out[i] + ins[i]).toBeCloseTo(100, 8); // conservation: sum stays C1₀+C2₀
    }
  });

  it('both sides converge to the average concentration', () => {
    const r = run({ concOutside: 100, concInside: 0, tEnd: 1000 });
    expect(metric(r, 'equilibriumConc')).toBeCloseTo(50, 12);
    expect(metric(r, 'insideConcAtEnd')).toBeCloseTo(50, 6);
  });

  it('a more lipophilic solute (higher K) permeates faster', () => {
    const low = run({ partitionCoeff: 0.1 });
    const high = run({ partitionCoeff: 100 });
    expect(metric(high, 'permeability')).toBeGreaterThan(metric(low, 'permeability'));
    expect(metric(high, 'halfEquilibrationTime')).toBeLessThan(metric(low, 'halfEquilibrationTime'));
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ thickness: 5e-324 })).toThrow();
    expect(() => run({ partitionCoeff: 5e-324 })).toThrow();
    const r = run({ diffusionCoeff: 1, partitionCoeff: 1e6, thickness: 1e-9, area: 1e6, volume: 1e-9, tEnd: 1e12 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.inside ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the concentration curves and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.inside).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('membrane-permeation');
    expect(spec.domain).toBe('biochemistry');
  });
});
