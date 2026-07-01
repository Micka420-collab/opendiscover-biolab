import { describe, expect, it } from 'vitest';
import {
  adsDesirability,
  ghose,
  lipinski,
  parseSmiles,
  qed,
  smilesToDescriptors,
  spec,
  veber,
} from './admet';

/**
 * These tests validate the science against known chemistry, not merely
 * "does not throw":
 *   - textbook molecular weights of small molecules from the SMILES parser
 *   - the exact Lipinski / Veber / Ghose pass-fail boundaries
 *   - the shape and bounds of the QED desirability model
 *   - determinism (the engine has no randomness, so it must be reproducible)
 */

// Reference average atomic weights used to build independent MW expectations.
const AW = { H: 1.008, C: 12.011, N: 14.007, O: 15.999 } as const;

describe('SMILES parser — atom & heteroatom counting', () => {
  it("ethanol 'CCO' has 2 carbons + 1 oxygen and MW ~46", () => {
    const d = smilesToDescriptors('CCO');
    expect(d.atomCounts.C).toBe(2);
    expect(d.atomCounts.O).toBe(1);
    // C2H6O: 2C + 6H + 1O
    const expected = 2 * AW.C + 6 * AW.H + AW.O; // 46.069
    expect(d.mw).toBeCloseTo(expected, 3);
    expect(d.mw).toBeCloseTo(46.07, 1);
    // ethanol: one O-H donor, one O acceptor, no aromatic/rotatable bonds
    expect(d.hbd).toBe(1);
    expect(d.hba).toBe(1);
    expect(d.aromaticRings).toBe(0);
    expect(d.rotatableBonds).toBe(0);
    expect(d.formula).toBe('C2H6O');
  });

  it('parses branches and double bonds: acetic acid CC(=O)O -> C2H4O2, MW ~60', () => {
    const d = smilesToDescriptors('CC(=O)O');
    expect(d.atomCounts.C).toBe(2);
    expect(d.atomCounts.O).toBe(2);
    const expected = 2 * AW.C + 4 * AW.H + 2 * AW.O; // 60.052
    expect(d.mw).toBeCloseTo(expected, 3);
    expect(d.hbd).toBe(1); // the carboxylic O-H
    expect(d.hba).toBe(2); // two oxygens
  });

  it('benzene c1ccccc1 -> 1 aromatic ring, C6H6, MW ~78.11, no donors/acceptors', () => {
    const d = smilesToDescriptors('c1ccccc1');
    expect(d.atomCounts.C).toBe(6);
    expect(d.aromaticRings).toBe(1);
    expect(d.hbd).toBe(0);
    expect(d.hba).toBe(0);
    expect(d.rotatableBonds).toBe(0); // all bonds are in the ring
    const expected = 6 * AW.C + 6 * AW.H; // 78.114
    expect(d.mw).toBeCloseTo(expected, 3);
    expect(d.formula).toBe('C6H6');
  });

  it('pyridine c1ccncc1 -> C5H5N, one aromatic N acceptor, MW ~79.10', () => {
    const d = smilesToDescriptors('c1ccncc1');
    expect(d.atomCounts.C).toBe(5);
    expect(d.atomCounts.N).toBe(1);
    expect(d.aromaticRings).toBe(1);
    expect(d.hba).toBe(1); // the ring N
    expect(d.hbd).toBe(0); // pyridine N carries no hydrogen
    const expected = 5 * AW.C + 5 * AW.H + AW.N; // 79.102
    expect(d.mw).toBeCloseTo(expected, 3);
  });

  it('naphthalene c1ccc2ccccc2c1 has 2 fused aromatic rings, C10H8', () => {
    const d = smilesToDescriptors('c1ccc2ccccc2c1');
    expect(d.atomCounts.C).toBe(10);
    expect(d.aromaticRings).toBe(2);
    const expected = 10 * AW.C + 8 * AW.H; // 128.174
    expect(d.mw).toBeCloseTo(expected, 3);
    expect(d.formula).toBe('C10H8');
  });

  it('counts a rotatable bond in butane CCCC but none in propane CCC', () => {
    expect(smilesToDescriptors('CCCC').rotatableBonds).toBe(1);
    expect(smilesToDescriptors('CCC').rotatableBonds).toBe(0);
  });

  it('ranks a lipophilic alkane above a polar alcohol (crude logP is monotonic)', () => {
    const hexane = smilesToDescriptors('CCCCCC').logP;
    const ethanol = smilesToDescriptors('CCO').logP;
    expect(hexane).toBeGreaterThan(ethanol);
    expect(Number.isFinite(hexane)).toBe(true);
  });

  it('handles bracket atoms with explicit hydrogens (methane [CH4])', () => {
    const m = parseSmiles('[CH4]');
    expect(m.atoms).toHaveLength(1);
    expect(m.atoms[0]?.element).toBe('C');
    expect(m.atoms[0]?.explicitH).toBe(4);
    const d = smilesToDescriptors('[CH4]');
    expect(d.mw).toBeCloseTo(AW.C + 4 * AW.H, 3); // 16.043
  });
});

describe("Lipinski's Rule of Five", () => {
  // Aspirin: MW ~180, logP ~1.2, HBD 1, HBA 4 -> passes cleanly.
  const aspirin = { mw: 180.16, logP: 1.2, hbd: 1, hba: 4 };

  it('passes aspirin with zero violations', () => {
    const r = lipinski(aspirin);
    expect(r.violations).toBe(0);
    expect(r.pass).toBe(true);
    expect(r.broken).toEqual([]);
  });

  it('flags multiple violations for a large, greasy, H-bond-rich molecule', () => {
    // MW 900 (>500), logP 7 (>5), HBD 8 (>5), HBA 14 (>10) -> 4 violations.
    const r = lipinski({ mw: 900, logP: 7, hbd: 8, hba: 14 });
    expect(r.violations).toBeGreaterThanOrEqual(2);
    expect(r.violations).toBe(4);
    expect(r.pass).toBe(false);
  });

  it('respects the exact boundaries (<= limit passes, one over fails)', () => {
    expect(lipinski({ mw: 500, logP: 5, hbd: 5, hba: 10 }).violations).toBe(0);
    expect(lipinski({ mw: 501, logP: 5, hbd: 5, hba: 10 }).broken).toEqual(['MW > 500']);
    expect(lipinski({ mw: 500, logP: 5.01, hbd: 5, hba: 10 }).broken).toEqual(['logP > 5']);
    expect(lipinski({ mw: 500, logP: 5, hbd: 6, hba: 10 }).broken).toEqual(['HBD > 5']);
    expect(lipinski({ mw: 500, logP: 5, hbd: 5, hba: 11 }).broken).toEqual(['HBA > 10']);
  });
});

describe('Veber rules', () => {
  it('passes a compact molecule and fails a floppy / very polar one', () => {
    expect(veber({ mw: 300, logP: 2, hbd: 1, hba: 4, rotatableBonds: 5, tpsa: 60 }).pass).toBe(
      true,
    );
    expect(veber({ mw: 300, logP: 2, hbd: 1, hba: 4, rotatableBonds: 12, tpsa: 60 }).pass).toBe(
      false,
    );
    expect(veber({ mw: 300, logP: 2, hbd: 1, hba: 4, rotatableBonds: 5, tpsa: 160 }).pass).toBe(
      false,
    );
  });

  it('sits exactly on the boundary (10 rotatable bonds, TPSA 140 pass)', () => {
    expect(veber({ mw: 300, logP: 2, hbd: 1, hba: 4, rotatableBonds: 10, tpsa: 140 }).pass).toBe(
      true,
    );
  });
});

describe('Ghose filter', () => {
  it('accepts aspirin (MW 180, logP 1.2) inside the window', () => {
    expect(ghose({ mw: 180.16, logP: 1.2, hbd: 1, hba: 4 }).pass).toBe(true);
  });

  it('rejects molecules outside the MW or logP window', () => {
    expect(ghose({ mw: 100, logP: 1.2, hbd: 0, hba: 1 }).pass).toBe(false); // MW too small
    expect(ghose({ mw: 300, logP: 6, hbd: 0, hba: 1 }).pass).toBe(false); // logP too high
  });
});

describe('QED desirability model', () => {
  it('every ADS desirability is bounded and peaks near the ideal value', () => {
    // MW desirability peaks near its centre (~291 Da) and collapses for huge MW.
    expect(adsDesirability('MW', 290.75)).toBeGreaterThan(0.9);
    expect(adsDesirability('MW', 900)).toBeLessThan(0.1);
    // HBD desirability is high for a single donor.
    expect(adsDesirability('HBD', 1)).toBeGreaterThan(0.9);
    // Hand-computed reference for one aromatic ring (ADS with published params).
    expect(adsDesirability('AROM', 1)).toBeCloseTo(0.496, 2);
  });

  it('gives a QED in [0,1] and higher for the drug-like molecule', () => {
    const aspirin = qed({
      mw: 180.16,
      logP: 1.2,
      hbd: 1,
      hba: 4,
      tpsa: 63.6,
      rotatableBonds: 3,
      aromaticRings: 1,
    });
    const bloated = qed({
      mw: 900,
      logP: 7,
      hbd: 8,
      hba: 14,
      tpsa: 250,
      rotatableBonds: 20,
      aromaticRings: 0,
    });

    for (const q of [aspirin.qed, bloated.qed]) {
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(1);
    }
    expect(aspirin.qed).toBeGreaterThan(bloated.qed);
    // Alert-free QED of aspirin lands in a reasonable drug-like band.
    expect(aspirin.qed).toBeGreaterThan(0.5);
    expect(bloated.qed).toBeLessThan(0.1);
  });
});

describe('spec.run', () => {
  it('produces the documented metrics and rulePass detail for aspirin descriptors', () => {
    const r = spec.run({
      descriptors: {
        mw: 180.16,
        logP: 1.2,
        hbd: 1,
        hba: 4,
        tpsa: 63.6,
        rotatableBonds: 3,
        aromaticRings: 1,
      },
    });

    expect(r.engine).toBe('admet');
    const keys = r.metrics.map((m) => m.key);
    expect(keys).toEqual(['mw', 'logP', 'hbd', 'hba', 'tpsa', 'lipinskiViolations', 'qed']);

    const violations = r.metrics.find((m) => m.key === 'lipinskiViolations');
    expect(violations?.value).toBe(0);
    const qedMetric = r.metrics.find((m) => m.key === 'qed');
    expect(qedMetric?.value).toBeGreaterThan(0);
    expect(qedMetric?.value).toBeLessThanOrEqual(1);

    expect(r.detail?.rulePass).toEqual({ lipinski: true, veber: true, ghose: true });
  });

  it('runs from a SMILES string (aspirin) and estimates matching descriptors', () => {
    const r = spec.run({ smiles: 'CC(=O)Oc1ccccc1C(=O)O' });
    expect(r.detail?.source).toBe('smiles');
    expect(r.detail?.formula).toBe('C9H8O4');
    const mw = r.metrics.find((m) => m.key === 'mw');
    expect(mw?.value).toBeCloseTo(180.16, 1);
    const hbd = r.metrics.find((m) => m.key === 'hbd');
    expect(hbd?.value).toBe(1);
    const hba = r.metrics.find((m) => m.key === 'hba');
    expect(hba?.value).toBe(4);
    expect(r.detail?.rulePass.lipinski).toBe(true);
  });

  it('is deterministic — identical input yields a deep-equal result', () => {
    const p = { smiles: 'CC(=O)Oc1ccccc1C(=O)O' };
    const r1 = spec.run(p);
    const r2 = spec.run(p);
    expect(r2.metrics).toEqual(r1.metrics);
    expect(r2.detail).toEqual(r1.detail);
    expect(r2.summary).toEqual(r1.summary);
  });

  it('validates the example params and rejects an empty parameter object', () => {
    expect(spec.paramsSchema.safeParse(spec.example).success).toBe(true);
    expect(spec.paramsSchema.safeParse({}).success).toBe(false);
    expect(
      spec.paramsSchema.safeParse({ descriptors: { mw: 300, logP: 2, hbd: 1, hba: 3 } }).success,
    ).toBe(true);
  });
});
