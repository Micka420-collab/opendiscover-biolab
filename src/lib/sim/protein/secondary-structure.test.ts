import { describe, expect, it } from 'vitest';
import {
  CHOU_FASMAN,
  betaTurnProbability,
  findBetaTurns,
  findHelix,
  findSheet,
  getPropensity,
  paramsSchema,
  predictSecondaryStructure,
  run,
  spec,
} from './secondary-structure';

const STANDARD_AA = 'ACDEFGHIKLMNPQRSTVWY'.split('');

describe('Chou-Fasman propensity table', () => {
  it('contains all 20 standard amino acids', () => {
    for (const aa of STANDARD_AA) {
      expect(CHOU_FASMAN[aa], `missing ${aa}`).toBeDefined();
    }
    expect(Object.keys(CHOU_FASMAN)).toHaveLength(20);
  });

  it('reproduces canonical published parameters (spot checks)', () => {
    // These are the textbook Chou–Fasman values (parameter / 100).
    expect(CHOU_FASMAN.A!.pAlpha).toBeCloseTo(1.42, 3); // Ala: strongest helix former
    expect(CHOU_FASMAN.E!.pAlpha).toBeCloseTo(1.51, 3); // Glu: top helix former
    expect(CHOU_FASMAN.V!.pBeta).toBeCloseTo(1.7, 3); // Val: top sheet former
    expect(CHOU_FASMAN.I!.pBeta).toBeCloseTo(1.6, 3); // Ile: strong sheet former
    expect(CHOU_FASMAN.N!.pTurn).toBeCloseTo(1.56, 3); // Asn: strong turn former
    expect(CHOU_FASMAN.P!.pTurn).toBeCloseTo(1.52, 3); // Pro: strong turn former
    expect(CHOU_FASMAN.G!.pTurn).toBeCloseTo(1.56, 3); // Gly: strong turn former
  });

  it('classifies formers vs breakers consistently with biochemistry', () => {
    // Alanine & glutamate are helix formers, sheet breakers.
    expect(CHOU_FASMAN.A!.pAlpha).toBeGreaterThan(1.0);
    expect(CHOU_FASMAN.E!.pAlpha).toBeGreaterThan(1.0);
    expect(CHOU_FASMAN.E!.pBeta).toBeLessThan(1.0);
    // Valine & isoleucine are sheet formers.
    expect(CHOU_FASMAN.V!.pBeta).toBeGreaterThan(1.0);
    expect(CHOU_FASMAN.I!.pBeta).toBeGreaterThan(1.0);
    // Proline is a helix breaker.
    expect(CHOU_FASMAN.P!.pAlpha).toBeLessThan(1.0);
  });

  it('falls back to a neutral, non-nucleating propensity for unknown residues', () => {
    const x = getPropensity('X');
    expect(x.pAlpha).toBe(1.0);
    expect(x.pBeta).toBe(1.0);
    // Neutral residues are strictly not formers (> 1.0 is required to nucleate).
    expect(x.pAlpha > 1.0).toBe(false);
  });
});

describe('helix nucleation & extension', () => {
  it('predicts a poly-alanine stretch as (almost) entirely helix', () => {
    const pred = predictSecondaryStructure('AAAAAAAAAAAAAAA'); // 15 residues
    expect(pred.helixFraction).toBeGreaterThan(0.9);
    expect(pred.sheetFraction).toBe(0);
    expect(pred.assignmentString).toMatch(/^H+$/);
  });

  it('predicts a poly-glutamate stretch as (almost) entirely helix', () => {
    const pred = predictSecondaryStructure('EEEEEEEEEEEEEEE');
    expect(pred.helixFraction).toBeGreaterThan(0.9);
    expect(pred.sheetFraction).toBe(0);
  });

  it('predicts a mixed Ala/Glu helix former block as mostly helix', () => {
    const pred = predictSecondaryStructure('AAAAAEEEEEAAAAA');
    expect(pred.helixFraction).toBeGreaterThan(0.8);
    expect(pred.sheetFraction).toBeLessThan(0.1);
  });

  it('findHelix requires ≥4 of 6 formers to nucleate (no helix in a breaker-rich window)', () => {
    // Glycine (0.57) and proline (0.57) are helix breakers → no nucleus.
    const seq = 'GPGPGPGPGPGP';
    const pAlpha = seq.split('').map((a) => getPropensity(a).pAlpha);
    expect(findHelix(pAlpha).some(Boolean)).toBe(false);
  });
});

describe('sheet nucleation & extension', () => {
  it('predicts a poly-valine stretch as leaning β-sheet, not helix', () => {
    const pred = predictSecondaryStructure('VVVVVVVVVVVVVVV');
    expect(pred.sheetFraction).toBeGreaterThan(0.9);
    // Val P(α)=1.06 would nucleate a helix, but overlap resolution favours the
    // much stronger sheet propensity (P(β)=1.70).
    expect(pred.helixFraction).toBe(0);
  });

  it('predicts a poly-isoleucine stretch as leaning β-sheet', () => {
    const pred = predictSecondaryStructure('IIIIIIIIIIIIIII');
    expect(pred.sheetFraction).toBeGreaterThan(0.9);
    expect(pred.helixFraction).toBe(0);
  });

  it('predicts a mixed Val/Ile stretch as mostly sheet', () => {
    const pred = predictSecondaryStructure('VVVVVIIIIIVVVVV');
    expect(pred.sheetFraction).toBeGreaterThan(0.8);
    expect(pred.helixFraction).toBeLessThan(0.1);
  });

  it('findSheet requires ≥3 of 5 formers to nucleate', () => {
    // Glutamate P(β)=0.37 is a strong sheet breaker → no nucleus.
    const seq = 'EEEEEEEEEE';
    const pBeta = seq.split('').map((a) => getPropensity(a).pBeta);
    expect(findSheet(pBeta).some(Boolean)).toBe(false);
  });
});

describe('overlap resolution', () => {
  it('assigns a Val/Ile block to sheet because ΣP(β) > ΣP(α)', () => {
    const seq = 'VIVIVIVIVI';
    const pAlpha = seq.split('').map((a) => getPropensity(a).pAlpha);
    const pBeta = seq.split('').map((a) => getPropensity(a).pBeta);
    const helix = findHelix(pAlpha);
    const sheet = findSheet(pBeta);
    // Before resolution both structures claim residues.
    expect(helix.some(Boolean)).toBe(true);
    expect(sheet.some(Boolean)).toBe(true);
    // After a real prediction, sheet dominates and no residue is double-counted.
    const pred = predictSecondaryStructure(seq);
    expect(pred.sheetFraction).toBeGreaterThan(pred.helixFraction);
    expect(pred.helixFraction + pred.sheetFraction + pred.coilFraction).toBeCloseTo(1, 10);
  });
});

describe('β-turn prediction', () => {
  it('scores the classic Asn-Pro-Gly-Lys turn motif above the bend-product cutoff', () => {
    // N-P-G-K packs three of the strongest turn formers; a canonical β-turn.
    expect(betaTurnProbability('NPGK')).toBeGreaterThan(7.5e-5);
  });

  it('scores a helix former tetrapeptide well below the turn cutoff', () => {
    expect(betaTurnProbability('AAAA')).toBeLessThan(7.5e-5);
  });

  it('detects a β-turn embedded in a longer sequence', () => {
    const turns = findBetaTurns('AAAANPGKAAAA');
    expect(turns.length).toBeGreaterThanOrEqual(1);
    expect(turns.some((t) => t.residues === 'NPGK')).toBe(true);
  });

  it('reports no β-turn in a pure helix former stretch', () => {
    expect(findBetaTurns('AAAAAAAAAA')).toHaveLength(0);
  });
});

describe('output invariants', () => {
  const sequences = [
    'AAAAAAAAAAAAAAA',
    'VVVVVVVVVVVVVVV',
    'AAAAAAAAANPGKVVVVVVVVV',
    'MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQ',
    'DAEFRHDSGYEVHHQKLVFFAEDVGSNKGAIIGLMVGGVV',
  ];

  it('per-residue output length always equals the input length', () => {
    for (const seq of sequences) {
      const pred = predictSecondaryStructure(seq);
      expect(pred.perResidue).toHaveLength(seq.length);
      expect(pred.assignmentString).toHaveLength(seq.length);
    }
  });

  it('the three fractions always sum to ~1', () => {
    for (const seq of sequences) {
      const pred = predictSecondaryStructure(seq);
      expect(pred.helixFraction + pred.sheetFraction + pred.coilFraction).toBeCloseTo(1, 10);
      expect(pred.helixFraction).toBeGreaterThanOrEqual(0);
      expect(pred.sheetFraction).toBeGreaterThanOrEqual(0);
      expect(pred.coilFraction).toBeGreaterThanOrEqual(0);
    }
  });

  it('fractions match the per-residue assignment counts exactly', () => {
    const seq = 'AAAAAAAAANPGKVVVVVVVVV';
    const pred = predictSecondaryStructure(seq);
    const h = pred.perResidue.filter((r) => r.assignment === 'H').length;
    const e = pred.perResidue.filter((r) => r.assignment === 'E').length;
    const c = pred.perResidue.filter((r) => r.assignment === 'C').length;
    expect(h + e + c).toBe(seq.length);
    expect(pred.helixFraction).toBeCloseTo(h / seq.length, 12);
    expect(pred.sheetFraction).toBeCloseTo(e / seq.length, 12);
    expect(pred.coilFraction).toBeCloseTo(c / seq.length, 12);
  });

  it('segments tile the sequence contiguously with no gaps or overlaps', () => {
    const pred = predictSecondaryStructure('AAAAAAAAANPGKVVVVVVVVV');
    let cursor = 0;
    for (const seg of pred.segments) {
      expect(seg.start).toBe(cursor);
      expect(seg.length).toBe(seg.end - seg.start + 1);
      cursor = seg.end + 1;
    }
    expect(cursor).toBe(pred.sequence.length);
  });
});

describe('determinism', () => {
  it('produces byte-identical predictions for the same input', () => {
    const seq = 'DAEFRHDSGYEVHHQKLVFFAEDVGSNKGAIIGLMVGGVV';
    const a = predictSecondaryStructure(seq);
    const b = predictSecondaryStructure(seq);
    expect(a).toEqual(b);
  });

  it('run() is reproducible for the same params', () => {
    const params = { sequence: 'AAAAAAAAANPGKVVVVVVVVV' };
    expect(run(params)).toEqual(run(params));
  });
});

describe('EngineSpec wrapper', () => {
  it('exposes a well-formed spec', () => {
    expect(spec.slug).toBe('secondary-structure');
    expect(spec.domain).toBe('protein');
    expect(spec.version).toBe('1.0.0');
    expect(typeof spec.run).toBe('function');
    expect(paramsSchema.safeParse(spec.example).success).toBe(true);
  });

  it('run() returns a valid SimResult with required metrics and provenance', () => {
    const res = run(spec.example);
    expect(res.engine).toBe('secondary-structure');
    const keys = res.metrics.map((m) => m.key);
    expect(keys).toContain('helixFraction');
    expect(keys).toContain('sheetFraction');
    expect(keys).toContain('coilFraction');
    expect(res.detail?.perResidue).toHaveLength(normalisedLength(spec.example.sequence));
    expect(res.provenance.engine).toBe('secondary-structure');
    expect(res.provenance.version).toBe('1.0.0');
  });

  it('normalises lowercase input and strips whitespace/non-letters', () => {
    const res = run({ sequence: 'aa aaa\nAAAA 999 AAA' });
    // 12 A's after stripping spaces/newlines/digits.
    expect(res.detail?.sequence).toBe('AAAAAAAAAAAA');
    expect(res.detail?.helixFraction).toBeGreaterThan(0.9);
  });

  it('rejects an empty sequence at the schema level', () => {
    expect(paramsSchema.safeParse({ sequence: '' }).success).toBe(false);
  });

  it('throws when a sequence has no valid amino-acid letters after normalisation', () => {
    expect(() => run({ sequence: '123 456' })).toThrow();
  });
});

function normalisedLength(raw: string): number {
  return raw.toUpperCase().replace(/[^A-Z]/g, '').length;
}
