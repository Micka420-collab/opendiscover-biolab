import { describe, expect, it } from 'vitest';
import { breedingParams, genePhenotype, recombinantGametes, spec } from './breeding';

type Gene = (typeof breedingParams._output)['genes'][number];

const geneA: Gene = {
  symbol: 'A',
  name: 'Seed shape',
  alleles: [
    { symbol: 'A', label: 'Round' },
    { symbol: 'a', label: 'Wrinkled' },
  ],
  mode: 'complete',
  dominant: 'A',
};

const phenoProb = (result: ReturnType<typeof spec.run>, label: string) =>
  result.detail?.phenotypeDistribution.find((d) => d.phenotype === label)?.probability ?? 0;

describe('breeding — dominance at a locus', () => {
  it('complete dominance: dominant shows unless homozygous recessive', () => {
    expect(genePhenotype(geneA, ['A', 'A'])).toBe('Round');
    expect(genePhenotype(geneA, ['A', 'a'])).toBe('Round');
    expect(genePhenotype(geneA, ['a', 'a'])).toBe('Wrinkled');
  });

  it('incomplete dominance: heterozygote is a distinct blend', () => {
    const g: Gene = { ...geneA, mode: 'incomplete', dominant: undefined };
    expect(genePhenotype(g, ['A', 'A'])).toBe('Round');
    expect(genePhenotype(g, ['A', 'a'])).toBe('Round-Wrinkled');
    expect(genePhenotype(g, ['a', 'a'])).toBe('Wrinkled');
  });
});

describe('breeding — classical Mendelian ratios', () => {
  it('monohybrid Aa × Aa gives a 3:1 phenotype and 1:2:1 genotype ratio', () => {
    const r = spec.run({
      genes: [geneA],
      parentA: { A: ['A', 'a'] },
      parentB: { A: ['A', 'a'] },
      offspringCount: 0,
    });
    expect(r.detail?.phenotypicRatio).toBe('3:1');
    expect(phenoProb(r, 'Round')).toBeCloseTo(0.75, 10);
    expect(phenoProb(r, 'Wrinkled')).toBeCloseTo(0.25, 10);
    // genotype classes AA, Aa, aa
    expect(r.detail?.genotypeDistribution.length).toBe(3);
    const aa = r.detail?.genotypeDistribution.find((g) => g.genotype === 'aa');
    expect(aa?.probability).toBeCloseTo(0.25, 10);
  });

  it('dihybrid AaBb × AaBb gives 9:3:3:1 across 4 phenotypes', () => {
    const r = spec.run(breedingParams.parse(spec.example));
    expect(r.detail?.phenotypeDistribution.length).toBe(4);
    expect(r.detail?.phenotypicRatio).toBe('9:3:3:1');
    expect(phenoProb(r, 'Round, Yellow')).toBeCloseTo(9 / 16, 10);
    expect(phenoProb(r, 'Wrinkled, Green')).toBeCloseTo(1 / 16, 10);
    // 9 genotype classes for two heterozygous loci (3 × 3)
    expect(r.detail?.genotypeDistribution.length).toBe(9);
  });

  it('incomplete dominance Rr × Rr gives a 1:2:1 phenotype ratio (3 classes)', () => {
    const gene: Gene = {
      symbol: 'R',
      name: 'Flower colour',
      alleles: [
        { symbol: 'R', label: 'Red' },
        { symbol: 'r', label: 'White' },
      ],
      mode: 'incomplete',
    };
    const r = spec.run({
      genes: [gene],
      parentA: { R: ['R', 'r'] },
      parentB: { R: ['R', 'r'] },
      offspringCount: 0,
    });
    expect(r.detail?.phenotypeDistribution.length).toBe(3);
    // 1:2:1 pattern — order-independent (distribution is sorted by probability).
    expect(
      (r.detail?.phenotypicRatio ?? '')
        .split(':')
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([1, 1, 2]);
    expect(phenoProb(r, 'Red-White')).toBeCloseTo(0.5, 10);
  });

  it('test cross Aa × aa gives a 1:1 ratio', () => {
    const r = spec.run({
      genes: [geneA],
      parentA: { A: ['A', 'a'] },
      parentB: { A: ['a', 'a'] },
      offspringCount: 0,
    });
    expect(r.detail?.phenotypicRatio).toBe('1:1');
    expect(phenoProb(r, 'Round')).toBeCloseTo(0.5, 10);
  });

  it('phenotype probabilities sum to 1', () => {
    const r = spec.run(breedingParams.parse(spec.example));
    const total = (r.detail?.phenotypeDistribution ?? []).reduce((s, d) => s + d.probability, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('multi-character allele symbols do not corrupt phenotype derivation (ABO-style locus)', () => {
    // Regression test: genotype pairs used to be represented internally as a
    // concatenated string (e.g. "Aa") and later re-split by character position
    // (pair[0], pair[1]) to recover the two alleles. That round-trip silently
    // produced garbage once a symbol was longer than one character. Model this
    // on the classic ABO blood-group locus (Klug et al., Concepts of Genetics —
    // codominance of I^A and I^B, each dominant to i): IAi × IBi should yield the
    // four distinct genotypes IAIB, IAi, IBi, ii at 1/4 each, with phenotypes
    // built from the correct pair of allele labels rather than mis-sliced
    // substrings ("I"/"A") that collapse distinct genotypes together.
    const geneABO: Gene = {
      symbol: 'I',
      name: 'ABO blood group',
      alleles: [
        { symbol: 'IA', label: 'A-antigen' },
        { symbol: 'IB', label: 'B-antigen' },
        { symbol: 'i', label: 'no antigen' },
      ],
      mode: 'codominant',
    };
    const r = spec.run({
      genes: [geneABO],
      parentA: { I: ['IA', 'i'] },
      parentB: { I: ['IB', 'i'] },
      offspringCount: 0,
    });

    expect(r.detail?.genotypeDistribution.length).toBe(4);
    expect(r.detail?.genotypeDistribution.map((g) => g.genotype).sort()).toEqual(
      ['IAIB', 'IAi', 'IBi', 'ii'].sort(),
    );
    for (const g of r.detail?.genotypeDistribution ?? []) {
      expect(g.probability).toBeCloseTo(0.25, 10);
    }

    expect(r.detail?.phenotypeDistribution.length).toBe(4);
    expect(phenoProb(r, 'A-antigen/B-antigen')).toBeCloseTo(0.25, 10);
    expect(phenoProb(r, 'A-antigen/no antigen')).toBeCloseTo(0.25, 10);
    expect(phenoProb(r, 'B-antigen/no antigen')).toBeCloseTo(0.25, 10);
    expect(phenoProb(r, 'no antigen')).toBeCloseTo(0.25, 10);
    // The old bug collapsed IAIB and IAi to the identical wrong label "I/A".
    expect(phenoProb(r, 'I/A')).toBe(0);
  });
});

describe('breeding — linkage & recombination', () => {
  it('run() always assumes independent assortment; linkage/recombination is not wired in, and the public description says so', () => {
    // `recombinantGametes` is a standalone gamete-frequency helper — it is never
    // called from `run()` (no linkage-phase/recombination-frequency field exists
    // on `breedingParams`), so a dihybrid cross must reproduce the unlinked 9:3:3:1
    // ratio regardless of how "linked" the loci might be in a real organism.
    const r = spec.run(breedingParams.parse(spec.example));
    expect(r.detail?.phenotypicRatio).toBe('9:3:3:1');
    // The public-facing description must not overstate that linkage/recombination
    // is part of the cross computation itself.
    expect(spec.description).toContain('recombinantGametes');
    expect(spec.description).toContain('not used by this cross calculator');
  });

  it('parental gametes get (1-r)/2 and recombinants r/2', () => {
    const g = recombinantGametes(
      [
        ['A', 'B'],
        ['a', 'b'],
      ],
      0.2,
    );
    const parental = g.filter((x) => x.gamete.join('') === 'AB' || x.gamete.join('') === 'ab');
    const recomb = g.filter((x) => x.gamete.join('') === 'Ab' || x.gamete.join('') === 'aB');
    for (const p of parental) expect(p.frequency).toBeCloseTo(0.4, 10);
    for (const rr of recomb) expect(rr.frequency).toBeCloseTo(0.1, 10);
    expect(g.reduce((s, x) => s + x.frequency, 0)).toBeCloseTo(1, 10);
  });

  it('r = 0.5 recovers independent assortment (all gametes 0.25)', () => {
    const g = recombinantGametes(
      [
        ['A', 'B'],
        ['a', 'b'],
      ],
      0.5,
    );
    for (const x of g) expect(x.frequency).toBeCloseTo(0.25, 10);
  });
});

describe('breeding — offspring sampling', () => {
  it('samples the requested number of offspring, deterministically per seed', () => {
    const params = { ...spec.example, offspringCount: 20, seed: 'litter-1' };
    const a = spec.run(params);
    const b = spec.run(params);
    expect(a.detail?.sampledOffspring.length).toBe(20);
    expect(a.detail?.sampledOffspring).toEqual(b.detail?.sampledOffspring);
  });

  it('a different seed generally yields a different litter', () => {
    const a = spec.run({ ...spec.example, offspringCount: 30, seed: 's1' });
    const b = spec.run({ ...spec.example, offspringCount: 30, seed: 's2' });
    expect(a.detail?.sampledOffspring).not.toEqual(b.detail?.sampledOffspring);
  });
});
