import { describe, expect, it } from 'vitest';
import { isoelectricPoint, netCharge, run, spec } from './protein-charge';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

const SAMPLE = { asp: 5, glu: 5, his: 2, lys: 4, arg: 3 };

describe('protein-charge (isoelectric point)', () => {
  it('net charge falls monotonically with pH (positive when acidic, negative when basic pH)', () => {
    let prev = Number.POSITIVE_INFINITY;
    for (let pH = 0; pH <= 14; pH += 0.25) {
      const z = netCharge(pH, SAMPLE);
      expect(z).toBeLessThanOrEqual(prev + 1e-12);
      prev = z;
    }
    expect(netCharge(0, SAMPLE)).toBeGreaterThan(0); // fully protonated → positive
    expect(netCharge(14, SAMPLE)).toBeLessThan(0); // fully deprotonated → negative
  });

  it('net charge is (essentially) zero at the isoelectric point', () => {
    const pI = isoelectricPoint(SAMPLE);
    expect(Math.abs(netCharge(pI, SAMPLE))).toBeLessThan(1e-6);
    const r = run({ ...SAMPLE, reportPH: 7 });
    expect(metric(r, 'isoelectricPoint')).toBeCloseTo(pI, 6);
    expect(metric(r, 'isoelectricPoint')).toBeCloseTo(4.94, 1); // known pI for this composition
  });

  it('more acidic residues lower the pI; more basic residues raise it', () => {
    const acidic = isoelectricPoint({ asp: 20, glu: 20, his: 0, lys: 0, arg: 0 });
    const basic = isoelectricPoint({ asp: 0, glu: 0, his: 0, lys: 20, arg: 20 });
    expect(acidic).toBeLessThan(5);
    expect(basic).toBeGreaterThan(9);
    expect(basic).toBeGreaterThan(acidic);
  });

  it('the reported pH=7 charge matches netCharge and drives the acidic/basic label', () => {
    const r = run({ ...SAMPLE });
    expect(metric(r, 'chargeAtPH7')).toBeCloseTo(netCharge(7, SAMPLE), 9);
    expect(metric(r, 'chargeAtPH7')).toBeLessThan(0); // pI 4.9 < 7 ⇒ negative at pH 7
  });

  it('a protein with only termini still has a valid pI between the two terminal pKa', () => {
    const pI = isoelectricPoint({ asp: 0, glu: 0, his: 0, lys: 0, arg: 0 });
    expect(pI).toBeGreaterThan(3.55);
    expect(pI).toBeLessThan(8.0);
    expect(Math.abs(netCharge(pI, { asp: 0, glu: 0, his: 0, lys: 0, arg: 0 }))).toBeLessThan(1e-6);
  });

  it('the charge curve crosses zero at the pI shown on the plot', () => {
    const r = run({ ...SAMPLE, outputPoints: 200 });
    const phs = r.series?.[0]?.x ?? [];
    const charge = r.series?.[0]?.y.charge ?? [];
    const pI = metric(r, 'isoelectricPoint');
    // find the sign change in the plotted curve and check it brackets the pI
    let crossed = -1;
    for (let i = 1; i < charge.length; i++) {
      if (charge[i - 1] >= 0 && charge[i] < 0) crossed = i;
    }
    expect(crossed).toBeGreaterThan(0);
    expect(pI).toBeGreaterThanOrEqual(phs[crossed - 1]);
    expect(pI).toBeLessThanOrEqual(phs[crossed]);
  });

  it('rejects non-integer counts and stays finite at the schema bounds', () => {
    expect(() => run({ asp: 5e-324 })).toThrow(); // not an integer → rejected
    expect(() => run({ lys: 2.5 })).toThrow();
    const r = run({
      asp: 100000,
      glu: 100000,
      his: 100000,
      lys: 100000,
      arg: 100000,
      reportPH: 14,
    });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.charge ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the titration curve and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.charge).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('protein-charge');
    expect(spec.domain).toBe('protein');
  });
});
