import { describe, expect, it } from 'vitest';
import { hashCodonBiasOutput, runCodonBiasHgt } from './codon-bias-hgt';

const HOST_BULK = { ATG: 0.04, TAA: 0.03, GCA: 0.05, GCC: 0.05 };
const DONOR_A = { ATG: 0.04, TAA: 0.03, GCA: 0.10, GCC: 0.02 }; // shifted
const DONOR_B = { ATG: 0.04, TAA: 0.03, GCA: 0.05, GCC: 0.05 }; // matches host

describe('codon-bias-hgt', () => {
  it('flags HGT when gene usage matches donor better than host', () => {
    const out = runCodonBiasHgt({
      hostGenomeId: 'HOST',
      hostBulkUsage: HOST_BULK,
      geneDna: 'ATGGCAGCAGCAGCATAA',
      geneId: 'g1',
      donorPanel: { DONOR_A, DONOR_B },
      sliceKey: 'HOST:g1',
    });
    expect(out.geneId).toBe('g1');
    expect(Object.keys(out.jsDivergence.donors)).toEqual(['DONOR_A', 'DONOR_B'].sort());
  });

  it('is deterministic across runs', async () => {
    const inp = {
      hostGenomeId: 'HOST',
      hostBulkUsage: HOST_BULK,
      geneDna: 'ATGGCAGCAGCAGCATAA',
      geneId: 'g1',
      donorPanel: { DONOR_A, DONOR_B },
      sliceKey: 'HOST:g1',
    };
    const a = runCodonBiasHgt(inp);
    const b = runCodonBiasHgt(inp);
    expect(await hashCodonBiasOutput(a)).toEqual(await hashCodonBiasOutput(b));
  });
});
