/**
 * Distance-based phylogenetics.
 *
 * Reconstructs a phylogenetic tree from a set of *aligned* nucleotide sequences
 * in three stages:
 *
 *   1. Pairwise evolutionary distances between every pair of sequences using one
 *      of three substitution models:
 *        - `p`   — observed proportion of differing sites (p-distance). An
 *                  uncorrected count; underestimates true divergence because it
 *                  ignores multiple/back substitutions at the same site.
 *        - `jc`  — Jukes–Cantor (1969) one-parameter correction. Assumes all
 *                  four bases are equally frequent and every substitution is
 *                  equally likely:  d = -3/4 · ln(1 - 4p/3).
 *        - `k2p` — Kimura (1980) two-parameter model. Separates transitions
 *                  (A↔G, C↔T) from transversions and corrects each:
 *                  d = -1/2·ln(1-2P-Q) - 1/4·ln(1-2Q),
 *                  where P = transition fraction, Q = transversion fraction.
 *
 *   2. Tree construction from the distance matrix:
 *        - Neighbor-Joining (Saitou & Nei 1987) — produces an *unrooted*,
 *          additive tree. Recovers the true tree exactly when distances are
 *          additive; robust and consistent otherwise. Terminates on a central
 *          trifurcating node, the natural representation of an unrooted tree.
 *        - UPGMA (Sokal & Michener 1958) — agglomerative clustering with a
 *          weighted arithmetic mean. Produces a *rooted, ultrametric* tree
 *          (a molecular clock); correct only when the clock assumption holds.
 *
 *   3. Newick serialization of the resulting tree, with branch lengths.
 *
 * The whole pipeline is deterministic: no randomness, clock, network, or fs.
 *
 * References:
 *   - Jukes TH, Cantor CR (1969). "Evolution of protein molecules."
 *   - Kimura M (1980). J Mol Evol 16:111-120.
 *   - Saitou N, Nei M (1987). Mol Biol Evol 4:406-425.
 *   - Sokal R, Michener C (1958). Univ Kansas Sci Bull 38:1409-1438.
 *   - Felsenstein J (2004). "Inferring Phylogenies."
 */

import { z } from 'zod';
import type { Matrix } from '../core/linalg';
import type { EngineSpec, SimResult } from '../core/types';
import { provenance } from '../core/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubstitutionModel = 'p' | 'jc' | 'k2p';
export type TreeMethod = 'nj' | 'upgma';

export interface NamedSequence {
  name: string;
  seq: string;
}

export interface DistanceMatrix {
  names: string[];
  matrix: Matrix;
}

/**
 * A node in a rooted representation of the tree.
 * `branchLength` is the length of the edge connecting this node to its parent
 * (0 for the root). Leaves carry a `name`; internal nodes have `name === null`.
 * `height` (UPGMA only) is the node's distance from the tips beneath it.
 */
export interface TreeNode {
  name: string | null;
  branchLength: number;
  children: TreeNode[];
  height?: number;
}

// Distance returned when a model saturates (>= the point where the log argument
// is non-positive, i.e. divergence too high to correct). Kept finite so tree
// construction stays numerically well-defined.
const SATURATED_DISTANCE = 100;

const PURINES = new Set(['A', 'G']);
const PYRIMIDINES = new Set(['C', 'T']);

function isBase(c: string): boolean {
  return c === 'A' || c === 'C' || c === 'G' || c === 'T';
}

// ---------------------------------------------------------------------------
// 1. Pairwise distances
// ---------------------------------------------------------------------------

interface SiteCounts {
  /** Sites compared (both non-gap, unambiguous). */
  valid: number;
  /** Differing sites. */
  diff: number;
  /** Transition differences (A↔G, C↔T). */
  transitions: number;
  /** Transversion differences (everything else). */
  transversions: number;
}

/** Tally per-site agreement/disagreement between two aligned sequences. */
export function siteCounts(a: string, b: string): SiteCounts {
  if (a.length !== b.length) {
    throw new Error('siteCounts: sequences must be aligned (equal length)');
  }
  let valid = 0;
  let diff = 0;
  let transitions = 0;
  let transversions = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i].toUpperCase();
    const y = b[i].toUpperCase();
    // Skip gaps ('-', '.') and ambiguous codes ('N', '?', IUPAC) — pairwise deletion.
    if (!isBase(x) || !isBase(y)) continue;
    valid++;
    if (x === y) continue;
    diff++;
    const transition =
      (PURINES.has(x) && PURINES.has(y)) || (PYRIMIDINES.has(x) && PYRIMIDINES.has(y));
    if (transition) transitions++;
    else transversions++;
  }
  return { valid, diff, transitions, transversions };
}

/** Uncorrected p-distance: fraction of differing sites. */
export function pDistance(a: string, b: string): number {
  const { valid, diff } = siteCounts(a, b);
  if (valid === 0) return 0;
  return diff / valid;
}

/** Jukes–Cantor correction applied to an already-computed p-distance. */
export function jcFromP(p: number): number {
  const arg = 1 - (4 * p) / 3;
  // arg <= 0 ⇔ p >= 3/4: the correction diverges; report a saturated distance.
  if (arg <= 0) return SATURATED_DISTANCE;
  const d = -0.75 * Math.log(arg);
  return d === 0 ? 0 : d; // normalise -0 (p === 0) to +0
}

/** Jukes–Cantor distance between two aligned sequences. */
export function jukesCantorDistance(a: string, b: string): number {
  return jcFromP(pDistance(a, b));
}

/** Kimura 2-parameter distance between two aligned sequences. */
export function kimura2pDistance(a: string, b: string): number {
  const { valid, transitions, transversions } = siteCounts(a, b);
  if (valid === 0) return 0;
  const P = transitions / valid; // transition proportion
  const Q = transversions / valid; // transversion proportion
  const w1 = 1 - 2 * P - Q;
  const w2 = 1 - 2 * Q;
  if (w1 <= 0 || w2 <= 0) return SATURATED_DISTANCE;
  const d = -0.5 * Math.log(w1) - 0.25 * Math.log(w2);
  return d === 0 ? 0 : d; // normalise -0 (identical sequences) to +0
}

/** Dispatch to the chosen substitution model. */
export function pairwiseDistance(a: string, b: string, model: SubstitutionModel): number {
  switch (model) {
    case 'p':
      return pDistance(a, b);
    case 'jc':
      return jukesCantorDistance(a, b);
    case 'k2p':
      return kimura2pDistance(a, b);
    default:
      throw new Error(`pairwiseDistance: unknown model '${model as string}'`);
  }
}

/** Build a full symmetric distance matrix from aligned sequences. */
export function buildDistanceMatrix(
  sequences: NamedSequence[],
  model: SubstitutionModel,
): DistanceMatrix {
  const n = sequences.length;
  const len = sequences[0]?.seq.length ?? 0;
  for (const s of sequences) {
    if (s.seq.length !== len) {
      throw new Error(
        `buildDistanceMatrix: sequences must be aligned; '${s.name}' has length ${s.seq.length}, expected ${len}`,
      );
    }
  }
  const names = sequences.map((s) => s.name);
  const matrix: Matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = pairwiseDistance(sequences[i].seq, sequences[j].seq, model);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  return { names, matrix };
}

// ---------------------------------------------------------------------------
// 2a. Neighbor-Joining
// ---------------------------------------------------------------------------

/**
 * Neighbor-Joining (Saitou & Nei 1987). Iteratively joins the pair of clusters
 * minimising the Q-criterion until three clusters remain, then attaches them to
 * a central node. Returns the unrooted tree as a rooted structure whose root is
 * that central (trifurcating) node.
 *
 * For additive input distances this recovers the generating tree — topology and
 * all branch lengths — exactly.
 */
export function neighborJoining(names: string[], distances: Matrix): TreeNode {
  if (names.length < 3) throw new Error('neighborJoining requires at least 3 taxa');
  let nodes: TreeNode[] = names.map((nm) => ({ name: nm, branchLength: 0, children: [] }));
  let D: Matrix = distances.map((row) => [...row]);

  while (nodes.length > 3) {
    const n = nodes.length;
    // Net divergence r_i = Σ_k d(i,k).
    const r = D.map((row) => row.reduce((s, v) => s + v, 0));

    // Q(i,j) = (n-2)·d(i,j) - r_i - r_j ; pick the minimising pair.
    let bi = 0;
    let bj = 1;
    let bestQ = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const q = (n - 2) * D[i][j] - r[i] - r[j];
        if (q < bestQ) {
          bestQ = q;
          bi = i;
          bj = j;
        }
      }
    }

    const dij = D[bi][bj];
    // Branch lengths from the joined pair to the new internal node u.
    const di = 0.5 * dij + (r[bi] - r[bj]) / (2 * (n - 2));
    const dj = dij - di;
    const ci = nodes[bi];
    const cj = nodes[bj];
    ci.branchLength = di;
    cj.branchLength = dj;
    const merged: TreeNode = { name: null, branchLength: 0, children: [ci, cj] };

    // Rebuild node list and distance matrix with i,j replaced by u (appended last).
    const keep = nodes.map((_, idx) => idx).filter((idx) => idx !== bi && idx !== bj);
    const newNodes: TreeNode[] = keep.map((idx) => nodes[idx]);
    newNodes.push(merged);
    const m = newNodes.length;
    const newD: Matrix = Array.from({ length: m }, () => new Array(m).fill(0));
    for (let a = 0; a < keep.length; a++) {
      for (let b = a + 1; b < keep.length; b++) {
        const v = D[keep[a]][keep[b]];
        newD[a][b] = v;
        newD[b][a] = v;
      }
    }
    // Reduced distance to the new node: d(u,k) = ½·[d(i,k) + d(j,k) - d(i,j)].
    const last = m - 1;
    for (let a = 0; a < keep.length; a++) {
      const k = keep[a];
      const duk = 0.5 * (D[bi][k] + D[bj][k] - dij);
      newD[a][last] = duk;
      newD[last][a] = duk;
    }
    nodes = newNodes;
    D = newD;
  }

  return finalizeUnrooted(nodes, D);
}

/** Attach the final ≤3 clusters to a central node (the NJ termination step). */
function finalizeUnrooted(nodes: TreeNode[], D: Matrix): TreeNode {
  if (nodes.length === 1) return nodes[0];
  if (nodes.length === 2) {
    const [a, b] = nodes;
    a.branchLength = D[0][1] / 2;
    b.branchLength = D[0][1] / 2;
    return { name: null, branchLength: 0, children: [a, b] };
  }
  // Three clusters → central node c with the three-point branch-length formula.
  const [a, b, c] = nodes;
  const dab = D[0][1];
  const dac = D[0][2];
  const dbc = D[1][2];
  a.branchLength = 0.5 * (dab + dac - dbc);
  b.branchLength = 0.5 * (dab + dbc - dac);
  c.branchLength = 0.5 * (dac + dbc - dab);
  return { name: null, branchLength: 0, children: [a, b, c] };
}

// ---------------------------------------------------------------------------
// 2b. UPGMA
// ---------------------------------------------------------------------------

/**
 * UPGMA (Unweighted Pair Group Method with Arithmetic mean). Repeatedly merges
 * the two closest clusters; the merge height is half their distance, and the
 * distance from the merged cluster to any other is the size-weighted mean of the
 * component distances. Produces a rooted, ultrametric tree (all leaves are
 * equidistant from the root).
 */
export function upgma(names: string[], distances: Matrix): TreeNode {
  if (names.length < 2) throw new Error('upgma requires at least 2 taxa');
  let nodes: TreeNode[] = names.map((nm) => ({
    name: nm,
    branchLength: 0,
    children: [],
    height: 0,
  }));
  let sizes = names.map(() => 1);
  let heights = names.map(() => 0);
  let D: Matrix = distances.map((row) => [...row]);

  while (nodes.length > 1) {
    const n = nodes.length;
    // Closest pair (global minimum off-diagonal entry).
    let bi = 0;
    let bj = 1;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (D[i][j] < best) {
          best = D[i][j];
          bi = i;
          bj = j;
        }
      }
    }

    const newHeight = D[bi][bj] / 2;
    const ci = nodes[bi];
    const cj = nodes[bj];
    // Branch length = new node height minus child's own height (ultrametric).
    ci.branchLength = newHeight - heights[bi];
    cj.branchLength = newHeight - heights[bj];
    const merged: TreeNode = {
      name: null,
      branchLength: 0,
      children: [ci, cj],
      height: newHeight,
    };
    const newSize = sizes[bi] + sizes[bj];

    const keep = nodes.map((_, idx) => idx).filter((idx) => idx !== bi && idx !== bj);
    const newNodes: TreeNode[] = keep.map((idx) => nodes[idx]);
    newNodes.push(merged);
    const newSizes = keep.map((idx) => sizes[idx]);
    newSizes.push(newSize);
    const newHeights = keep.map((idx) => heights[idx]);
    newHeights.push(newHeight);

    const m = newNodes.length;
    const newD: Matrix = Array.from({ length: m }, () => new Array(m).fill(0));
    for (let a = 0; a < keep.length; a++) {
      for (let b = a + 1; b < keep.length; b++) {
        const v = D[keep[a]][keep[b]];
        newD[a][b] = v;
        newD[b][a] = v;
      }
    }
    // Size-weighted arithmetic mean distance to the merged cluster.
    const last = m - 1;
    for (let a = 0; a < keep.length; a++) {
      const k = keep[a];
      const d = (sizes[bi] * D[bi][k] + sizes[bj] * D[bj][k]) / newSize;
      newD[a][last] = d;
      newD[last][a] = d;
    }

    nodes = newNodes;
    sizes = newSizes;
    heights = newHeights;
    D = newD;
  }

  const root = nodes[0];
  root.branchLength = 0;
  return root;
}

// ---------------------------------------------------------------------------
// 3. Newick + tree utilities
// ---------------------------------------------------------------------------

/** Format a branch length deterministically (trim floating-point noise). */
function fmtLen(x: number): string {
  if (!Number.isFinite(x)) return '0';
  const r = Math.round(x * 1e6) / 1e6;
  return String(r);
}

/** Quote a taxon name if it contains Newick-special characters. */
function newickName(name: string): string {
  if (/^[A-Za-z0-9_.]+$/.test(name)) return name;
  return `'${name.replace(/'/g, "''")}'`;
}

function newickNode(node: TreeNode): string {
  const label = node.name !== null ? newickName(node.name) : '';
  if (node.children.length === 0) {
    return `${label}:${fmtLen(node.branchLength)}`;
  }
  const inner = node.children.map(newickNode).join(',');
  return `(${inner})${label}:${fmtLen(node.branchLength)}`;
}

/** Serialize a tree to a Newick string (the root carries no branch length). */
export function toNewick(root: TreeNode): string {
  if (root.children.length === 0) {
    return `${root.name !== null ? newickName(root.name) : ''};`;
  }
  const inner = root.children.map(newickNode).join(',');
  return `(${inner});`;
}

/** All leaf names beneath a node (in traversal order). */
export function leafNames(node: TreeNode): string[] {
  if (node.children.length === 0) return node.name !== null ? [node.name] : [];
  return node.children.flatMap(leafNames);
}

/** Topological depth: maximum number of edges from `node` to any leaf below it. */
export function treeDepth(node: TreeNode): number {
  if (node.children.length === 0) return 0;
  return 1 + Math.max(...node.children.map(treeDepth));
}

/** Maximum root-to-tip path length (sum of branch lengths). */
export function treeHeight(node: TreeNode): number {
  if (node.children.length === 0) return 0;
  return Math.max(...node.children.map((c) => c.branchLength + treeHeight(c)));
}

/** Sum of every branch length in the tree. */
export function totalBranchLength(node: TreeNode): number {
  return node.children.reduce((s, c) => s + c.branchLength + totalBranchLength(c), 0);
}

// ---------------------------------------------------------------------------
// Engine spec
// ---------------------------------------------------------------------------

const sequenceSchema = z.object({
  name: z.string().min(1, 'sequence name required'),
  seq: z.string().min(1, 'sequence must be non-empty'),
});

const paramsSchema = z.object({
  /** Aligned nucleotide sequences (all the same length). At least 3 taxa. */
  sequences: z.array(sequenceSchema).min(3, 'at least 3 aligned sequences required'),
  /** Tree-building algorithm. Default: neighbor-joining. */
  method: z.enum(['nj', 'upgma']).optional(),
  /** Substitution model for pairwise distances. Default: Jukes–Cantor. */
  model: z.enum(['p', 'jc', 'k2p']).optional(),
});

export type PhylogeneticsParams = z.infer<typeof paramsSchema>;

export interface PhylogeneticsDetail {
  distanceMatrix: DistanceMatrix;
  newick: string;
  tree: TreeNode;
  method: TreeMethod;
  model: SubstitutionModel;
}

function buildTree(dm: DistanceMatrix, method: TreeMethod): TreeNode {
  return method === 'upgma' ? upgma(dm.names, dm.matrix) : neighborJoining(dm.names, dm.matrix);
}

export const spec: EngineSpec<PhylogeneticsParams, PhylogeneticsDetail> = {
  slug: 'phylogenetics',
  title: 'Distance-based Phylogenetics',
  domain: 'population-genetics',
  version: '1.0.0',
  description:
    'Reconstructs a phylogenetic tree from aligned nucleotide sequences. Computes ' +
    'pairwise evolutionary distances (p-distance, Jukes–Cantor, or Kimura 2-parameter), ' +
    'builds a tree by Neighbor-Joining (unrooted, additive) or UPGMA (rooted, ultrametric), ' +
    'and emits a Newick string with branch lengths. Fully deterministic.',
  references: [
    'Jukes TH, Cantor CR (1969). Evolution of protein molecules.',
    'Kimura M (1980). J Mol Evol 16:111-120.',
    'Saitou N, Nei M (1987). Mol Biol Evol 4:406-425.',
    'Sokal R, Michener C (1958). Univ Kansas Sci Bull 38:1409-1438.',
    'Felsenstein J (2004). Inferring Phylogenies.',
  ],
  paramsSchema,
  run(params: PhylogeneticsParams): SimResult<PhylogeneticsDetail> {
    const parsed = paramsSchema.parse(params);
    const method: TreeMethod = parsed.method ?? 'nj';
    const model: SubstitutionModel = parsed.model ?? 'jc';

    const dm = buildDistanceMatrix(parsed.sequences, model);
    const tree = buildTree(dm, method);
    const newick = toNewick(tree);

    const taxaCount = dm.names.length;
    const depth = treeDepth(tree);
    const height = treeHeight(tree);
    const totalLen = totalBranchLength(tree);

    const modelLabel =
      model === 'p' ? 'p-distance' : model === 'jc' ? 'Jukes–Cantor' : 'Kimura 2-parameter';
    const methodLabel = method === 'upgma' ? 'UPGMA' : 'Neighbor-Joining';

    return {
      engine: spec.slug,
      summary: `${methodLabel} tree of ${taxaCount} taxa (${modelLabel} distances), depth ${depth}.`,
      metrics: [
        {
          key: 'taxaCount',
          label: 'Taxa',
          value: taxaCount,
          note: 'Number of input sequences (leaves).',
        },
        {
          key: 'treeDepth',
          label: 'Tree depth',
          value: depth,
          note: 'Maximum number of edges from the root to any leaf.',
        },
        {
          key: 'treeHeight',
          label: 'Tree height',
          value: height,
          unit: 'substitutions/site',
          note: 'Maximum root-to-tip path length (sum of branch lengths).',
        },
        {
          key: 'totalBranchLength',
          label: 'Total branch length',
          value: totalLen,
          unit: 'substitutions/site',
          note: 'Sum of all branch lengths in the tree.',
        },
      ],
      detail: { distanceMatrix: dm, newick, tree, method, model },
      provenance: provenance(spec.slug, spec.version, parsed as Record<string, unknown>),
    };
  },
  example: {
    method: 'nj',
    model: 'jc',
    sequences: [
      { name: 'Human', seq: 'AAGCTTCACCGGCGCAGTCA' },
      { name: 'Chimp', seq: 'AAGCTTCACCGGCGCAATTA' },
      { name: 'Gorilla', seq: 'AAGCTTCACCGGCGCAGTTG' },
      { name: 'Orangutan', seq: 'AAGCTTCACCGGCGCAGGCA' },
    ],
  },
  tags: [
    'phylogenetics',
    'neighbor-joining',
    'upgma',
    'jukes-cantor',
    'kimura',
    'newick',
    'distance-matrix',
  ],
};

export default spec;
