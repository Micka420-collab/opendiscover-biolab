import { describe, expect, it } from 'vitest';
import { hashOutput, runSmallOrfMining } from './small-orf-mining';

const TEST_SEQ =
  // A small synthetic sequence containing one easy ORF: ATG ... TAA, 25 aa.
  'CCCCCC' +
  'ATG' +
  'GCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCAGCA' +
  'TAA' +
  'CCCCCC';

describe('small-orf-mining', () => {
  it('finds the planted ORF in the + strand', () => {
    const result = runSmallOrfMining({
      genomeId: 'TEST',
      sequence: TEST_SEQ,
      windowStart: 1,
      minAa: 20,
      maxAa: 100,
      zThreshold: -10, // disable filter for this test
      sliceKey: 'TEST:1',
    });
    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits.some((h) => h.startCodon === 'ATG' && h.strand === '+')).toBe(true);
  });

  it('is deterministic across runs', async () => {
    const a = runSmallOrfMining({
      genomeId: 'TEST',
      sequence: TEST_SEQ,
      windowStart: 1,
      sliceKey: 'TEST:1',
      zThreshold: -10,
    });
    const b = runSmallOrfMining({
      genomeId: 'TEST',
      sequence: TEST_SEQ,
      windowStart: 1,
      sliceKey: 'TEST:1',
      zThreshold: -10,
    });
    expect(await hashOutput(a)).toEqual(await hashOutput(b));
  });
});
