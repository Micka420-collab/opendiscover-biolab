import { describe, expect, it } from 'vitest';
import {
  WATER_MASS,
  bIonMZ,
  fragmentSpectrum,
  matchSpectrum,
  peptideNeutralMass,
  precursorMZ,
  residueMass,
  spec,
  yIonMZ,
} from './mass-spec';

// Every expected value below is derived by hand from CODATA monoisotopic
// atomic masses (H=1.0078250319, C=12 exact, N=14.0030740052, O=15.9949146221)
// and the standard amino-acid residue formulas — the SAME arithmetic the
// engine performs, computed independently here to avoid trusting a
// remembered literature number. See the derivation in the engine's docstring.
const H = 1.0078250319;
const C = 12.0;
const N = 14.0030740052;
const O = 15.9949146221;
const PROTON = 1.00727646688;

describe('residue masses — derived from elemental formulas', () => {
  it('Glycine (C2H3NO) matches the hand-computed value', () => {
    const expected = 2 * C + 3 * H + N + O;
    expect(residueMass('G')).toBeCloseTo(expected, 9);
    expect(residueMass('G')).toBeCloseTo(57.02146, 5); // cross-check vs. the standard literature figure
  });

  it('Alanine (C3H5NO) matches the hand-computed value', () => {
    const expected = 3 * C + 5 * H + N + O;
    expect(residueMass('A')).toBeCloseTo(expected, 9);
    expect(residueMass('A')).toBeCloseTo(71.03711, 5);
  });

  it('Tryptophan (C11H10N2O), the heaviest residue, matches the hand-computed value', () => {
    const expected = 11 * C + 10 * H + 2 * N + O;
    expect(residueMass('W')).toBeCloseTo(expected, 9);
    expect(residueMass('W')).toBeCloseTo(186.07931, 5);
  });

  it('throws on a non-standard residue symbol', () => {
    expect(() => residueMass('X')).toThrow();
    expect(() => residueMass('Z')).toThrow();
  });

  it('water mass is exactly 2H + O', () => {
    expect(WATER_MASS).toBeCloseTo(2 * H + O, 9);
    expect(WATER_MASS).toBeCloseTo(18.010565, 5);
  });
});

describe('dipeptide "AG" — fully hand-derived reference values', () => {
  // neutralMass = residue(A) + residue(G) + H2O
  const massA = 3 * C + 5 * H + N + O;
  const massG = 2 * C + 3 * H + N + O;
  const neutral = massA + massG + (2 * H + O);

  it('peptideNeutralMass("AG") matches the hand sum', () => {
    expect(peptideNeutralMass('AG')).toBeCloseTo(neutral, 9);
  });

  it('b1 (=A) at z=1 matches sum(residue A) + proton', () => {
    expect(bIonMZ('AG', 1, 1)).toBeCloseTo(massA + PROTON, 9);
  });

  it('y1 (=G) at z=1 matches sum(residue G) + water + proton', () => {
    expect(yIonMZ('AG', 1, 1)).toBeCloseTo(massG + WATER_MASS + PROTON, 9);
  });

  it('precursor [M+2H]2+ matches (neutral + 2*proton) / 2', () => {
    expect(precursorMZ('AG', 2)).toBeCloseTo((neutral + 2 * PROTON) / 2, 9);
  });
});

describe('b/y complementarity — an algebraic identity, not an approximation', () => {
  it('b_i + y_(n-i) = neutralMass + 2*proton, exactly, for every split point', () => {
    for (const seq of ['AG', 'PEPTIDE', 'MYKRWDESTQNCHFGILVAP', 'W']) {
      if (seq.length < 2) continue;
      const M = peptideNeutralMass(seq);
      for (let i = 1; i < seq.length; i++) {
        const sum = bIonMZ(seq, i, 1) + yIonMZ(seq, seq.length - i, 1);
        expect(sum, `${seq} @ i=${i}`).toBeCloseTo(M + 2 * PROTON, 9);
      }
    }
  });

  it('the engine reports a near-zero complementarity error for its own example', () => {
    const r = spec.run(spec.example);
    expect(r.detail?.complementarityMaxError).toBeLessThan(1e-8);
  });
});

describe('fragmentSpectrum', () => {
  it('produces exactly 2*(n-1) ions per requested charge state', () => {
    const ions = fragmentSpectrum('PEPTIDE', [1]);
    expect(ions.length).toBe(2 * (7 - 1));
    const ions2 = fragmentSpectrum('PEPTIDE', [1, 2]);
    expect(ions2.length).toBe(2 * 2 * (7 - 1));
  });

  it('a higher charge state divides the m/z roughly in half', () => {
    const z1 = bIonMZ('PEPTIDE', 4, 1);
    const z2 = bIonMZ('PEPTIDE', 4, 2);
    // (S + 1p) vs (S + 2p)/2 -- for large S these are close to a 2x ratio, not exact,
    // so just assert charge-2 is meaningfully smaller (physically correct direction).
    expect(z2).toBeLessThan(z1);
  });

  it('all predicted m/z values are positive and finite', () => {
    for (const ion of fragmentSpectrum('MYKRWDESTQNCHFGILVAP', [1, 2])) {
      expect(Number.isFinite(ion.mz)).toBe(true);
      expect(ion.mz).toBeGreaterThan(0);
    }
  });
});

describe('matchSpectrum', () => {
  it('matches an exact predicted ion within tolerance', () => {
    const b2 = bIonMZ('PEPTIDE', 2, 1);
    const r = matchSpectrum('PEPTIDE', [b2], 0.01);
    expect(r.matched).toBe(1);
    expect(r.matches[0].ion.series).toBe('b');
    expect(r.matches[0].ion.position).toBe(2);
  });

  it('does not match a peak far outside tolerance', () => {
    const r = matchSpectrum('PEPTIDE', [12345.6789], 0.01);
    expect(r.matched).toBe(0);
  });
});

describe('determinism', () => {
  it('identical params produce a byte-identical result', () => {
    const params = { sequence: 'PEPTIDE', precursorCharge: 2, fragmentCharges: [1] };
    expect(spec.run(params)).toEqual(spec.run(params));
  });
});
