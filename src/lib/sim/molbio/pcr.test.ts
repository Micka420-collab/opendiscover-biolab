import { describe, expect, it } from 'vitest';
import {
  baseCounts,
  designPrimers,
  findBindingSites,
  gcPercent,
  gcTm,
  hairpin,
  isSelfComplementary,
  nnThermo,
  nnTm,
  normalizeSeq,
  primerTm,
  revComp,
  selfDimer,
  simulatePcr,
  spec,
  wallaceTm,
} from './pcr';

// ---------------------------------------------------------------------------
// A hand-built template with known, unique 20-mer primer sites so the amplicon
// length and sequence are exactly predictable.
//   [PREFIX 10][FWD 20][MIDDLE 60][RTOP 20][SUFFIX 10]  => 120 nt total
//   amplicon = FWD + MIDDLE + RTOP = 100 bp, spanning template[10, 110).
// ---------------------------------------------------------------------------
const PREFIX = 'CAGTCAGTCA'; // 10
const FWD = 'ATGCGTACCGGATCCAAGCT'; // 20 (forward primer, identical to top strand)
const MIDDLE = 'CGATTAGCGCTAGGTTCACCTGATCGATCACTGGATCCTTAGCACGTTACGGATCGTACA'; // 60
const RTOP = 'TTGCAGCTAAGGCATCGTAC'; // 20 (top-strand region the reverse primer binds)
const SUFFIX = 'GGATCCGGAT'; // 10
const TEMPLATE = PREFIX + FWD + MIDDLE + RTOP + SUFFIX;
const REV = revComp(RTOP); // reverse primer = reverse-complement of RTOP

/** Independent GC-percent counter used to cross-check the engine (non-circular). */
function gcPctIndependent(seq: string): number {
  let gc = 0;
  for (const c of seq) if (c === 'G' || c === 'C') gc++;
  return (100 * gc) / seq.length;
}

describe('sequence primitives', () => {
  it('template and parts have the constructed lengths', () => {
    expect(PREFIX.length).toBe(10);
    expect(FWD.length).toBe(20);
    expect(MIDDLE.length).toBe(60);
    expect(RTOP.length).toBe(20);
    expect(SUFFIX.length).toBe(10);
    expect(TEMPLATE.length).toBe(120);
  });

  it('revComp is an involution and reverse-complements correctly', () => {
    expect(revComp('ATGC')).toBe('GCAT');
    expect(revComp(revComp(RTOP))).toBe(RTOP);
    // EcoRI site is a palindrome.
    expect(revComp('GAATTC')).toBe('GAATTC');
    expect(isSelfComplementary('GAATTC')).toBe(true);
    expect(isSelfComplementary('ATGCGT')).toBe(false);
  });
});

describe('binding-site search', () => {
  it('finds the exact forward primer site uniquely', () => {
    const sites = findBindingSites(TEMPLATE, FWD);
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ start: 10, end: 30, mismatches: 0 });
  });

  it('locates the reverse primer on the top strand via its reverse-complement', () => {
    // revComp(REV) === RTOP, which sits at [90, 110).
    expect(revComp(REV)).toBe(RTOP);
    const sites = findBindingSites(TEMPLATE, revComp(REV));
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ start: 90, end: 110, mismatches: 0 });
  });

  it('rejects an interior mismatch when exact, but allows a 3′-anchored match', () => {
    // Introduce one internal mismatch near the 5′ end of the forward primer.
    const mutated = `${'C'}${FWD.slice(1)}`; // first base A -> C (5′ end, away from 3′ anchor)
    expect(findBindingSites(TEMPLATE, mutated)).toHaveLength(0); // exact: no site
    const anchored = findBindingSites(TEMPLATE, mutated, { maxMismatches: 1, threePrimeAnchor: 5 });
    expect(anchored).toHaveLength(1);
    expect(anchored[0]).toMatchObject({ start: 10, end: 30, mismatches: 1 });

    // A mismatch INSIDE the 3′ anchor window must still be rejected.
    const badTail = `${FWD.slice(0, 19)}${FWD[19] === 'T' ? 'A' : 'T'}`; // mutate final 3′ base
    expect(
      findBindingSites(TEMPLATE, badTail, { maxMismatches: 1, threePrimeAnchor: 5 }),
    ).toHaveLength(0);
  });
});

describe('simulatePcr — amplicon prediction', () => {
  const amplicons = simulatePcr(TEMPLATE, FWD, REV);

  it('produces exactly one amplicon of the expected length and coordinates', () => {
    expect(amplicons).toHaveLength(1);
    const amp = amplicons[0];
    expect(amp.length).toBe(100); // FWD(20) + MIDDLE(60) + RTOP(20)
    expect(amp.start).toBe(10);
    expect(amp.end).toBe(110);
  });

  it('returns the exact amplicon sequence (top strand)', () => {
    const amp = amplicons[0];
    expect(amp.sequence).toBe(FWD + MIDDLE + RTOP);
    expect(amp.sequence).toBe(TEMPLATE.slice(10, 110));
    // The reverse primer really matches the reverse strand of the product's 3′ end.
    expect(revComp(amp.sequence.slice(-RTOP.length))).toBe(REV);
  });

  it('yields no product when the reverse primer faces the wrong way', () => {
    // Using RTOP itself (not its reverse-complement) as the reverse primer must fail.
    expect(simulatePcr(TEMPLATE, FWD, RTOP)).toHaveLength(0);
  });
});

describe('melting temperature formulae', () => {
  it('Wallace 2+4 rule matches the hand calculation', () => {
    // ATGCATGCAT: A=3,T=3,G=2,C=2 -> 2*(6) + 4*(4) = 28.
    expect(wallaceTm('ATGCATGCAT')).toBe(28);
    // 'auto' uses Wallace below 14 nt.
    expect(primerTm('ATGCATGCAT', 'auto')).toBe(28);
  });

  it('Marmur–Doty GC formula matches the hand calculation for the forward primer', () => {
    // FWD has 11 GC over 20 nt: 64.9 + 41*(11-16.4)/20 = 53.83 °C.
    const { G, C } = baseCounts(FWD);
    expect(G + C).toBe(11);
    expect(gcTm(FWD)).toBeCloseTo(53.83, 2);
    expect(primerTm(FWD, 'auto')).toBeCloseTo(53.83, 2); // 20 nt -> GC formula
  });

  it('nearest-neighbour ΔH/ΔS/ΔG match SantaLucia (1998) for 5′-CGTTGA-3′', () => {
    // NN sum: CG,GT,TT,TG,GA plus terminal G·C and A·T initiation.
    const { dH, dS, dG37 } = nnThermo('CGTTGA');
    expect(dH).toBeCloseTo(-41.2, 1); // kcal/mol
    expect(dS).toBeCloseTo(-115.4, 1); // cal/mol/K
    expect(dG37).toBeCloseTo(-5.4, 1); // kcal/mol (published ≈ -5.4)
  });

  it('NN Tm is physically bounded and monotonic in GC content', () => {
    const gcRich = nnTm('GCGCGCGCGCGCGCGCGCGC'); // 20-mer, 100% GC
    const atRich = nnTm('ATATATATATATATATATAT'); // 20-mer, 0% GC
    const mixed = nnTm(FWD); // ~55% GC
    expect(gcRich).toBeGreaterThan(mixed);
    expect(mixed).toBeGreaterThan(atRich);
    // A mixed 20-mer primer sits in a sensible PCR window at 50 mM Na+.
    expect(mixed).toBeGreaterThan(30);
    expect(mixed).toBeLessThan(75);
  });
});

describe('self-dimer and hairpin checks', () => {
  it('detects a fully self-complementary (palindromic) primer', () => {
    // GAATTC pairs with itself base-for-base -> a run equal to its length.
    const d = selfDimer('GAATTC');
    expect(d.maxRun).toBe(6);
    expect(d.threePrimeDimer).toBe(true);
  });

  it('reports no self-dimer for a homopolymer that cannot base-pair with itself', () => {
    expect(selfDimer('AAAAAAAAAA').maxRun).toBe(0);
  });

  it('detects an obvious hairpin (GGGG...CCCC stem with a loop)', () => {
    const h = hairpin('GGGGAAAACCCC');
    expect(h.hasHairpin).toBe(true);
    expect(h.stemLength).toBe(4); // GGGG:CCCC
    expect(h.loopSize).toBe(4); // AAAA loop
  });

  it('reports no hairpin for a sequence with no fold-back complementarity', () => {
    expect(hairpin('AAAAAAAAAAAA').hasHairpin).toBe(false);
  });
});

describe('primer design', () => {
  const target = TEMPLATE; // 120 nt, plenty long to design flanking primers
  const pair = designPrimers(target, { length: 20, tmTarget: 55, tmMethod: 'gc' });

  it('forward primer is a 5′ prefix of the target ending in a GC clamp', () => {
    expect(target.startsWith(pair.forward.sequence)).toBe(true);
    expect(pair.forward.gcClamp).toBe(true);
    const last = pair.forward.sequence.at(-1);
    expect(last === 'G' || last === 'C').toBe(true);
  });

  it('reverse primer is the reverse-complement of the 3′ end ending in a GC clamp', () => {
    const rev = pair.reverse.sequence;
    expect(revComp(target.slice(target.length - rev.length))).toBe(rev);
    expect(pair.reverse.gcClamp).toBe(true);
  });

  it('designed primer Tm is near the requested target', () => {
    expect(Math.abs(pair.forward.tm - 55)).toBeLessThan(10);
    expect(Math.abs(pair.reverse.tm - 55)).toBeLessThan(10);
  });

  it('the designed pair amplifies the whole target in-silico', () => {
    const products = simulatePcr(target, pair.forward.sequence, pair.reverse.sequence);
    expect(products.length).toBeGreaterThanOrEqual(1);
    const spanning = products.find((p) => p.length === target.length);
    expect(spanning).toBeDefined();
  });
});

describe('spec.run — end-to-end engine contract', () => {
  it('reports amplicon length, primer Tms and product GC for the example', () => {
    const result = spec.run(spec.example);
    expect(result.engine).toBe('pcr');

    const metricMap = Object.fromEntries(result.metrics.map((m) => [m.key, m.value]));
    expect(metricMap.ampliconLength).toBe(100);
    // Product GC cross-checked against an independent counter.
    const amp = result.detail?.amplicon;
    expect(amp).not.toBeNull();
    expect(metricMap.productGcPercent).toBeCloseTo(gcPctIndependent(amp!.sequence), 6);
    expect(metricMap.productGcPercent).toBeCloseTo(gcPercent(amp!.sequence), 6);

    // Forward Tm (auto -> GC formula for a 20-mer) equals the hand value.
    expect(metricMap.fwdTm).toBeCloseTo(53.83, 2);
    expect(metricMap.fwdTm).toBeGreaterThan(45);
    expect(metricMap.fwdTm).toBeLessThan(65);
    expect(metricMap.revTm).toBeGreaterThan(45);
    expect(metricMap.revTm).toBeLessThan(65);

    expect(result.provenance).toMatchObject({ engine: 'pcr', version: '1.0.0' });
  });

  it('auto-designs primers when none are supplied and still amplifies', () => {
    const result = spec.run({
      template: TEMPLATE,
      primerLength: 20,
      tmTarget: 55,
      tmMethod: 'gc',
      maxMismatches: 0,
      seed: 'pcr',
    });
    expect(result.detail?.primers.autoDesigned).toBe(true);
    const metricMap = Object.fromEntries(result.metrics.map((m) => [m.key, m.value]));
    expect(metricMap.ampliconLength).toBeGreaterThan(0);
  });

  it('warns and returns zero-length product for non-flanking primers', () => {
    const result = spec.run({
      template: TEMPLATE,
      forwardPrimer: FWD,
      reversePrimer: RTOP, // wrong orientation -> no product
      primerLength: 20,
      tmTarget: 58,
      tmMethod: 'auto',
      maxMismatches: 0,
      seed: 'pcr',
    });
    const metricMap = Object.fromEntries(result.metrics.map((m) => [m.key, m.value]));
    expect(metricMap.ampliconLength).toBe(0);
    expect(result.detail?.warnings.some((w) => w.includes('No amplicon'))).toBe(true);
  });

  it('is fully deterministic: identical params -> identical result', () => {
    const a = spec.run(spec.example);
    const b = spec.run(spec.example);
    expect(a).toEqual(b);
  });

  it('rejects invalid (non-ACGT) template input', () => {
    expect(() => spec.run({ ...spec.example, template: 'ATGXZ123' })).toThrow();
  });

  it('normalizeSeq lowercases and strips whitespace', () => {
    expect(normalizeSeq('  at gc\nAT ')).toBe('ATGCAT');
    expect(() => normalizeSeq('AUGC')).toThrow(); // U is RNA, rejected
  });
});
