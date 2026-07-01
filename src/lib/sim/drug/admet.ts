/**
 * Drug-likeness & ADMET rule engine.
 *
 * Given a small molecule — either as a set of explicit physicochemical
 * descriptors or as a lightweight SMILES string — this engine derives the
 * classic medicinal-chemistry "developability" descriptors and scores the
 * molecule against the canonical drug-likeness filters:
 *
 *   - Lipinski's Rule of Five  (Lipinski et al. 1997) — oral bioavailability.
 *   - Veber rules              (Veber et al. 2002)     — rotatable bonds + TPSA.
 *   - Ghose filter             (Ghose et al. 1999)     — MW / logP / size window.
 *   - QED                      (Bickerton et al. 2012) — a continuous 0..1
 *       "quantitative estimate of drug-likeness" combining several desirability
 *       functions as a weighted geometric mean.
 *
 * The molecule may be supplied two ways:
 *
 *   1. `descriptors`: { mw, logP, hbd, hba, tpsa?, rotatableBonds?, aromaticRings? }
 *   2. `smiles`: a lightweight SMILES that we parse ourselves (no external
 *      cheminformatics toolkit) to *estimate* the descriptors — atom / heteroatom
 *      counts, implicit hydrogens via a simple valence model, molecular weight,
 *      hydrogen-bond donors (N-H + O-H) and acceptors (N + O), aromatic rings
 *      (lower-case atoms + ring closures), rotatable bonds (acyclic single bonds
 *      between two non-terminal heavy atoms) and a crude atom-contribution logP.
 *
 * Everything here is a pure, deterministic function of its input — no clock, no
 * network, no randomness — so a run can be replayed byte-for-byte.
 *
 * IMPORTANT accuracy caveats (documented so callers don't over-trust it):
 *   - The SMILES parser covers the organic subset (B, C, N, O, P, S, halogens),
 *     lower-case aromatics and bracket atoms with explicit H/charge. It uses the
 *     lowest common valence for N (3), S (2), P (3); hypervalent sulfur /
 *     phosphorus (sulfones, phosphates) will under-count hydrogens.
 *   - The logP is an intentionally *crude* additive atom-contribution estimate,
 *     good enough to rank lipophilic vs. polar molecules but not a substitute for
 *     a trained model (XLOGP3, Crippen cLogP, ...).
 *   - Our QED uses the published Bickerton asymmetric-double-sigmoid desirability
 *     functions and "mean" weights, but omits the eighth (structural-ALERTS)
 *     term because enumerating alerts requires SMARTS matching. It is therefore
 *     an "alert-free" QED and reads a little more optimistic than RDKit's QED.
 *
 * References:
 *   Lipinski, Lombardo, Dominy & Feeney (1997) Adv. Drug Deliv. Rev. 23:3-25.
 *   Ghose, Viswanadhan & Wendoloski (1999) J. Comb. Chem. 1:55-68.
 *   Veber, Johnson, Cheng, Smith, Ward & Kopple (2002) J. Med. Chem. 45:2615-2623.
 *   Bickerton, Paolini, Besnard, Muresan & Hopkins (2012) Nat. Chem. 4:90-98.
 */

import { z } from 'zod';
import type { EngineSpec, SimResult } from '../core/types';
import { provenance } from '../core/types';

// ---------------------------------------------------------------------------
// Atomic data
// ---------------------------------------------------------------------------

/** Standard atomic weights (Da) for the elements the parser understands. */
const ATOMIC_WEIGHT: Record<string, number> = {
  H: 1.008,
  B: 10.811,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  F: 18.998,
  Na: 22.99,
  Mg: 24.305,
  Al: 26.982,
  Si: 28.086,
  P: 30.974,
  S: 32.06,
  Cl: 35.45,
  K: 39.098,
  Ca: 40.078,
  Fe: 55.845,
  Zn: 65.38,
  Se: 78.971,
  Br: 79.904,
  I: 126.904,
  Li: 6.941,
};

/**
 * Default (lowest common) valence used to infer the number of implicit
 * hydrogens on an organic-subset atom: implicitH = valence - Σ bondOrders.
 */
const DEFAULT_VALENCE: Record<string, number> = {
  B: 3,
  C: 4,
  N: 3,
  O: 2,
  P: 3,
  S: 2,
  F: 1,
  Cl: 1,
  Br: 1,
  I: 1,
  H: 1,
};

/** Two-letter element symbols we recognise outside of brackets / in brackets. */
const TWO_LETTER = new Set(['Cl', 'Br', 'Si', 'Se', 'Na', 'Li', 'Al', 'Ca', 'Fe', 'Zn', 'Mg']);

/** Organic-subset atoms that may be written without brackets. */
const ORGANIC_SUBSET = new Set(['B', 'C', 'N', 'O', 'P', 'S', 'F', 'Cl', 'Br', 'I']);

// ---------------------------------------------------------------------------
// SMILES parsing
// ---------------------------------------------------------------------------

/** A parsed atom. `element` is always the upper-case symbol; `aromatic` flags a
 *  lower-case (aromatic) atom. `explicitH` is set for bracket atoms. */
export interface ParsedAtom {
  element: string;
  aromatic: boolean;
  explicitH: number | null;
  charge: number;
}

/** A parsed bond. `order` is 1, 2, 3, or 1.5 (aromatic). `ring` marks a ring
 *  closure bond (used for aromatic-ring counting). */
export interface ParsedBond {
  a: number;
  b: number;
  order: number;
  ring: boolean;
}

export interface ParsedMolecule {
  atoms: ParsedAtom[];
  bonds: ParsedBond[];
}

const BOND_ORDER: Record<string, number> = { '-': 1, '=': 2, '#': 3, ':': 1.5, '/': 1, '\\': 1 };

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}

/**
 * Parse a lightweight SMILES string into an atom/bond graph. Supports the
 * organic subset, lower-case aromatics, branches `()`, ring-closure digits and
 * `%nn`, the bond symbols `- = # : / \`, disconnected `.`, and bracket atoms
 * `[...]` with an explicit H-count and charge.
 */
export function parseSmiles(smiles: string): ParsedMolecule {
  const s = smiles.trim();
  const atoms: ParsedAtom[] = [];
  const bonds: ParsedBond[] = [];
  const branchStack: number[] = [];
  const ringMap = new Map<number, { atom: number; bond: string | null }>();

  let prev: number | null = null;
  let pendingBond: string | null = null;
  let i = 0;

  const bondOrderBetween = (aIdx: number, bIdx: number, symbol: string | null): number => {
    if (symbol && symbol in BOND_ORDER) return BOND_ORDER[symbol] as number;
    const a = atoms[aIdx];
    const b = atoms[bIdx];
    if (a && b && a.aromatic && b.aromatic) return 1.5;
    return 1;
  };

  const connect = (newIdx: number) => {
    if (prev !== null) {
      const order = bondOrderBetween(prev, newIdx, pendingBond);
      bonds.push({ a: prev, b: newIdx, order, ring: false });
    }
    pendingBond = null;
    prev = newIdx;
  };

  while (i < s.length) {
    const c = s[i] as string;

    if (c === '(') {
      if (prev !== null) branchStack.push(prev);
      i++;
      continue;
    }
    if (c === ')') {
      const top = branchStack.pop();
      if (top !== undefined) prev = top;
      i++;
      continue;
    }
    if (c in BOND_ORDER) {
      pendingBond = c;
      i++;
      continue;
    }
    if (c === '.') {
      prev = null;
      pendingBond = null;
      i++;
      continue;
    }

    // Ring-closure labels: a single digit, or %nn for two-digit labels.
    if (isDigit(c) || c === '%') {
      let label: number;
      if (c === '%') {
        label = Number.parseInt(s.slice(i + 1, i + 3), 10);
        i += 3;
      } else {
        label = Number.parseInt(c, 10);
        i += 1;
      }
      if (prev === null) continue; // malformed; ignore gracefully
      const open = ringMap.get(label);
      if (open) {
        ringMap.delete(label);
        const symbol = pendingBond ?? open.bond;
        const order = bondOrderBetween(open.atom, prev, symbol);
        bonds.push({ a: open.atom, b: prev, order, ring: true });
        pendingBond = null;
      } else {
        ringMap.set(label, { atom: prev, bond: pendingBond });
        pendingBond = null;
      }
      continue;
    }

    // Bracket atom: [<isotope><symbol><H count><charge>...]
    if (c === '[') {
      const end = s.indexOf(']', i);
      if (end === -1) throw new Error(`parseSmiles: unterminated '[' at position ${i}`);
      const inner = s.slice(i + 1, end);
      atoms.push(parseBracketAtom(inner));
      connect(atoms.length - 1);
      i = end + 1;
      continue;
    }

    // Organic-subset atom (possibly a two-letter symbol like Cl / Br).
    const two = s.slice(i, i + 2);
    let symbol: string | null = null;
    if (TWO_LETTER.has(two) && ORGANIC_SUBSET.has(two)) {
      symbol = two;
      i += 2;
    } else if (/[A-Za-z]/.test(c)) {
      symbol = c;
      i += 1;
    } else {
      // Unknown character (e.g. stray whitespace) — skip.
      i += 1;
      continue;
    }

    const aromatic = symbol === symbol.toLowerCase() && symbol.length === 1;
    const element = symbol.charAt(0).toUpperCase() + symbol.slice(1);
    if (!(element in ATOMIC_WEIGHT)) {
      throw new Error(`parseSmiles: unsupported element '${symbol}'`);
    }
    atoms.push({ element, aromatic, explicitH: null, charge: 0 });
    connect(atoms.length - 1);
  }

  return { atoms, bonds };
}

/** Parse the contents of a bracket atom, e.g. "nH", "O-", "NH2+", "C@@H", "13CH3". */
function parseBracketAtom(inner: string): ParsedAtom {
  let j = 0;
  // Skip a leading isotope number.
  while (j < inner.length && isDigit(inner[j] as string)) j++;

  // Element symbol: aromatic lower-case (single letter), or an upper-case
  // symbol optionally followed by a lower-case second letter.
  let element: string;
  let aromatic = false;
  const first = inner[j] as string;
  if (first >= 'a' && first <= 'z') {
    aromatic = true;
    element = first.toUpperCase();
    j++;
  } else {
    const maybeTwo = inner.slice(j, j + 2);
    if (maybeTwo.length === 2 && TWO_LETTER.has(maybeTwo)) {
      element = maybeTwo;
      j += 2;
    } else {
      element = first;
      j++;
    }
  }
  if (!(element in ATOMIC_WEIGHT)) {
    throw new Error(`parseSmiles: unsupported bracket element '${element}'`);
  }

  // Explicit hydrogen count.
  let explicitH = 0;
  while (j < inner.length) {
    const ch = inner[j] as string;
    if (ch === 'H') {
      j++;
      let n = 0;
      let hasDigit = false;
      while (j < inner.length && isDigit(inner[j] as string)) {
        n = n * 10 + Number.parseInt(inner[j] as string, 10);
        hasDigit = true;
        j++;
      }
      explicitH = hasDigit ? n : 1;
    } else if (ch === '+' || ch === '-') {
      j++; // charge — consumed but not needed for our descriptors
      while (j < inner.length && isDigit(inner[j] as string)) j++;
    } else {
      j++; // stereo markers '@', etc.
    }
  }

  return { element, aromatic, explicitH, charge: 0 };
}

// ---------------------------------------------------------------------------
// Descriptor estimation from a parsed molecule
// ---------------------------------------------------------------------------

/** Crude atom-contribution logP weights (see file header caveat). */
const LOGP_ATOM: Record<string, number> = {
  C: 0.15,
  N: -0.3,
  O: -0.4,
  S: 0.26,
  P: 0.3,
  F: 0.14,
  Cl: 0.71,
  Br: 0.86,
  I: 1.0,
  B: 0.3,
};
const LOGP_H_ON_C = 0.13; // hydrogen bonded to carbon (hydrophobic)
const LOGP_H_ON_HETERO = -0.15; // hydrogen bonded to N/O/S (polar)

export interface EstimatedDescriptors {
  mw: number;
  logP: number;
  hbd: number;
  hba: number;
  tpsa: number;
  rotatableBonds: number;
  aromaticRings: number;
  heavyAtoms: number;
  totalAtoms: number;
  atomCounts: Record<string, number>;
  formula: string;
}

/** Number of implicit hydrogens on a non-bracket atom, from the simple valence
 *  model. Bracket atoms already carry their explicit H count. */
function implicitHydrogens(atom: ParsedAtom, bondOrderSum: number): number {
  if (atom.explicitH !== null) return atom.explicitH;
  const valence = DEFAULT_VALENCE[atom.element];
  if (valence === undefined) return 0;
  return Math.max(0, Math.round(valence - bondOrderSum));
}

/** Build a Hill-notation molecular formula string for display. */
function hillFormula(counts: Record<string, number>, hydrogens: number): string {
  const parts: string[] = [];
  const push = (el: string, n: number) => {
    if (n > 0) parts.push(n === 1 ? el : `${el}${n}`);
  };
  push('C', counts.C ?? 0);
  push('H', hydrogens);
  for (const el of Object.keys(counts).sort()) {
    if (el === 'C' || el === 'H') continue;
    push(el, counts[el] ?? 0);
  }
  return parts.join('');
}

/**
 * Determine, for every bond, whether it is acyclic (a graph bridge). A bond is
 * "in a ring" iff its endpoints remain connected after the bond is removed.
 */
function acyclicFlags(nAtoms: number, bonds: ParsedBond[]): boolean[] {
  const adj: number[][] = Array.from({ length: nAtoms }, () => []);
  bonds.forEach((b, idx) => {
    adj[b.a]?.push(idx);
    adj[b.b]?.push(idx);
  });

  const acyclic: boolean[] = new Array(bonds.length).fill(false);
  for (let bi = 0; bi < bonds.length; bi++) {
    const bond = bonds[bi] as ParsedBond;
    // BFS from bond.a to bond.b without using edge bi.
    const seen = new Array(nAtoms).fill(false);
    const stack = [bond.a];
    seen[bond.a] = true;
    let reached = false;
    while (stack.length > 0) {
      const u = stack.pop() as number;
      if (u === bond.b) {
        reached = true;
        break;
      }
      for (const ei of adj[u] ?? []) {
        if (ei === bi) continue;
        const e = bonds[ei] as ParsedBond;
        const v = e.a === u ? e.b : e.a;
        if (!seen[v]) {
          seen[v] = true;
          stack.push(v);
        }
      }
    }
    acyclic[bi] = !reached; // not reachable without this bond -> it is a bridge
  }
  return acyclic;
}

/** Estimate the drug-likeness descriptors from a SMILES string. */
export function smilesToDescriptors(smiles: string): EstimatedDescriptors {
  const { atoms, bonds } = parseSmiles(smiles);
  const n = atoms.length;
  if (n === 0) throw new Error('smilesToDescriptors: no atoms parsed');

  // Accumulate bond-order sums and heavy-atom degrees per atom.
  const bondOrderSum = new Array(n).fill(0);
  const heavyDegree = new Array(n).fill(0);
  const hasTripleAtom = new Array(n).fill(false);
  for (const b of bonds) {
    bondOrderSum[b.a] += b.order;
    bondOrderSum[b.b] += b.order;
    heavyDegree[b.a] += 1;
    heavyDegree[b.b] += 1;
    if (b.order === 3) {
      hasTripleAtom[b.a] = true;
      hasTripleAtom[b.b] = true;
    }
  }

  // Hydrogens, heavy-atom / heteroatom counts, H-bond donors & acceptors.
  const atomCounts: Record<string, number> = {};
  let totalH = 0;
  let hbd = 0;
  let hba = 0;
  const hydrogensOn = new Array(n).fill(0);
  for (let idx = 0; idx < n; idx++) {
    const atom = atoms[idx] as ParsedAtom;
    atomCounts[atom.element] = (atomCounts[atom.element] ?? 0) + 1;
    const h = implicitHydrogens(atom, bondOrderSum[idx]);
    hydrogensOn[idx] = h;
    totalH += h;
    if (atom.element === 'N' || atom.element === 'O') {
      hba += 1; // Lipinski acceptor = any N or O
      if (h > 0) hbd += h; // Lipinski donor = each N-H / O-H
    }
  }

  // Molecular weight = heavy atoms + all (implicit + explicit) hydrogens.
  let mw = totalH * (ATOMIC_WEIGHT.H as number);
  for (const [el, count] of Object.entries(atomCounts)) {
    mw += count * (ATOMIC_WEIGHT[el] ?? 0);
  }

  // Crude atom-contribution logP.
  let logP = 0;
  for (let idx = 0; idx < n; idx++) {
    const atom = atoms[idx] as ParsedAtom;
    logP += LOGP_ATOM[atom.element] ?? 0;
    const hContribution = atom.element === 'C' ? LOGP_H_ON_C : LOGP_H_ON_HETERO;
    logP += hydrogensOn[idx] * hContribution;
  }

  // Aromatic rings ≈ number of ring-closure bonds whose two atoms are aromatic.
  let aromaticRings = 0;
  for (const b of bonds) {
    if (!b.ring) continue;
    const a1 = atoms[b.a] as ParsedAtom;
    const a2 = atoms[b.b] as ParsedAtom;
    if (a1.aromatic && a2.aromatic) aromaticRings += 1;
  }

  // Rotatable bonds: acyclic single bonds between two non-terminal heavy atoms,
  // excluding bonds adjacent to a triple bond.
  const acyclic = acyclicFlags(n, bonds);
  let rotatableBonds = 0;
  bonds.forEach((b, idx) => {
    if (b.order !== 1) return;
    if (!acyclic[idx]) return;
    if (heavyDegree[b.a] < 2 || heavyDegree[b.b] < 2) return;
    if (hasTripleAtom[b.a] || hasTripleAtom[b.b]) return;
    rotatableBonds += 1;
  });

  const tpsa = estimateTPSA(atoms, bonds, bondOrderSum, hydrogensOn);

  return {
    mw,
    logP,
    hbd,
    hba,
    tpsa,
    rotatableBonds,
    aromaticRings,
    heavyAtoms: n,
    totalAtoms: n + totalH,
    atomCounts,
    formula: hillFormula(atomCounts, totalH),
  };
}

/**
 * Ertl-style topological polar surface area (TPSA). We classify each N/O atom by
 * element, aromaticity, hydrogen count and whether it bears a double bond, and
 * sum the corresponding Ertl (2000) fragment contributions. This covers the
 * common environments; unusual ones fall back to a sensible default.
 */
export function estimateTPSA(
  atoms: ParsedAtom[],
  _bonds: ParsedBond[],
  bondOrderSum: number[],
  hydrogensOn: number[],
): number {
  let tpsa = 0;
  for (let idx = 0; idx < atoms.length; idx++) {
    const atom = atoms[idx] as ParsedAtom;
    const h = hydrogensOn[idx] ?? 0;
    const hasDouble = (bondOrderSum[idx] ?? 0) - h >= 2 && !atom.aromatic;
    if (atom.element === 'O') {
      if (atom.aromatic)
        tpsa += 13.14; // aromatic o (furan)
      else if (h >= 1)
        tpsa += 20.23; // hydroxyl / carboxyl O-H
      else if (hasDouble)
        tpsa += 17.07; // carbonyl =O
      else tpsa += 9.23; // ether O
    } else if (atom.element === 'N') {
      if (atom.aromatic)
        tpsa += h >= 1 ? 15.79 : 12.89; // [nH] vs pyridine n
      else if (hasDouble)
        tpsa += 12.36; // imine / =N-
      else if (h === 0)
        tpsa += 3.24; // tertiary amine
      else if (h === 1)
        tpsa += 12.03; // secondary amine
      else tpsa += 26.02; // primary amine
    }
  }
  return tpsa;
}

// ---------------------------------------------------------------------------
// Descriptor resolution (SMILES or explicit descriptors)
// ---------------------------------------------------------------------------

export interface Descriptors {
  mw: number;
  logP: number;
  hbd: number;
  hba: number;
  tpsa?: number;
  rotatableBonds?: number;
  aromaticRings?: number;
  /** Total atom count (heavy + H) — only known when parsed from SMILES. */
  totalAtoms?: number;
}

// ---------------------------------------------------------------------------
// Drug-likeness rules
// ---------------------------------------------------------------------------

export interface LipinskiResult {
  violations: number;
  pass: boolean; // "drug-like" = at most one violation
  broken: string[];
}

/**
 * Lipinski's Rule of Five: MW ≤ 500, logP ≤ 5, H-bond donors ≤ 5,
 * H-bond acceptors ≤ 10. A compound is flagged as likely to have poor oral
 * absorption when it breaks two or more of these rules.
 */
export function lipinski(d: Descriptors): LipinskiResult {
  const broken: string[] = [];
  if (d.mw > 500) broken.push('MW > 500');
  if (d.logP > 5) broken.push('logP > 5');
  if (d.hbd > 5) broken.push('HBD > 5');
  if (d.hba > 10) broken.push('HBA > 10');
  return { violations: broken.length, pass: broken.length <= 1, broken };
}

export interface VeberResult {
  pass: boolean;
  broken: string[];
}

/** Veber rules for oral bioavailability: rotatable bonds ≤ 10 and TPSA ≤ 140. */
export function veber(d: Descriptors): VeberResult {
  const broken: string[] = [];
  const rotb = d.rotatableBonds ?? 0;
  const tpsa = d.tpsa ?? 0;
  if (rotb > 10) broken.push('rotatable bonds > 10');
  if (tpsa > 140) broken.push('TPSA > 140');
  return { pass: broken.length === 0, broken };
}

export interface GhoseResult {
  pass: boolean;
  broken: string[];
}

/**
 * Ghose filter (a drug-likeness window): logP in [-0.4, 5.6], MW in [160, 480],
 * and (when the atom count is known) total atoms in [20, 70]. The molar
 * refractivity criterion (40–130) is omitted as we do not compute MR.
 */
export function ghose(d: Descriptors): GhoseResult {
  const broken: string[] = [];
  if (d.logP < -0.4 || d.logP > 5.6) broken.push('logP outside [-0.4, 5.6]');
  if (d.mw < 160 || d.mw > 480) broken.push('MW outside [160, 480]');
  if (d.totalAtoms !== undefined && (d.totalAtoms < 20 || d.totalAtoms > 70)) {
    broken.push('atom count outside [20, 70]');
  }
  return { pass: broken.length === 0, broken };
}

// ---------------------------------------------------------------------------
// QED — quantitative estimate of drug-likeness (Bickerton et al. 2012)
// ---------------------------------------------------------------------------

/** Parameters of one asymmetric double-sigmoid (ADS) desirability function. */
interface AdsParameter {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  dmax: number;
}

/** Published ADS parameters (Bickerton et al. 2012, as used by RDKit). */
const ADS: Record<string, AdsParameter> = {
  MW: {
    a: 2.817065973,
    b: 392.5754953,
    c: 290.7489764,
    d: 2.419764353,
    e: 49.22325677,
    f: 65.37051707,
    dmax: 104.9805561,
  },
  ALOGP: {
    a: 3.172690585,
    b: 137.8624751,
    c: 2.534937431,
    d: 4.581497897,
    e: 0.822739154,
    f: 0.576295591,
    dmax: 131.3186604,
  },
  HBA: {
    a: 2.948620388,
    b: 160.4605972,
    c: 3.615294657,
    d: 4.435986202,
    e: 0.290141953,
    f: 1.300669958,
    dmax: 148.7763046,
  },
  HBD: {
    a: 1.618662227,
    b: 1010.051101,
    c: 0.985094388,
    d: 0.000000001,
    e: 0.713820843,
    f: 0.920922555,
    dmax: 258.1632616,
  },
  PSA: {
    a: 1.876861559,
    b: 125.2232657,
    c: 62.90773554,
    d: 87.83366614,
    e: 12.01999824,
    f: 28.51324732,
    dmax: 104.5686167,
  },
  ROTB: {
    a: 0.01,
    b: 272.4121427,
    c: 2.55837997,
    d: 1.565547684,
    e: 1.271567166,
    f: 2.758063707,
    dmax: 105.4420403,
  },
  AROM: {
    a: 3.21778897,
    b: 957.7374108,
    c: 2.274627939,
    d: 0.000000001,
    e: 1.000000001,
    f: 1.317690595,
    dmax: 312.337261,
  },
};

/**
 * The "mean" QED descriptor weights (Bickerton et al.). The structural-ALERTS
 * term (weight 0.95) is omitted here — see file header — so this is the
 * "alert-free" QED variant.
 */
const QED_WEIGHTS: Record<string, number> = {
  MW: 0.66,
  ALOGP: 0.46,
  HBA: 0.05,
  HBD: 0.61,
  PSA: 0.06,
  ROTB: 0.65,
  AROM: 0.48,
};

/**
 * Evaluate a single ADS desirability function at value `x`. Returns a number in
 * roughly [0, 1] that peaks in the property's "drug-like" range.
 */
export function adsDesirability(prop: keyof typeof ADS, x: number): number {
  const p = ADS[prop];
  if (!p) throw new Error(`adsDesirability: unknown property '${prop}'`);
  const { a, b, c, d, e, f, dmax } = p;
  const term1 = b / (1 + Math.exp(-(x - c + d / 2) / e));
  const term2 = 1 - 1 / (1 + Math.exp(-(x - c - d / 2) / f));
  return (a + term1 * term2) / dmax;
}

export interface QedResult {
  qed: number;
  desirabilities: Record<string, number>;
}

/**
 * QED as a weighted geometric mean of the individual ADS desirabilities.
 * Only the descriptors that are actually available contribute — MW, ALOGP, HBA
 * and HBD are always present; PSA / ROTB / AROM are included when supplied.
 */
export function qed(d: Descriptors): QedResult {
  const terms: Array<{ prop: keyof typeof ADS; value: number; weight: number }> = [
    { prop: 'MW', value: d.mw, weight: QED_WEIGHTS.MW as number },
    { prop: 'ALOGP', value: d.logP, weight: QED_WEIGHTS.ALOGP as number },
    { prop: 'HBA', value: d.hba, weight: QED_WEIGHTS.HBA as number },
    { prop: 'HBD', value: d.hbd, weight: QED_WEIGHTS.HBD as number },
  ];
  if (d.tpsa !== undefined)
    terms.push({ prop: 'PSA', value: d.tpsa, weight: QED_WEIGHTS.PSA as number });
  if (d.rotatableBonds !== undefined)
    terms.push({ prop: 'ROTB', value: d.rotatableBonds, weight: QED_WEIGHTS.ROTB as number });
  if (d.aromaticRings !== undefined)
    terms.push({ prop: 'AROM', value: d.aromaticRings, weight: QED_WEIGHTS.AROM as number });

  const desirabilities: Record<string, number> = {};
  let weightedLogSum = 0;
  let weightSum = 0;
  for (const t of terms) {
    // Clamp desirability into (0, 1] so the log is well-defined and the score
    // stays in [0, 1] even if a raw ADS value slightly exceeds 1.
    const dVal = Math.min(1, Math.max(1e-9, adsDesirability(t.prop, t.value)));
    desirabilities[t.prop] = dVal;
    weightedLogSum += t.weight * Math.log(dVal);
    weightSum += t.weight;
  }
  const value = weightSum > 0 ? Math.exp(weightedLogSum / weightSum) : 0;
  return { qed: Math.min(1, Math.max(0, value)), desirabilities };
}

// ---------------------------------------------------------------------------
// Engine spec
// ---------------------------------------------------------------------------

const descriptorsSchema = z
  .object({
    mw: z.number().nonnegative().describe('Molecular weight (Da)'),
    logP: z.number().describe('Octanol-water partition coefficient (logP)'),
    hbd: z.number().int().nonnegative().describe('Hydrogen-bond donors (N-H + O-H)'),
    hba: z.number().int().nonnegative().describe('Hydrogen-bond acceptors (N + O)'),
    tpsa: z.number().nonnegative().optional().describe('Topological polar surface area (Å²)'),
    rotatableBonds: z.number().int().nonnegative().optional().describe('Rotatable bonds'),
    aromaticRings: z.number().int().nonnegative().optional().describe('Aromatic ring count'),
  })
  .describe('Explicit physicochemical descriptors of the molecule.');

const paramsSchema = z
  .object({
    smiles: z.string().min(1).optional().describe('SMILES string to parse for descriptors.'),
    descriptors: descriptorsSchema.optional(),
  })
  .refine((p) => p.smiles !== undefined || p.descriptors !== undefined, {
    message: 'provide either `smiles` or `descriptors`',
  });

export type AdmetParams = z.infer<typeof paramsSchema>;

export interface AdmetDetail {
  source: 'smiles' | 'descriptors';
  descriptors: EstimatedDescriptors | Descriptors;
  rulePass: {
    lipinski: boolean;
    veber: boolean;
    ghose: boolean;
  };
  lipinski: LipinskiResult;
  veber: VeberResult;
  ghose: GhoseResult;
  qedDesirabilities: Record<string, number>;
  formula?: string;
}

const VERSION = '1.0.0';

/** Resolve the input into a full descriptor set. */
function resolveDescriptors(params: AdmetParams): {
  source: 'smiles' | 'descriptors';
  descriptors: Descriptors;
  parsed?: EstimatedDescriptors;
} {
  if (params.smiles !== undefined) {
    const est = smilesToDescriptors(params.smiles);
    return {
      source: 'smiles',
      parsed: est,
      descriptors: {
        mw: est.mw,
        logP: est.logP,
        hbd: est.hbd,
        hba: est.hba,
        tpsa: est.tpsa,
        rotatableBonds: est.rotatableBonds,
        aromaticRings: est.aromaticRings,
        totalAtoms: est.totalAtoms,
      },
    };
  }
  const d = params.descriptors as z.infer<typeof descriptorsSchema>;
  return {
    source: 'descriptors',
    descriptors: {
      mw: d.mw,
      logP: d.logP,
      hbd: d.hbd,
      hba: d.hba,
      tpsa: d.tpsa,
      rotatableBonds: d.rotatableBonds,
      aromaticRings: d.aromaticRings,
    },
  };
}

function run(params: AdmetParams): SimResult<AdmetDetail> {
  const { source, descriptors, parsed } = resolveDescriptors(params);

  const lip = lipinski(descriptors);
  const veb = veber(descriptors);
  const gho = ghose(descriptors);
  const qedRes = qed(descriptors);

  const rulePass = { lipinski: lip.pass, veber: veb.pass, ghose: gho.pass };
  const passCount = Number(rulePass.lipinski) + Number(rulePass.veber) + Number(rulePass.ghose);

  const summary =
    `${source === 'smiles' && parsed ? `${parsed.formula} ` : ''}` +
    `MW ${descriptors.mw.toFixed(1)} Da, logP ${descriptors.logP.toFixed(2)}, ` +
    `HBD ${descriptors.hbd}, HBA ${descriptors.hba}; ` +
    `Lipinski ${lip.violations} violation${lip.violations === 1 ? '' : 's'} ` +
    `(${lip.pass ? 'drug-like' : 'non-drug-like'}); ` +
    `QED ${qedRes.qed.toFixed(3)}; ${passCount}/3 rule sets pass.`;

  const metrics = [
    { key: 'mw', label: 'Molecular weight', value: descriptors.mw, unit: 'Da' },
    {
      key: 'logP',
      label: 'logP',
      value: descriptors.logP,
      note: 'octanol-water partition coefficient',
    },
    { key: 'hbd', label: 'H-bond donors', value: descriptors.hbd },
    { key: 'hba', label: 'H-bond acceptors', value: descriptors.hba },
    {
      key: 'tpsa',
      label: 'Topological polar surface area',
      value: descriptors.tpsa ?? 0,
      unit: 'Å²',
    },
    {
      key: 'lipinskiViolations',
      label: 'Lipinski Ro5 violations',
      value: lip.violations,
      note: lip.pass ? 'drug-like (<= 1)' : 'non-drug-like (>= 2)',
    },
    {
      key: 'qed',
      label: 'QED (drug-likeness)',
      value: qedRes.qed,
      note: '0..1, higher is more drug-like',
    },
  ];

  const detail: AdmetDetail = {
    source,
    descriptors: parsed ?? descriptors,
    rulePass,
    lipinski: lip,
    veber: veb,
    ghose: gho,
    qedDesirabilities: qedRes.desirabilities,
    formula: parsed?.formula,
  };

  return {
    engine: 'admet',
    summary,
    metrics,
    detail,
    provenance: provenance('admet', VERSION, { ...params }),
  };
}

export const spec: EngineSpec<AdmetParams, AdmetDetail> = {
  slug: 'admet',
  title: 'Drug-likeness & ADMET Rules',
  domain: 'drug-discovery',
  version: VERSION,
  description:
    'Screens a small molecule for oral drug-likeness. Accepts either explicit ' +
    'physicochemical descriptors or a lightweight SMILES string that is parsed ' +
    'in-house to estimate molecular weight (implicit-H valence model), H-bond ' +
    'donors/acceptors, aromatic rings, rotatable bonds, TPSA (Ertl fragments) ' +
    "and a crude atom-contribution logP. It then applies Lipinski's Rule of " +
    'Five, the Veber rotatable-bond/TPSA rules and the Ghose filter, and computes ' +
    'a QED-style continuous drug-likeness score (0..1) as a weighted geometric ' +
    'mean of the published Bickerton desirability functions (alert term omitted). ' +
    'Fully deterministic — no randomness.',
  references: [
    'Lipinski, Lombardo, Dominy & Feeney (1997) Adv. Drug Deliv. Rev. 23:3-25.',
    'Ghose, Viswanadhan & Wendoloski (1999) J. Comb. Chem. 1:55-68.',
    'Veber, Johnson, Cheng, Smith, Ward & Kopple (2002) J. Med. Chem. 45:2615-2623.',
    'Bickerton, Paolini, Besnard, Muresan & Hopkins (2012) Nat. Chem. 4:90-98.',
    'Ertl, Rohde & Selzer (2000) J. Med. Chem. 43:3714-3717 (TPSA).',
  ],
  paramsSchema,
  run,
  example: { smiles: 'CC(=O)Oc1ccccc1C(=O)O' }, // aspirin
  tags: ['drug-discovery', 'admet', 'lipinski', 'veber', 'ghose', 'qed', 'smiles', 'druglikeness'],
};

export default spec;
