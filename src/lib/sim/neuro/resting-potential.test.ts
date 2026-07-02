import { describe, expect, it } from 'vitest';
import { ghkVoltage, nernst, run, spec, thermalVoltageMv } from './resting-potential';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('resting-potential (Nernst / GHK)', () => {
  it('thermal voltage RT/F ≈ 26.7 mV at 37°C', () => {
    expect(thermalVoltageMv(37)).toBeCloseTo(26.73, 1);
  });

  it('E_K ≈ −89 mV for [K]o/[K]i = 5/140 at body temperature', () => {
    const rtOverF = thermalVoltageMv(37);
    expect(nernst(5, 140, 1, rtOverF)).toBeCloseTo(rtOverF * Math.log(5 / 140), 12);
    expect(metric(run({}), 'eK')).toBeCloseTo(-89.1, 0);
  });

  it('the Nernst potential flips sign when the gradient reverses', () => {
    const rtOverF = thermalVoltageMv(37);
    expect(nernst(140, 5, 1, rtOverF)).toBeGreaterThan(0); // out > in ⇒ E > 0
    expect(nernst(5, 140, 1, rtOverF)).toBeLessThan(0);
  });

  it('E_Na is positive and E_Cl (anion, z=−1) is negative for physiological gradients', () => {
    const r = run({});
    expect(metric(r, 'eNa')).toBeGreaterThan(0); // [Na]o > [Na]i
    expect(metric(r, 'eCl')).toBeLessThan(0); // anion: [Cl]o > [Cl]i drives E_Cl negative
  });

  it('GHK reduces to the Nernst potential when one permeability dominates', () => {
    // Only K⁺ permeant ⇒ V_m = E_K exactly.
    const r = run({ pK: 1, pNa: 0, pCl: 0 });
    expect(metric(r, 'restingPotential')).toBeCloseTo(metric(r, 'eK'), 10);
    // Only Na⁺ permeant ⇒ V_m = E_Na exactly.
    const rNa = run({ pK: 0, pNa: 1, pCl: 0 });
    expect(metric(rNa, 'restingPotential')).toBeCloseTo(metric(rNa, 'eNa'), 10);
  });

  it('V_m lies between the most negative and most positive ion equilibrium potentials', () => {
    const r = run({});
    const eK = metric(r, 'eK');
    const eNa = metric(r, 'eNa');
    const eCl = metric(r, 'eCl');
    const vm = metric(r, 'restingPotential');
    expect(vm).toBeGreaterThanOrEqual(Math.min(eK, eNa, eCl) - 1e-9);
    expect(vm).toBeLessThanOrEqual(Math.max(eK, eNa, eCl) + 1e-9);
  });

  it('at rest V_m sits near E_K (K⁺ dominates permeability)', () => {
    const r = run({});
    expect(Math.abs(metric(r, 'drivingForceK'))).toBeLessThan(
      Math.abs(metric(r, 'drivingForceNa')),
    );
  });

  it('raising extracellular K⁺ depolarizes the membrane (hyperkalemia)', () => {
    const lowK = metric(run({ ko: 5 }), 'restingPotential');
    const highK = metric(run({ ko: 20 }), 'restingPotential');
    expect(highK).toBeGreaterThan(lowK); // less negative = depolarized
    // The plotted V_m-vs-[K]o sweep is monotonically increasing.
    const s = run({}).series?.[0];
    const vmCurve = s?.y.restingPotential ?? [];
    for (let i = 1; i < vmCurve.length; i++) {
      expect(vmCurve[i]).toBeGreaterThanOrEqual((vmCurve[i - 1] ?? 0) - 1e-9);
    }
  });

  it('warmer temperature widens the Nernst potentials', () => {
    const cold = Math.abs(metric(run({ temperatureC: 6 }), 'eK'));
    const warm = Math.abs(metric(run({ temperatureC: 40 }), 'eK'));
    expect(warm).toBeGreaterThan(cold);
  });

  it('GHK helper matches the metric, and is deterministic', () => {
    const p = { ...spec.example };
    const rtOverF = thermalVoltageMv(37);
    expect(ghkVoltage(p, rtOverF)).toBeCloseTo(metric(run({}), 'restingPotential'), 10);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('resting-potential');
    expect(spec.domain).toBe('neuroscience');
  });
});
