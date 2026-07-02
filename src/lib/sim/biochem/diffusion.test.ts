import { describe, expect, it } from 'vitest';
import { diffusionCoefficient, rmsDisplacement, run, spec } from './diffusion';

const KB = 1.380649e-23;
const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('diffusion (Stokes–Einstein)', () => {
  it('D matches kB·T/(6π·η·r) converted to µm²/s', () => {
    const r = 5;
    const eta = 1;
    const tC = 20;
    const expectedSi = (KB * (tC + 273.15)) / (6 * Math.PI * (eta * 1e-3) * (r * 1e-9));
    expect(diffusionCoefficient(r, eta, tC)).toBeCloseTo(expectedSi * 1e12, 9);
    // A 5 nm particle in water at 20°C diffuses at a few tens of µm²/s.
    expect(diffusionCoefficient(5, 1, 20)).toBeGreaterThan(20);
    expect(diffusionCoefficient(5, 1, 20)).toBeLessThan(60);
  });

  it('D is inversely proportional to radius and viscosity, proportional to absolute T', () => {
    expect(diffusionCoefficient(10, 1, 20)).toBeCloseTo(diffusionCoefficient(5, 1, 20) / 2, 9);
    expect(diffusionCoefficient(5, 2, 20)).toBeCloseTo(diffusionCoefficient(5, 1, 20) / 2, 9);
    // T in kelvin: doubling absolute temperature doubles D.
    const tLow = -136.575; // ≈ 136.575 K
    const tHigh = 2 * (tLow + 273.15) - 273.15; // 273.15 K
    expect(diffusionCoefficient(5, 1, tHigh)).toBeCloseTo(2 * diffusionCoefficient(5, 1, tLow), 9);
  });

  it('MSD grows linearly with time and RMS as √t (2·d·D·t)', () => {
    const d = diffusionCoefficient(5, 1, 20);
    expect(rmsDisplacement(d, 3, 4)).toBeCloseTo(2 * rmsDisplacement(d, 3, 1), 9); // √4 = 2×
    expect(rmsDisplacement(d, 3, 1) ** 2).toBeCloseTo(2 * 3 * d * 1, 9); // MSD = 2dDt
  });

  it('dimensionality scales the MSD (3D is 3× the 1D value)', () => {
    const d = diffusionCoefficient(5, 1, 20);
    expect(rmsDisplacement(d, 3, 1) ** 2).toBeCloseTo(3 * rmsDisplacement(d, 1, 1) ** 2, 9);
  });

  it('time to cross a 10 µm cell = L²/(2·d·D)', () => {
    const r = run({ radius: 5, viscosity: 1, temperatureC: 20, dimensions: 3 });
    const d = metric(r, 'diffusionCoefficient');
    expect(metric(r, 'timeToCrossCell')).toBeCloseTo(100 / (2 * 3 * d), 6);
  });

  it('reported RMS displacement matches √(2·d·D·t) at the observation time', () => {
    const r = run({
      radius: 8,
      viscosity: 1.2,
      temperatureC: 37,
      dimensions: 2,
      observationTime: 0.5,
    });
    const d = metric(r, 'diffusionCoefficient');
    expect(metric(r, 'rmsDisplacement')).toBeCloseTo(Math.sqrt(2 * 2 * d * 0.5), 9);
  });

  it('thermal energy kB·T ≈ 4.05 pN·nm at 20°C', () => {
    expect(metric(run({ temperatureC: 20 }), 'thermalEnergy')).toBeCloseTo(4.05, 1);
  });

  it('a bigger particle diffuses slower and takes longer to cross the cell', () => {
    const small = run({ radius: 2 });
    const big = run({ radius: 50 });
    expect(metric(big, 'diffusionCoefficient')).toBeLessThan(metric(small, 'diffusionCoefficient'));
    expect(metric(big, 'timeToCrossCell')).toBeGreaterThan(metric(small, 'timeToCrossCell'));
  });

  it('rejects a denormal radius/viscosity and keeps D finite at the bounds (regression)', () => {
    // Previously radius=5e-324 passed positive() then rM=radius*1e-9 underflowed to 0 → D=Infinity.
    expect(() => run({ radius: 5e-324 })).toThrow();
    expect(() => run({ radius: 1e-160, viscosity: 1e-160 })).toThrow();
    // At the tightest allowed radius/viscosity D is still finite and positive.
    const d = metric(run({ radius: 1e-3, viscosity: 1e-6 }), 'diffusionCoefficient');
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(0);
  });

  it('exposes the displacement curve and is deterministic', () => {
    const r = run({ radius: 5, outputPoints: 30 });
    expect(r.series?.[0]?.x).toHaveLength(30);
    expect(r.series?.[0]?.y.rmsDisplacement).toHaveLength(30);
    expect(r.series?.[0]?.y.msd).toHaveLength(30);
    expect(run({ radius: 5 })).toEqual(run({ radius: 5 }));
    expect(spec.slug).toBe('diffusion');
    expect(spec.domain).toBe('biochemistry');
  });
});
