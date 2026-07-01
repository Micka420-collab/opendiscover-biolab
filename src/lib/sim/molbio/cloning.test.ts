import { describe, expect, it } from 'vitest';
import {
  ENZYMES,
  assemble,
  cloningSpec,
  digest,
  findSites,
  getEnzyme,
  overlapLength,
  reverseComplement,
  sanitize,
} from './cloning';

describe('enzyme table', () => {
  it('contains at least the 12 required Type IIP enzymes', () => {
    const names = ENZYMES.map((e) => e.name);
    for (const required of [
      'EcoRI',
      'BamHI',
      'HindIII',
      'NotI',
      'XhoI',
      'PstI',
      'SmaI',
      'EcoRV',
      'KpnI',
      'SacI',
      'SpeI',
      'NcoI',
    ]) {
      expect(names).toContain(required);
    }
    expect(ENZYMES.length).toBeGreaterThanOrEqual(12);
  });

  it('stores correct recognition sites', () => {
    // Textbook recognition sequences (NEB / REBASE), all 12 bundled enzymes.
    expect(getEnzyme('EcoRI').site).toBe('GAATTC');
    expect(getEnzyme('BamHI').site).toBe('GGATCC');
    expect(getEnzyme('HindIII').site).toBe('AAGCTT');
    expect(getEnzyme('NotI').site).toBe('GCGGCCGC');
    expect(getEnzyme('XhoI').site).toBe('CTCGAG');
    expect(getEnzyme('PstI').site).toBe('CTGCAG');
    expect(getEnzyme('SmaI').site).toBe('CCCGGG');
    expect(getEnzyme('EcoRV').site).toBe('GATATC');
    expect(getEnzyme('KpnI').site).toBe('GGTACC');
    expect(getEnzyme('SacI').site).toBe('GAGCTC');
    expect(getEnzyme('SpeI').site).toBe('ACTAGT');
    expect(getEnzyme('NcoI').site).toBe('CCATGG');
  });

  it('every recognition site is palindromic (its own reverse complement)', () => {
    // This is the modeling assumption that makes forward-strand search complete.
    for (const e of ENZYMES) {
      expect(reverseComplement(e.site)).toBe(e.site);
    }
  });

  it('rejects unknown enzyme names', () => {
    expect(() => getEnzyme('NotAnEnzyme')).toThrow();
  });
});

describe('sequence utilities', () => {
  it('reverse complements correctly', () => {
    expect(reverseComplement('GAATTC')).toBe('GAATTC'); // palindrome
    expect(reverseComplement('ATGC')).toBe('GCAT');
    expect(reverseComplement('AAAACCCGGT')).toBe('ACCGGGTTTT');
  });

  it('sanitize uppercases, strips whitespace, and validates alphabet', () => {
    expect(sanitize(' ga att cc ')).toBe('GAATTCC');
    expect(sanitize('gaattc')).toBe('GAATTC');
    expect(() => sanitize('GAXTTC')).toThrow();
    expect(() => sanitize('   ')).toThrow();
  });
});

describe('findSites — EcoRI at a known index', () => {
  // GAATTC begins at index 4 of this constructed sequence.
  const seq = 'AAAAGAATTCTTTT';

  it('locates the EcoRI recognition site at the constructed index', () => {
    const hits = findSites(seq, getEnzyme('EcoRI'));
    expect(hits).toHaveLength(1);
    expect(hits[0].position).toBe(4); // recognition-site start
    expect(hits[0].cutPosition).toBe(5); // G^AATTC -> cut after the G (index 4+1)
    // The site really is there:
    expect(seq.slice(hits[0].position, hits[0].position + 6)).toBe('GAATTC');
  });

  it('reports the correct EcoRI 5-prime AATT overhang', () => {
    const hits = findSites(seq, getEnzyme('EcoRI'));
    expect(hits[0].overhang).toBe('AATT');
    expect(hits[0].overhangType).toBe("5'");
  });

  it('finds two sites when the sequence has two', () => {
    const two = 'GAATTCAAAAGAATTC'; // sites at index 0 and 10
    const hits = findSites(two, getEnzyme('EcoRI'));
    expect(hits.map((h) => h.position)).toEqual([0, 10]);
  });
});

describe('overhang chemistry across enzymes', () => {
  // Known overhangs from the enzyme literature. 5-prime sticky, 3-prime sticky, blunt.
  const cases: Array<[string, string, string]> = [
    ['EcoRI', 'AATT', "5'"],
    ['BamHI', 'GATC', "5'"],
    ['HindIII', 'AGCT', "5'"],
    ['NotI', 'GGCC', "5'"],
    ['XhoI', 'TCGA', "5'"],
    ['SpeI', 'CTAG', "5'"],
    ['NcoI', 'CATG', "5'"],
    ['PstI', 'TGCA', "3'"],
    ['KpnI', 'GTAC', "3'"],
    ['SacI', 'AGCT', "3'"],
    ['SmaI', '', 'blunt'],
    ['EcoRV', '', 'blunt'],
  ];

  for (const [name, overhang, type] of cases) {
    it(`${name} leaves ${type} overhang "${overhang}"`, () => {
      // Wrap the site in flanks so it is internal.
      const e = getEnzyme(name);
      const seq = `TTTTTT${e.site}TTTTTT`;
      const hits = findSites(seq, e);
      expect(hits).toHaveLength(1);
      expect(hits[0].overhang).toBe(overhang);
      expect(hits[0].overhangType).toBe(type);
    });
  }
});

describe('digest — fragment counting', () => {
  it('a sequence with zero sites yields exactly one fragment', () => {
    const noSite = 'AAAACCCCGGGGTTTT'; // no GAATTC
    const frags = digest(noSite, ['EcoRI']);
    expect(frags).toHaveLength(1);
    expect(frags[0].length).toBe(noSite.length);
    expect(frags[0].sequence).toBe(noSite);
    // Native (uncut) linear termini.
    expect(frags[0].leftEnd.enzyme).toBeNull();
    expect(frags[0].rightEnd.enzyme).toBeNull();
  });

  it('one EcoRI site: linear gives 2 fragments, circular gives 1 (differ by one)', () => {
    const seq = 'AAAAGAATTCTTTT'; // single site
    const linear = digest(seq, ['EcoRI'], { circular: false });
    const circular = digest(seq, ['EcoRI'], { circular: true });
    expect(linear).toHaveLength(2);
    expect(circular).toHaveLength(1);
    expect(linear.length - circular.length).toBe(1);
  });

  it('two EcoRI sites: linear gives 3 fragments, circular gives 2 (differ by one)', () => {
    const seq = 'GAATTCAAAAGAATTCCCCC'; // two sites
    const linear = digest(seq, ['EcoRI'], { circular: false });
    const circular = digest(seq, ['EcoRI'], { circular: true });
    expect(linear).toHaveLength(3);
    expect(circular).toHaveLength(2);
    expect(linear.length - circular.length).toBe(1);
  });

  it('linear fragment lengths sum to the template length', () => {
    const seq = 'AAAAGAATTCTTTTGGATCCGGGG';
    const frags = digest(seq, ['EcoRI', 'BamHI'], { circular: false });
    const total = frags.reduce((s, f) => s + f.length, 0);
    expect(total).toBe(seq.length);
  });

  it('circular fragment lengths sum to the template length', () => {
    const seq = 'GAATTCAAAAGAATTCCCCC';
    const frags = digest(seq, ['EcoRI'], { circular: true });
    const total = frags.reduce((s, f) => s + f.length, 0);
    expect(total).toBe(seq.length);
  });

  it('cut coordinates and fragment ends carry the enzyme + overhang', () => {
    const seq = 'AAAAGAATTCTTTT';
    const [left, right] = digest(seq, ['EcoRI']);
    // Left fragment: native left end, EcoRI right end.
    expect(left.length).toBe(5); // "AAAAG"
    expect(left.sequence).toBe('AAAAG');
    expect(left.rightEnd.enzyme).toBe('EcoRI');
    expect(left.rightEnd.overhang).toBe('AATT');
    // Right fragment: EcoRI left end, native right end.
    expect(right.length).toBe(9); // "AATTCTTTT"
    expect(right.sequence).toBe('AATTCTTTT');
    expect(right.leftEnd.enzyme).toBe('EcoRI');
  });

  it('circular fragments always satisfy end >= start, even the wrap-around one', () => {
    // Two EcoRI sites (cutPositions 1 and 11) on a 20 bp circle: the fragment
    // that starts at cutPosition 11 and runs back around to cutPosition 1
    // wraps the origin, so its reported `end` (= start + length) exceeds n.
    const seq = 'GAATTCAAAAGAATTCCCCC';
    const n = seq.length;
    const frags = digest(seq, ['EcoRI'], { circular: true });
    expect(frags).toHaveLength(2);
    for (const f of frags) {
      expect(f.end).toBeGreaterThanOrEqual(f.start);
      expect(f.end - f.start).toBe(f.length);
    }
    const wrapFrag = frags.find((f) => f.end > n);
    expect(wrapFrag).toBeDefined();
    expect(wrapFrag?.start).toBe(11);
    expect(wrapFrag?.end).toBe(21); // start(11) + length(10), past the origin at n=20
    expect(wrapFrag?.sequence).toBe('AATTCCCCCG');
  });

  it('finds a site spanning the origin only on a circular template', () => {
    // "TTC...GAA" — the site GAATTC is split across the origin: the trailing "GAA"
    // joins the leading "TTC" when the molecule is circular.
    const seq = 'TTCAAAAAAAAGAA'; // linear: no site; circular: site wraps origin
    expect(findSites(seq, getEnzyme('EcoRI'), false)).toHaveLength(0);
    const wrapped = findSites(seq, getEnzyme('EcoRI'), true);
    expect(wrapped).toHaveLength(1);
    expect(wrapped[0].position).toBe(11); // "GAA" starts at index 11, "TTC" wraps around
  });
});

describe('overlap (Gibson-style) assembly', () => {
  it('computes the maximum terminal overlap length', () => {
    const a = 'TTTTTTTTTTACGTACGTACGTACGT';
    const b = 'ACGTACGTACGTACGTGGGGGGGGGG';
    // Shared "ACGTACGTACGTACGT" = 16 bp.
    expect(overlapLength(a, b, 15)).toBe(16);
    expect(overlapLength(a, b, 17)).toBe(0); // below threshold -> none
    // Order matters: b's suffix does not match a's prefix.
    expect(overlapLength(b, a, 15)).toBe(0);
  });

  it('joins two fragments sharing terminal homology into one contig', () => {
    const overlap = 'ACGTACGTACGTACGT'; // 16 bp
    const left = `TTTTTTTTTT${overlap}`;
    const right = `${overlap}GGGGGGGGGG`;
    const result = assemble([left, right], { minOverlap: 15 });
    expect(result.contigCount).toBe(1);
    // The overlap appears exactly once in the product.
    expect(result.product).toBe(`TTTTTTTTTT${overlap}GGGGGGGGGG`);
    expect(result.product.length).toBe(10 + 16 + 10);
  });

  it('assembles three fragments regardless of input order', () => {
    const oAB = 'ACGTACGTACGTACGT';
    const oBC = 'TTGGTTGGTTGGTTGG';
    const fragA = `AAAAAAAAAA${oAB}`;
    const fragB = `${oAB}CCCCCCCCCC${oBC}`;
    const fragC = `${oBC}GGGGGGGGGG`;
    const expected = `AAAAAAAAAA${oAB}CCCCCCCCCC${oBC}GGGGGGGGGG`;
    // Deterministic regardless of order.
    for (const order of [
      [fragA, fragB, fragC],
      [fragC, fragA, fragB],
      [fragB, fragC, fragA],
    ]) {
      const result = assemble(order, { minOverlap: 15 });
      expect(result.contigCount).toBe(1);
      expect(result.product).toBe(expected);
    }
  });

  it('does not join fragments whose overlap is below the threshold', () => {
    const a = 'AAAAAAAAAAACGT'; // only 3-4 bp of possible homology
    const b = 'ACGTGGGGGGGGGG';
    const result = assemble([a, b], { minOverlap: 15 });
    expect(result.contigCount).toBe(2);
  });

  it('circularises a contig on a terminal self-overlap', () => {
    const junction = 'ACGTACGTACGTACGT'; // 16 bp shared at both ends
    // A linear insert flanked by the same homology on both ends.
    const frag = `${junction}CCCCCCCCCCTTTTTTTTTT${junction}`;
    const result = assemble([frag], { minOverlap: 15, circular: true });
    expect(result.circular).toBe(true);
    // The duplicated junction is collapsed to a single copy in the circle.
    expect(result.product).toBe(`${junction}CCCCCCCCCCTTTTTTTTTT`);
  });
});

describe('engine spec', () => {
  it('exposes correct metadata', () => {
    expect(cloningSpec.slug).toBe('cloning');
    expect(cloningSpec.domain).toBe('molecular-biology');
    expect(cloningSpec.version).toBe('1.0.0');
    expect(typeof cloningSpec.run).toBe('function');
  });

  it('validates params via the zod schema', () => {
    expect(() =>
      cloningSpec.paramsSchema.parse({ sequence: 'GAATTC', enzymes: ['EcoRI'] }),
    ).not.toThrow();
    expect(() => cloningSpec.paramsSchema.parse({ sequence: 'GAATTC', enzymes: [] })).toThrow();
  });

  it('runs the bundled example and returns a well-formed SimResult', () => {
    const res = cloningSpec.run(cloningSpec.example);
    expect(res.engine).toBe('cloning');
    // Example has one EcoRI and one BamHI site -> 2 cuts -> 3 fragments (linear).
    const fragmentCount = res.metrics.find((m) => m.key === 'fragmentCount')?.value;
    const siteCount = res.metrics.find((m) => m.key === 'siteCount')?.value;
    expect(siteCount).toBe(2);
    expect(fragmentCount).toBe(3);
    expect(res.detail?.fragments).toHaveLength(3);
    expect(res.provenance.engine).toBe('cloning');
    expect(res.provenance.version).toBe('1.0.0');
  });

  it('is deterministic: identical params yield identical results', () => {
    const params = {
      sequence: 'AAAAGAATTCTTTTGGATCCGGGG',
      enzymes: ['EcoRI', 'BamHI'],
      circular: false,
    };
    const a = cloningSpec.run(params);
    const b = cloningSpec.run(params);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('summarises fragment metrics consistently', () => {
    const res = cloningSpec.run({
      sequence: 'AAAAGAATTCTTTT',
      enzymes: ['EcoRI'],
      circular: false,
    });
    const largest = res.metrics.find((m) => m.key === 'largestFragment')?.value;
    const smallest = res.metrics.find((m) => m.key === 'smallestFragment')?.value;
    expect(largest).toBe(9);
    expect(smallest).toBe(5);
  });
});
