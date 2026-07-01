import { describe, expect, it } from 'vitest';
import { hashAlphaFoldOutput, runAlphaFoldDisorder } from './alphafold-disorder';

// Helper: build a pLDDT array of given length, filling with `defaultVal`,
// then overwriting the specified index ranges with a patch value.
function makePlddt(
  length: number,
  defaultVal: number,
  patches: Array<{ from: number; to: number; val: number }> = [],
): number[] {
  const arr = Array<number>(length).fill(defaultVal);
  for (const { from, to, val } of patches) {
    for (let i = from; i <= to; i++) arr[i] = val;
  }
  return arr;
}

function makeSeq(length: number): string {
  return 'A'.repeat(length);
}

describe('alphafold-disorder', () => {
  it('finds disorder regions in a mock pLDDT array', () => {
    // 20 residues; positions 3–8 (0-indexed, inclusive) are disordered (pLDDT = 30)
    const plddt = makePlddt(20, 80, [{ from: 3, to: 8, val: 30 }]);
    const out = runAlphaFoldDisorder({
      uniprotAccession: 'P12345',
      plddt,
      sequence: makeSeq(20),
      sliceKey: 'test',
    });

    expect(out.disorderRegions).toHaveLength(1);
    const region = out.disorderRegions[0]!;
    expect(region.start).toBe(3);
    expect(region.end).toBe(8);
    expect(region.length).toBe(6);
    expect(out.disorderedResidues).toBe(6);
    expect(out.totalResidues).toBe(20);
    expect(out.disorderFraction).toBeCloseTo(6 / 20);
  });

  it('merges small gaps in disorder regions', () => {
    // Two disordered patches separated by exactly 2 ordered residues — must merge
    // Positions 0–4 disordered, 5–6 ordered, 7–11 disordered → should be one region
    const plddt = makePlddt(15, 80, [
      { from: 0, to: 4, val: 30 },
      { from: 7, to: 11, val: 30 },
    ]);
    const out = runAlphaFoldDisorder({
      uniprotAccession: 'P12345',
      plddt,
      sequence: makeSeq(15),
      sliceKey: 'test',
    });

    expect(out.disorderRegions).toHaveLength(1);
    expect(out.disorderRegions[0]!.start).toBe(0);
    expect(out.disorderRegions[0]!.end).toBe(11);
  });

  it('does not merge gaps larger than 2 ordered residues', () => {
    // Two disordered patches separated by 3 ordered residues — must stay separate
    // Positions 0–3 disordered, 4–6 ordered (gap=3), 7–10 disordered
    const plddt = makePlddt(15, 80, [
      { from: 0, to: 3, val: 30 },
      { from: 7, to: 10, val: 30 },
    ]);
    const out = runAlphaFoldDisorder({
      uniprotAccession: 'P12345',
      plddt,
      sequence: makeSeq(15),
      sliceKey: 'test',
    });

    expect(out.disorderRegions).toHaveLength(2);
  });

  it('is deterministic — same input produces the same hash', async () => {
    const input = {
      uniprotAccession: 'P12345',
      plddt: makePlddt(30, 70, [{ from: 5, to: 20, val: 25 }]),
      sequence: makeSeq(30),
      sliceKey: 'determinism-check',
    };
    const a = runAlphaFoldDisorder(input);
    const b = runAlphaFoldDisorder(input);
    expect(await hashAlphaFoldOutput(a)).toEqual(await hashAlphaFoldOutput(b));
  });

  it('rejects mismatched pLDDT/sequence lengths', () => {
    expect(() =>
      runAlphaFoldDisorder({
        uniprotAccession: 'P12345',
        plddt: [80, 80, 80],
        sequence: 'AAAA', // length 4 ≠ 3
        sliceKey: 'test',
      }),
    ).toThrow(/pLDDT array length/);
  });

  it('rejects invalid UniProt accession', () => {
    expect(() =>
      runAlphaFoldDisorder({
        uniprotAccession: 'INVALID',
        plddt: [80],
        sequence: 'A',
        sliceKey: 'test',
      }),
    ).toThrow(/UniProt accession/);
  });

  it('returns zero disorder for an all-ordered protein', () => {
    const out = runAlphaFoldDisorder({
      uniprotAccession: 'P12345',
      plddt: makePlddt(10, 90),
      sequence: makeSeq(10),
      sliceKey: 'test',
    });
    expect(out.disorderedResidues).toBe(0);
    expect(out.disorderRegions).toHaveLength(0);
    expect(out.longestDisorderRegion).toBe(0);
    expect(out.noveltyConservationScore).toBe(0);
  });

  it('computes noveltyConservationScore correctly', () => {
    // 10 residues, all disordered → longestStretch=10, disorderFraction=1
    // score = min(1, 10/50) × 1 = 0.2
    const out = runAlphaFoldDisorder({
      uniprotAccession: 'P12345',
      plddt: makePlddt(10, 30),
      sequence: makeSeq(10),
      sliceKey: 'test',
    });
    expect(out.noveltyConservationScore).toBeCloseTo(0.2, 3);
  });
});
