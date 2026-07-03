import { describe, expect, it } from 'vitest';
import { occupancy, run, spec, specificBound } from './saturation-binding';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('saturation-binding (receptor–ligand)', () => {
  it('binds half-maximally exactly at [L] = Kd', () => {
    expect(specificBound(100, 5, 5)).toBeCloseTo(50, 12); // Bmax/2
    expect(occupancy(5, 5)).toBeCloseTo(0.5, 12);
    expect(occupancy(26, 26)).toBeCloseTo(0.5, 12);
  });

  it('occupancy rises monotonically with ligand and stays in [0,1)', () => {
    let prev = -1;
    for (let l = 0; l <= 200; l += 10) {
      const y = occupancy(5, l);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(1);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
    expect(occupancy(5, 1e9)).toBeGreaterThan(0.999); // saturates toward full
  });

  it('tighter binding (smaller Kd) fills more sites at the same ligand', () => {
    expect(occupancy(1, 10)).toBeGreaterThan(occupancy(50, 10));
  });

  it('reports occupancy and specific binding at the chosen concentration', () => {
    const r = run({ kd: 5, bmax: 100, ligand: 10 });
    expect(metric(r, 'occupancy')).toBeCloseTo(10 / 15, 9);
    expect(metric(r, 'boundSpecific')).toBeCloseTo((100 * 10) / 15, 9);
    expect(metric(r, 'ligandForHalf')).toBe(5); // = Kd
  });

  it('adds linear non-specific binding to the total', () => {
    const r = run({ kd: 5, bmax: 100, ligand: 10, nonspecific: 2 });
    expect(metric(r, 'nonspecificBound')).toBeCloseTo(2 * 10, 12);
    expect(metric(r, 'totalBound')).toBeCloseTo(metric(r, 'boundSpecific') + 20, 9);
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ kd: 5e-324 })).toThrow();
    expect(() => run({ bmax: 1e-160 })).toThrow();
    const r = run({ kd: 1e6, bmax: 1e9, ligand: 1e9, nonspecific: 1e3, ligandMax: 1e9 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.total ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the binding isotherm and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.specific).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('saturation-binding');
    expect(spec.domain).toBe('drug-discovery');
  });
});
