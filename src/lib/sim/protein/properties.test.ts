import { describe, expect, it } from 'vitest';
import {
  aliphaticIndex,
  aromaticity,
  extinctionCoefficient280,
  gravy,
  instabilityIndex,
  isStable,
  molecularWeight,
  netChargeAtPH,
  spec,
  theoreticalPI,
} from './properties';

/**
 * These tests validate the science against known analytical / textbook values,
 * not merely "does not throw".
 */

// Average residue masses (Da) — used to build an independent MW reference.
const RESIDUE = {
  I: 113.1594,
  V: 99.1326,
  L: 113.1594,
  A: 71.0788,
  G: 57.0519,
  Y: 163.176,
  F: 147.1766,
  M: 131.1926,
} as const;
const WATER = 18.01524;

describe('GRAVY (Kyte–Doolittle hydropathy)', () => {
  it('is positive for a hydrophobic peptide', () => {
    // I=4.5, V=4.2, L=3.8 -> (2*4.5 + 2*4.2 + 3*3.8)/7 = 28.8/7
    const g = gravy('IIVVLLL');
    expect(g).toBeGreaterThan(0);
    expect(g).toBeCloseTo(28.8 / 7, 6); // 4.1142857
  });

  it('is negative for a charged peptide', () => {
    // D=-3.5, E=-3.5, K=-3.9, R=-4.5 -> -30.8/8 = -3.85
    const g = gravy('DEKRDEKR');
    expect(g).toBeLessThan(0);
    expect(g).toBeCloseTo(-3.85, 6);
  });
});

describe('Theoretical pI', () => {
  it('is basic (>9) for a poly-Lysine peptide', () => {
    expect(theoreticalPI('KKKKKKK')).toBeGreaterThan(9);
  });

  it('is acidic (<4) for a poly-Glutamate peptide', () => {
    expect(theoreticalPI('EEEEEEE')).toBeLessThan(4);
  });

  it('equals the mean of the terminal pKa for a peptide with no ionizable side chains', () => {
    // Only N-term (8.6) and C-term (3.6) titrate -> pI = (8.6 + 3.6)/2 = 6.1
    expect(theoreticalPI('GGGGG')).toBeCloseTo(6.1, 3);
  });

  it('is the point of (near) zero net charge', () => {
    for (const seq of ['KKKKKKK', 'EEEEEEE', 'GGGGG', 'MKWVTFISLLFLFSSAYSR']) {
      const pI = theoreticalPI(seq);
      expect(netChargeAtPH(seq, pI)).toBeCloseTo(0, 2);
    }
  });
});

describe('Molecular weight (average masses + water)', () => {
  it("matches the summed residue masses + one water for 'IIVVLLL'", () => {
    const expected = 2 * RESIDUE.I + 2 * RESIDUE.V + 3 * RESIDUE.L + WATER; // 782.07744
    expect(molecularWeight('IIVVLLL')).toBeCloseTo(expected, 6);
  });

  it('reproduces the free amino-acid weights of Ala and Gly (within ~1 Da)', () => {
    expect(molecularWeight('A')).toBeCloseTo(89.09, 1); // free alanine 89.09
    expect(molecularWeight('G')).toBeCloseTo(75.07, 1); // free glycine 75.07
  });

  it('matches the published Met-enkephalin (YGGFM) mass within 1 Da', () => {
    // Reference average mass ~573.66 Da.
    expect(molecularWeight('YGGFM')).toBeCloseTo(573.66, 1);
  });
});

describe('Extinction coefficient at 280 nm', () => {
  it('matches 5500*W + 1490*Y + 125*C exactly', () => {
    // WWYYC -> 2*5500 + 2*1490 + 1*125 = 14105
    expect(extinctionCoefficient280('WWYYC')).toBe(2 * 5500 + 2 * 1490 + 125);
    expect(extinctionCoefficient280('WYC')).toBe(5500 + 1490 + 125);
  });

  it('is zero for a peptide with no chromophores', () => {
    expect(extinctionCoefficient280('AAAAGG')).toBe(0);
  });
});

describe('Instability index (Guruprasad)', () => {
  it('equals 10*(L-1)/L for a poly-Ala peptide (all DIWV[A][A] = 1.0)', () => {
    // 10 residues -> 9 dipeptides of weight 1.0 -> (10/10)*9 = 9.0, stable
    expect(instabilityIndex('AAAAAAAAAA')).toBeCloseTo(9.0, 6);
    expect(isStable('AAAAAAAAAA')).toBe(true);
  });

  it('flags a high-weight peptide as unstable (>= 40)', () => {
    // R-R dipeptide weight is 58.28 -> 'RRRRRR' II = (10/6)*5*58.28 ~= 485.67
    const ii = instabilityIndex('RRRRRR');
    expect(ii).toBeCloseTo((10 / 6) * 5 * 58.28, 6);
    expect(ii).toBeGreaterThanOrEqual(40);
    expect(isStable('RRRRRR')).toBe(false);
  });
});

describe('Aliphatic index (Ikai)', () => {
  it('gives 100 for poly-Ala, 290 for poly-Val, 390 for poly-Ile/Leu', () => {
    expect(aliphaticIndex('AAAAA')).toBeCloseTo(100, 6);
    expect(aliphaticIndex('VVVVV')).toBeCloseTo(290, 6);
    expect(aliphaticIndex('IIIII')).toBeCloseTo(390, 6);
    expect(aliphaticIndex('LLLLL')).toBeCloseTo(390, 6);
  });
});

describe('Aromaticity', () => {
  it('is the mole fraction of F+W+Y', () => {
    expect(aromaticity('FWYA')).toBeCloseTo(0.75, 6); // 3 of 4
    expect(aromaticity('AAAA')).toBe(0);
  });
});

describe('spec.run', () => {
  it('produces the documented metrics and detail, deterministically', () => {
    const r1 = spec.run({ sequence: 'MKWVTFISLLFLFSSAYSR' });
    const r2 = spec.run({ sequence: 'mkwvtfisllflfssaysr' }); // case-insensitive

    expect(r1.engine).toBe('properties');
    const keys = r1.metrics.map((m) => m.key);
    expect(keys).toEqual([
      'length',
      'molecularWeightDa',
      'theoreticalPI',
      'gravy',
      'instabilityIndex',
      'extinction280',
    ]);

    const length = r1.metrics.find((m) => m.key === 'length');
    expect(length?.value).toBe(19);

    // detail carries composition + charged summary
    expect(r1.detail?.aaComposition.M).toBe(1);
    expect(r1.detail?.charged).toHaveProperty('positive');
    expect(r1.detail?.charged).toHaveProperty('negative');

    // Determinism: identical (cleaned) input -> identical result.
    expect(r2.metrics).toEqual(r1.metrics);
    expect(r2.detail).toEqual(r1.detail);
    expect(r2.series).toEqual(r1.series);
  });

  it('validates the example params and rejects non-standard letters', () => {
    expect(spec.paramsSchema.safeParse(spec.example).success).toBe(true);
    expect(spec.paramsSchema.safeParse({ sequence: 'ACDEXZ' }).success).toBe(false);
    expect(spec.paramsSchema.safeParse({ sequence: '' }).success).toBe(false);
  });
});
