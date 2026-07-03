import { describe, expect, it } from 'vitest';
import { flowRate, run, spec } from './poiseuille-flow';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('poiseuille-flow (Hagen–Poiseuille)', () => {
  it('flow follows Q = π·ΔP·r⁴/(8ηL) and equals ΔP / resistance', () => {
    const r = run({ radius: 2, length: 5, pressureDrop: 500, viscosity: 3.5e-3 });
    const q = flowRate(500, 2e-3, 3.5e-3, 0.05); // SI, m³/s
    expect(metric(r, 'flowRate')).toBeCloseTo(q * 1e6, 6); // reported in mL/s
    // Q = ΔP / R  ⇒  flowRate(mL/s) = 500 / resistance · 1e6
    expect(metric(r, 'flowRate')).toBeCloseTo((500 / metric(r, 'resistance')) * 1e6, 6);
  });

  it('flow scales as the FOURTH power of radius (doubling r → 16×)', () => {
    const one = run({ radius: 1 });
    const two = run({ radius: 2 });
    expect(metric(two, 'flowRate') / metric(one, 'flowRate')).toBeCloseTo(16, 6);
  });

  it('peak (centreline) velocity is exactly twice the mean', () => {
    const r = run({});
    expect(metric(r, 'maxVelocity')).toBeCloseTo(2 * metric(r, 'meanVelocity'), 9);
  });

  it('the velocity profile is a parabola: zero at the walls, peak at the centre', () => {
    const r = run({ radius: 2, outputPoints: 101 });
    const v = r.series?.[0]?.y.velocity ?? [];
    const x = r.series?.[0]?.x ?? [];
    expect(v[0]).toBeCloseTo(0, 9); // wall
    expect(v[v.length - 1]).toBeCloseTo(0, 9); // wall
    const mid = (v.length - 1) / 2;
    expect(x[mid]).toBeCloseTo(0, 9); // centre position
    expect(v[mid]).toBeCloseTo(metric(r, 'maxVelocity'), 6); // peak == centreline metric
    for (const val of v) expect(val).toBeLessThanOrEqual(metric(r, 'maxVelocity') + 1e-9);
  });

  it('wall shear stress is ΔP·r/(2L)', () => {
    const r = run({ radius: 2, length: 5, pressureDrop: 500 });
    expect(metric(r, 'wallShearStress')).toBeCloseTo((500 * 2e-3) / (2 * 0.05), 9); // = 10 Pa
  });

  it('flags turbulent onset once the Reynolds number crosses ~2300', () => {
    const calm = run({ radius: 2, pressureDrop: 500 }); // Re ≈ 1730
    expect(metric(calm, 'laminar')).toBe(1);
    const fast = run({ radius: 2, pressureDrop: 2000 }); // Re ≈ 6900
    expect(metric(fast, 'reynoldsNumber')).toBeGreaterThan(2300);
    expect(metric(fast, 'laminar')).toBe(0);
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ radius: 5e-324 })).toThrow();
    expect(() => run({ viscosity: 5e-324 })).toThrow();
    const r = run({ radius: 100, length: 1e-3, pressureDrop: 1e12, viscosity: 1e-9, density: 1e6 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.velocity ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the velocity profile and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.velocity).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('poiseuille-flow');
    expect(spec.domain).toBe('biochemistry');
  });
});
