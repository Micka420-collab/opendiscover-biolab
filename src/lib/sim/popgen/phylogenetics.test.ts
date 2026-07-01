import { describe, expect, it } from 'vitest';
import {
  type TreeNode,
  buildDistanceMatrix,
  jcFromP,
  jukesCantorDistance,
  kimura2pDistance,
  leafNames,
  neighborJoining,
  pDistance,
  spec,
  toNewick,
  treeDepth,
  treeHeight,
  upgma,
} from './phylogenetics';

// --- small helpers for inspecting reconstructed trees ---------------------

/** Find a leaf node by name anywhere in the tree. */
function findLeaf(node: TreeNode, name: string): TreeNode | null {
  if (node.children.length === 0) return node.name === name ? node : null;
  for (const c of node.children) {
    const hit = findLeaf(c, name);
    if (hit) return hit;
  }
  return null;
}

/** The set of leaf-name sets induced by every internal (non-root) clade. */
function inducedClades(node: TreeNode): string[][] {
  const clades: string[][] = [];
  const walk = (n: TreeNode, isRoot: boolean) => {
    if (n.children.length === 0) return;
    if (!isRoot) clades.push(leafNames(n).sort());
    for (const c of n.children) walk(c, false);
  };
  walk(node, true);
  return clades;
}

/** Sum of branch lengths from the root down to a named leaf. */
function rootToTip(root: TreeNode, name: string): number {
  let acc = 0;
  const walk = (n: TreeNode): boolean => {
    if (n.children.length === 0) return n.name === name;
    for (const c of n.children) {
      if (walk(c)) {
        acc += c.branchLength;
        return true;
      }
    }
    return false;
  };
  walk(root);
  return acc;
}

// ==========================================================================
// 1. Pairwise distances — closed-form / textbook values
// ==========================================================================

describe('pairwise distances', () => {
  // 12 aligned sites, 3 differences → p = 0.25.
  const s1 = 'AAAAAAAAAAAA';
  const s2 = 'AAAAAAAAACCC';

  it('p-distance is the fraction of differing sites', () => {
    expect(pDistance(s1, s2)).toBeCloseTo(0.25, 12);
  });

  it('Jukes–Cantor matches the closed-form value for a known p', () => {
    // d = -3/4 · ln(1 - 4·0.25/3) = -0.75·ln(2/3) = 0.30409883108217336
    const expected = 0.30409883108217336;
    expect(jcFromP(0.25)).toBeCloseTo(expected, 10);
    expect(jukesCantorDistance(s1, s2)).toBeCloseTo(expected, 10);
  });

  it('Jukes–Cantor exceeds the raw p-distance (multiple-hit correction)', () => {
    expect(jukesCantorDistance(s1, s2)).toBeGreaterThan(pDistance(s1, s2));
  });

  it('identical sequences have zero distance in every model', () => {
    const a = 'ACGTACGTACGT';
    expect(pDistance(a, a)).toBe(0);
    expect(jukesCantorDistance(a, a)).toBe(0);
    expect(kimura2pDistance(a, a)).toBe(0);
  });

  it('Kimura 2-parameter matches its closed form (2 transitions, 1 transversion / 10)', () => {
    // pos 0-6 identical; pos7,8: A→G transitions; pos9: A→C transversion.
    const a = 'AAAAAAAAAA';
    const b = 'AAAAAAAGGC';
    // P = 0.2, Q = 0.1
    // d = -1/2·ln(1-2P-Q) - 1/4·ln(1-2Q)
    //   = 1/2·ln2 + 1/4·ln1.25 = 0.4023594781085251
    const expected = 0.4023594781085251;
    expect(kimura2pDistance(a, b)).toBeCloseTo(expected, 12);
  });

  it('ignores gap / ambiguous sites (pairwise deletion)', () => {
    // 4 valid sites, 1 difference → p = 0.25; the '-' and 'N' columns are dropped.
    expect(pDistance('ACGT-A', 'ACAT-N')).toBeCloseTo(0.25, 12);
  });

  it('treats RNA "U" as equivalent to "T" instead of silently excluding it as missing data', () => {
    // Same site pattern as the p-distance test above, but written with RNA's
    // 'U' in place of DNA's 'T': 12 aligned sites, 3 differences → p = 0.25.
    // Before treating U as a recognized base, these differing U-sites were
    // dropped from `valid` (pairwise deletion), so the comparison fell back to
    // the 9 identical sites and falsely reported p = 0 ("identical").
    const rnaA = 'AAAAAAAAAAAA';
    const rnaB = 'AAAAAAAAAUUU';
    expect(pDistance(rnaA, rnaB)).toBeCloseTo(0.25, 12);
    expect(jukesCantorDistance(rnaA, rnaB)).toBeCloseTo(jukesCantorDistance(s1, s2), 12);
  });

  it('classifies U consistently with T for transition/transversion (Kimura 2P)', () => {
    // pos 0-6 identical; pos 7,8: A→G transitions; pos 9: A→U transversion.
    // U is the pyrimidine equivalent of T, so A→U is a transversion exactly
    // like A→T, giving the same P = 0.2, Q = 0.1 and closed-form distance as
    // the all-DNA Kimura test above.
    const a = 'AAAAAAAAAA';
    const b = 'AAAAAAAGGU';
    const expected = 0.4023594781085251;
    expect(kimura2pDistance(a, b)).toBeCloseTo(expected, 12);
  });
});

// ==========================================================================
// 1b. Undefined distances — zero overlapping valid sites must not be "0"
// ==========================================================================

describe('undefined distances (zero overlapping valid sites)', () => {
  // Two sequences that share no comparable data at all: one is all gaps, the
  // other all ambiguity codes, so pairwise deletion excludes every site.
  const allGaps = '----';
  const allNs = 'NNNN';

  it('pDistance returns NaN rather than fabricating a "0" (identical) result', () => {
    expect(pDistance(allGaps, allNs)).toBeNaN();
  });

  it('jukesCantorDistance and kimura2pDistance also propagate NaN', () => {
    expect(jukesCantorDistance(allGaps, allNs)).toBeNaN();
    expect(kimura2pDistance(allGaps, allNs)).toBeNaN();
  });

  it('buildDistanceMatrix throws instead of silently baking in a fabricated zero distance', () => {
    const sequences = [
      { name: 'A', seq: 'ACGT' },
      { name: 'B', seq: 'ACGA' },
      { name: 'C', seq: '----' }, // no overlapping valid sites with A or B
    ];
    expect(() => buildDistanceMatrix(sequences, 'jc')).toThrow(/no overlapping valid/i);
  });
});

// ==========================================================================
// 2. Neighbor-Joining — recovers a known 4-taxon topology & branch lengths
// ==========================================================================

describe('Neighbor-Joining', () => {
  // Additive distances generated by the tree ((A,B),(C,D)) with branch lengths
  //   A–u1 = 1, B–u1 = 2, C–u2 = 3, D–u2 = 4, internal u1–u2 = 1.
  // The correct unrooted topology has the split {A,B} | {C,D}.
  const names = ['A', 'B', 'C', 'D'];
  const D = [
    [0, 3, 5, 6],
    [3, 0, 6, 7],
    [5, 6, 0, 7],
    [6, 7, 7, 0],
  ];

  it('recovers the correct split {A,B} | {C,D}', () => {
    const tree = neighborJoining(names, D);
    // Root is the central trifurcation: its children are the {A,B} clade + C + D.
    const clades = inducedClades(tree).map((c) => c.join(','));
    expect(clades).toContain('A,B');
    // The complementary clade {C,D} is defined by the same internal edge, so at
    // least one of the two induced groupings must be present.
    const hasSplit = clades.includes('A,B') || clades.includes('C,D');
    expect(hasSplit).toBe(true);
  });

  it('recovers the exact branch lengths for additive input', () => {
    const tree = neighborJoining(names, D);
    expect(rootToTip(tree, 'A')).not.toBeNaN();
    expect(findLeaf(tree, 'A')!.branchLength).toBeCloseTo(1, 9);
    expect(findLeaf(tree, 'B')!.branchLength).toBeCloseTo(2, 9);
    expect(findLeaf(tree, 'C')!.branchLength).toBeCloseTo(3, 9);
    expect(findLeaf(tree, 'D')!.branchLength).toBeCloseTo(4, 9);
  });

  it('reproduces additive pairwise distances via root-to-tip + internal edges', () => {
    // For an additive tree, patristic distance d(A,B) should equal the input.
    const tree = neighborJoining(names, D);
    // d(A,B) = branch(A) + branch(B) since they share their parent (the {A,B} node).
    expect(findLeaf(tree, 'A')!.branchLength + findLeaf(tree, 'B')!.branchLength).toBeCloseTo(3, 9);
  });
});

// ==========================================================================
// 3. UPGMA — ultrametric input recovers expected clustering
// ==========================================================================

describe('UPGMA', () => {
  // Ultrametric matrix from the rooted tree ((A,B):h1, (C,D):h2) with
  //   d(A,B)=2 (h=1), d(C,D)=4 (h=2), all cross distances = 8 (h=4).
  const names = ['A', 'B', 'C', 'D'];
  const D = [
    [0, 2, 8, 8],
    [2, 0, 8, 8],
    [8, 8, 0, 4],
    [8, 8, 4, 0],
  ];

  it('recovers the expected clustering ((A,B),(C,D))', () => {
    const tree = upgma(names, D);
    const clades = inducedClades(tree).map((c) => c.join(','));
    expect(clades).toContain('A,B');
    expect(clades).toContain('C,D');
  });

  it('produces a genuinely ultrametric tree (all tips equidistant from root)', () => {
    const tree = upgma(names, D);
    const dA = rootToTip(tree, 'A');
    for (const name of names) {
      expect(rootToTip(tree, name)).toBeCloseTo(dA, 9);
    }
    // Root-to-tip distance equals the deepest merge height = 8/2 = 4.
    expect(dA).toBeCloseTo(4, 9);
  });

  it('assigns the expected leaf branch lengths (half the merge distance)', () => {
    const tree = upgma(names, D);
    expect(findLeaf(tree, 'A')!.branchLength).toBeCloseTo(1, 9); // merge height 1
    expect(findLeaf(tree, 'B')!.branchLength).toBeCloseTo(1, 9);
    expect(findLeaf(tree, 'C')!.branchLength).toBeCloseTo(2, 9); // merge height 2
    expect(findLeaf(tree, 'D')!.branchLength).toBeCloseTo(2, 9);
  });
});

// ==========================================================================
// 4. Newick output
// ==========================================================================

describe('Newick serialization', () => {
  const names = ['A', 'B', 'C', 'D'];
  const D = [
    [0, 3, 5, 6],
    [3, 0, 6, 7],
    [5, 6, 0, 7],
    [6, 7, 7, 0],
  ];

  it('is balanced (equal open/close parens) and terminates with a semicolon', () => {
    const nwk = toNewick(neighborJoining(names, D));
    const open = (nwk.match(/\(/g) ?? []).length;
    const close = (nwk.match(/\)/g) ?? []).length;
    expect(open).toBe(close);
    expect(open).toBeGreaterThan(0);
    expect(nwk.endsWith(';')).toBe(true);
  });

  it('names every taxon exactly once', () => {
    const nwk = toNewick(upgma(names, D));
    for (const name of names) {
      expect(nwk).toContain(name);
    }
  });
});

// ==========================================================================
// 5. Engine spec: run(), metrics, determinism
// ==========================================================================

describe('phylogenetics engine spec', () => {
  it('runs the built-in example and reports taxaCount + treeDepth', () => {
    const res = spec.run(spec.example);
    expect(res.engine).toBe('phylogenetics');
    const taxa = res.metrics.find((m) => m.key === 'taxaCount')!;
    const depth = res.metrics.find((m) => m.key === 'treeDepth')!;
    expect(taxa.value).toBe(4);
    expect(depth.value).toBe(treeDepth(res.detail!.tree));
    expect(depth.value).toBeGreaterThanOrEqual(2);
  });

  it('produces a Newick that names all example taxa and is balanced', () => {
    const res = spec.run(spec.example);
    const nwk = res.detail!.newick;
    const open = (nwk.match(/\(/g) ?? []).length;
    const close = (nwk.match(/\)/g) ?? []).length;
    expect(open).toBe(close);
    for (const s of spec.example.sequences) {
      expect(nwk).toContain(s.name);
    }
  });

  it('validates params through the zod schema (rejects < 3 taxa)', () => {
    expect(() =>
      spec.run({
        sequences: [
          { name: 'A', seq: 'ACGT' },
          { name: 'B', seq: 'ACGA' },
        ],
      }),
    ).toThrow();
  });

  it('is deterministic: identical params → identical result', () => {
    const a = spec.run(spec.example);
    const b = spec.run(spec.example);
    expect(a.detail!.newick).toBe(b.detail!.newick);
    expect(JSON.stringify(a.metrics)).toBe(JSON.stringify(b.metrics));
  });

  it('UPGMA option yields an ultrametric example tree', () => {
    const res = spec.run({ ...spec.example, method: 'upgma' });
    const tree = res.detail!.tree;
    const tips = leafNames(tree);
    const d0 = rootToTip(tree, tips[0]);
    for (const t of tips) expect(rootToTip(tree, t)).toBeCloseTo(d0, 6);
    expect(treeHeight(tree)).toBeCloseTo(d0, 6);
  });
});
