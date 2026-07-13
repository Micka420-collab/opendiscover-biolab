import { describe, expect, it } from 'vitest';
import { isoelectricPoint, netCharge, run, spec } from './protein-charge';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

// No Cys/Tyr, so these assertions match the classic 7-group model exactly.
const SAMPLE = { asp: 5, glu: 5, cys: 0, tyr: 0, his: 2, lys: 4, arg: 3 };

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
    const acidic = isoelectricPoint({ asp: 20, glu: 20, cys: 0, tyr: 0, his: 0, lys: 0, arg: 0 });
    const basic = isoelectricPoint({ asp: 0, glu: 0, cys: 0, tyr: 0, his: 0, lys: 20, arg: 20 });
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
    const termini = { asp: 0, glu: 0, cys: 0, tyr: 0, his: 0, lys: 0, arg: 0 };
    const pI = isoelectricPoint(termini);
    expect(pI).toBeGreaterThan(3.55);
    expect(pI).toBeLessThan(8.0);
    expect(Math.abs(netCharge(pI, termini))).toBeLessThan(1e-6);
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
      cys: 100000,
      tyr: 100000,
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

describe('protein-charge — cysteine & tyrosine ionizable side chains', () => {
  // Cys (thiol, pKa 8.3) and Tyr (phenol, pKa 10.1) are acidic groups. At pH
  // exactly equal to a group's pKa, Henderson–Hasselbalch says it is exactly
  // half-ionized, so adding ONE such residue must shift the net charge by
  // exactly −0.5 at that pH. This is an exact mathematical identity (not a
  // fitted value) and fails on the old 7-group model, which ignored Cys/Tyr
  // entirely (the shift would have been 0).
  it('one Cys shifts the net charge by exactly −0.5 at pH = 8.3', () => {
    const withCys = netCharge(8.3, { ...SAMPLE, cys: 1 });
    const without = netCharge(8.3, { ...SAMPLE, cys: 0 });
    expect(withCys - without).toBeCloseTo(-0.5, 10);
  });

  it('one Tyr shifts the net charge by exactly −0.5 at pH = 10.1', () => {
    const withTyr = netCharge(10.1, { ...SAMPLE, tyr: 1 });
    const without = netCharge(10.1, { ...SAMPLE, tyr: 0 });
    expect(withTyr - without).toBeCloseTo(-0.5, 10);
  });

  it('Cys/Tyr are acidic: adding them substantially lowers a basic protein’s pI', () => {
    // A basic protein (pI well above the Cys/Tyr pKa) is where these groups
    // actually matter. Values independently derived by bisecting the
    // Henderson–Hasselbalch net-charge function (see scratchpad verification).
    const basic = { asp: 1, glu: 1, cys: 0, tyr: 0, his: 1, lys: 8, arg: 6 };
    expect(isoelectricPoint(basic)).toBeCloseTo(12.5218, 3);
    expect(isoelectricPoint({ ...basic, cys: 3, tyr: 5 })).toBeCloseTo(10.5546, 3);
    // The drop is large and unambiguous (≈ 2 pH units), not a rounding artefact.
    expect(isoelectricPoint({ ...basic, cys: 3, tyr: 5 })).toBeLessThan(
      isoelectricPoint(basic) - 1.5,
    );
  });

  it('the acidicGroups metric counts Cys and Tyr (Asp + Glu + Cys + Tyr + C-terminus)', () => {
    const r = run({ asp: 5, glu: 5, cys: 2, tyr: 4, his: 2, lys: 4, arg: 3 });
    expect(metric(r, 'acidicGroups')).toBe(5 + 5 + 2 + 4 + 1); // 17
    expect(metric(r, 'basicGroups')).toBe(2 + 4 + 3 + 1); // 10, unchanged
  });

  it('the documented example (2 Cys, 4 Tyr) reports its exact independently-derived pI', () => {
    const r = run(spec.example);
    expect(metric(r, 'isoelectricPoint')).toBeCloseTo(4.938243862863546, 6);
  });

  it('a purely Cys/Tyr acidic load still yields a monotone curve and a valid pI', () => {
    const c = { asp: 0, glu: 0, cys: 6, tyr: 6, his: 0, lys: 0, arg: 0 };
    let prev = Number.POSITIVE_INFINITY;
    for (let pH = 0; pH <= 14; pH += 0.25) {
      const z = netCharge(pH, c);
      expect(z).toBeLessThanOrEqual(prev + 1e-12);
      prev = z;
    }
    const pI = isoelectricPoint(c);
    expect(Math.abs(netCharge(pI, c))).toBeLessThan(1e-6);
  });
});
