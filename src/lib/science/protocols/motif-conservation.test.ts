import { describe, expect, it } from 'vitest';
import { hashMotifOutput, runMotifConservation } from './motif-conservation';

describe('motif-conservation', () => {
  it('finds an exact motif across genomes and respects domain annotations', () => {
    const out = runMotifConservation({
      motif: 'WSPNGGS',
      genomes: [
        {
          genomeId: 'G1',
          proteins: [
            {
              proteinId: 'p1',
              sequence: 'AAAAWSPNGGSBBBBBBB',
              annotatedDomains: [{ start: 0, end: 3, name: 'Nterm' }],
            },
          ],
        },
        {
          genomeId: 'G2',
          proteins: [{ proteinId: 'p2', sequence: 'CCCWSPNGGSCCC' }],
        },
      ],
      maxMismatches: 0,
      sliceKey: 'demo',
    });
    expect(out.hitGenomes).toEqual(['G1', 'G2']);
    expect(out.hits[0]?.insideAnnotatedDomain).toBe(false);
  });

  it('is deterministic across runs', async () => {
    const inp = {
      motif: 'WSPNGGS',
      genomes: [
        { genomeId: 'G1', proteins: [{ proteinId: 'p1', sequence: 'WSPNGGS' }] },
      ],
      maxMismatches: 0,
      sliceKey: 'demo',
    };
    const a = runMotifConservation(inp);
    const b = runMotifConservation(inp);
    expect(await hashMotifOutput(a)).toEqual(await hashMotifOutput(b));
  });

  it('rejects out-of-range motifs', () => {
    expect(() =>
      runMotifConservation({
        motif: 'AAA',
        genomes: [],
        sliceKey: 'x',
      }),
    ).toThrow();
  });
});
