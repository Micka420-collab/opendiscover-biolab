/**
 * Protein Physicochemical Properties — a ProtParam-style analyser.
 *
 * Given a single-letter amino-acid sequence this engine derives the classic
 * bench-scientist descriptors reported by the ExPASy ProtParam tool:
 *
 *   - molecular weight  (average residue masses + one water)
 *   - theoretical pI    (bisection on the Henderson–Hasselbalch net charge)
 *   - GRAVY             (mean Kyte–Doolittle hydropathy)
 *   - aromaticity       (F+W+Y mole fraction)
 *   - instability index (Guruprasad DIWV dipeptide weighting; stable < 40)
 *   - aliphatic index   (Ikai 1980, relative volume of A/V/I/L side chains)
 *   - extinction (280nm) (Pace/Gill–von Hippel: 5500·W + 1490·Y + 125·C)
 *   - net charge at a chosen pH
 *
 * The whole engine is a pure deterministic function of the sequence — no RNG,
 * no clock, no IO — so a run can be replayed byte-for-byte.
 *
 * References:
 *   Gasteiger et al. (2005) "Protein Identification and Analysis Tools on the
 *     ExPASy Server", The Proteomics Protocols Handbook.
 *   Kyte & Doolittle (1982) J. Mol. Biol. 157:105-132.
 *   Guruprasad, Reddy & Pandit (1990) Protein Eng. 4:155-161.
 *   Ikai (1980) J. Biochem. 88:1895-1898.
 *   Pace et al. (1995) Protein Sci. 4:2411-2423.
 */

import { z } from 'zod';
import type { EngineSpec, SimResult } from '../core/types';
import { provenance } from '../core/types';

/** The 20 standard proteinogenic amino acids (1-letter codes). */
const AMINO_ACIDS = 'ACDEFGHIKLMNPQRSTVWY';

/** Mass of one water molecule (Da) — added once to the sum of residue masses. */
const WATER_MASS = 18.01524;

/**
 * Average (not monoisotopic) residue masses in Daltons — the values ProtParam
 * uses to report "molecular weight" for a whole protein.
 */
const AVG_RESIDUE_MASS: Record<string, number> = {
  A: 71.0788,
  R: 156.1875,
  N: 114.1038,
  D: 115.0886,
  C: 103.1388,
  E: 129.1155,
  Q: 128.1307,
  G: 57.0519,
  H: 137.1411,
  I: 113.1594,
  L: 113.1594,
  K: 128.1741,
  M: 131.1926,
  F: 147.1766,
  P: 97.1167,
  S: 87.0782,
  T: 101.1051,
  W: 186.2132,
  Y: 163.176,
  V: 99.1326,
};

/** Kyte–Doolittle hydropathy index; positive = hydrophobic. */
const KD_HYDROPATHY: Record<string, number> = {
  A: 1.8,
  R: -4.5,
  N: -3.5,
  D: -3.5,
  C: 2.5,
  E: -3.5,
  Q: -3.5,
  G: -0.4,
  H: -3.2,
  I: 4.5,
  L: 3.8,
  K: -3.9,
  M: 1.9,
  F: 2.8,
  P: -1.6,
  S: -0.8,
  T: -0.7,
  W: -0.9,
  Y: -1.3,
  V: 4.2,
};

/**
 * pKa values (EMBOSS `iep` set) for the ionisable groups. Termini plus the
 * side chains of D, E, C, Y (acidic) and H, K, R (basic). These are the
 * "standard" textbook values used for a first-pass pI estimate.
 */
const PKA = {
  nTerm: 8.6,
  cTerm: 3.6,
  C: 8.5, // Cys thiol
  D: 3.9, // Asp
  E: 4.1, // Glu
  H: 6.5, // His imidazole
  K: 10.8, // Lys
  R: 12.5, // Arg guanidinium
  Y: 10.1, // Tyr phenol
} as const;

/** Molar extinction coefficients at 280 nm (M^-1 cm^-1) per chromophore. */
const EXT_W = 5500;
const EXT_Y = 1490;
const EXT_C = 125; // per cysteine (contribution of a cystine bridge, split)

/**
 * Guruprasad dipeptide instability weight matrix (DIWV). Row = first residue,
 * column = second residue. Sum of the weights over every overlapping dipeptide,
 * scaled by 10/L, gives the instability index. Values reproduced from the
 * Guruprasad et al. (1990) table (as used by ExPASy ProtParam / Biopython).
 */
const DIWV: Record<string, Record<string, number>> = {
  A: {
    A: 1.0,
    C: 44.94,
    E: 1.0,
    D: -7.49,
    G: 1.0,
    F: 1.0,
    I: 1.0,
    H: -7.49,
    K: 1.0,
    M: 1.0,
    L: 1.0,
    N: 1.0,
    Q: 1.0,
    P: 20.26,
    S: 1.0,
    R: 1.0,
    T: 1.0,
    W: 1.0,
    V: 1.0,
    Y: 1.0,
  },
  C: {
    A: 1.0,
    C: 1.0,
    E: 1.0,
    D: 20.26,
    G: 1.0,
    F: 1.0,
    I: 1.0,
    H: 33.6,
    K: 1.0,
    M: 33.6,
    L: 20.26,
    N: 1.0,
    Q: -6.54,
    P: 20.26,
    S: 1.0,
    R: 1.0,
    T: 33.6,
    W: 24.68,
    V: -6.54,
    Y: 1.0,
  },
  E: {
    A: 1.0,
    C: 44.94,
    E: 33.6,
    D: 20.26,
    G: 1.0,
    F: 1.0,
    I: 20.26,
    H: -6.54,
    K: 1.0,
    M: 1.0,
    L: 1.0,
    N: 1.0,
    Q: 20.26,
    P: 20.26,
    S: 20.26,
    R: 1.0,
    T: 1.0,
    W: -14.03,
    V: 1.0,
    Y: 1.0,
  },
  D: {
    A: 1.0,
    C: 1.0,
    E: 1.0,
    D: 1.0,
    G: 1.0,
    F: -6.54,
    I: 1.0,
    H: 1.0,
    K: -7.49,
    M: 1.0,
    L: 1.0,
    N: 1.0,
    Q: 1.0,
    P: 1.0,
    S: 20.26,
    R: -6.54,
    T: -14.03,
    W: 1.0,
    V: 1.0,
    Y: 1.0,
  },
  G: {
    A: -7.49,
    C: 1.0,
    E: -6.54,
    D: 1.0,
    G: 13.34,
    F: 1.0,
    I: -7.49,
    H: 1.0,
    K: -7.49,
    M: 1.0,
    L: 1.0,
    N: -7.49,
    Q: 1.0,
    P: 1.0,
    S: 1.0,
    R: 1.0,
    T: -7.49,
    W: 13.34,
    V: 1.0,
    Y: -7.49,
  },
  F: {
    A: 1.0,
    C: 1.0,
    E: 1.0,
    D: 13.34,
    G: 1.0,
    F: 1.0,
    I: 1.0,
    H: 1.0,
    K: -14.03,
    M: 1.0,
    L: 1.0,
    N: 1.0,
    Q: 1.0,
    P: 20.26,
    S: 1.0,
    R: 1.0,
    T: 1.0,
    W: 1.0,
    V: 1.0,
    Y: 33.601,
  },
  I: {
    A: 1.0,
    C: 1.0,
    E: 44.94,
    D: 1.0,
    G: 1.0,
    F: 1.0,
    I: 1.0,
    H: 13.34,
    K: -7.49,
    M: 1.0,
    L: 20.26,
    N: 1.0,
    Q: 1.0,
    P: -1.88,
    S: 1.0,
    R: 1.0,
    T: 1.0,
    W: 1.0,
    V: -7.49,
    Y: 1.0,
  },
  H: {
    A: 1.0,
    C: 1.0,
    E: 1.0,
    D: 1.0,
    G: -9.37,
    F: -9.37,
    I: 44.94,
    H: 1.0,
    K: 24.68,
    M: 1.0,
    L: 1.0,
    N: 24.68,
    Q: 1.0,
    P: -1.88,
    S: 1.0,
    R: 1.0,
    T: -6.54,
    W: -1.88,
    V: 1.0,
    Y: 44.94,
  },
  K: {
    A: 1.0,
    C: 1.0,
    E: 1.0,
    D: 1.0,
    G: -7.49,
    F: 1.0,
    I: -7.49,
    H: 1.0,
    K: 1.0,
    M: 33.6,
    L: -7.49,
    N: 1.0,
    Q: 24.64,
    P: -6.54,
    S: 1.0,
    R: 33.6,
    T: 1.0,
    W: 1.0,
    V: -7.49,
    Y: 1.0,
  },
  M: {
    A: 13.34,
    C: 1.0,
    E: 1.0,
    D: 1.0,
    G: 1.0,
    F: 1.0,
    I: 1.0,
    H: 58.28,
    K: 1.0,
    M: -1.88,
    L: 1.0,
    N: 1.0,
    Q: -6.54,
    P: 44.94,
    S: 44.94,
    R: -6.54,
    T: -1.88,
    W: 1.0,
    V: 1.0,
    Y: 24.68,
  },
  L: {
    A: 1.0,
    C: 1.0,
    E: 1.0,
    D: 1.0,
    G: 1.0,
    F: 1.0,
    I: 1.0,
    H: 1.0,
    K: -7.49,
    M: 1.0,
    L: 1.0,
    N: 1.0,
    Q: 33.6,
    P: 20.26,
    S: 1.0,
    R: 20.26,
    T: 1.0,
    W: 24.68,
    V: 1.0,
    Y: 1.0,
  },
  N: {
    A: 1.0,
    C: -1.88,
    E: 1.0,
    D: 1.0,
    G: -14.03,
    F: -14.03,
    I: 44.94,
    H: 1.0,
    K: 24.68,
    M: 1.0,
    L: 1.0,
    N: 1.0,
    Q: -6.54,
    P: -1.88,
    S: 1.0,
    R: 1.0,
    T: -7.49,
    W: -9.37,
    V: 1.0,
    Y: 1.0,
  },
  Q: {
    A: 1.0,
    C: -6.54,
    E: 20.26,
    D: 20.26,
    G: 1.0,
    F: -6.54,
    I: 1.0,
    H: 1.0,
    K: 1.0,
    M: 1.0,
    L: 1.0,
    N: 1.0,
    Q: 20.26,
    P: 20.26,
    S: 44.94,
    R: 1.0,
    T: 1.0,
    W: 1.0,
    V: -6.54,
    Y: -6.54,
  },
  P: {
    A: 20.26,
    C: -6.54,
    E: 18.38,
    D: -6.54,
    G: 1.0,
    F: 20.26,
    I: 1.0,
    H: 1.0,
    K: 1.0,
    M: -6.54,
    L: 1.0,
    N: 1.0,
    Q: 20.26,
    P: 20.26,
    S: 20.26,
    R: -6.54,
    T: 1.0,
    W: -1.88,
    V: 20.26,
    Y: 1.0,
  },
  S: {
    A: 1.0,
    C: 33.6,
    E: 20.26,
    D: 1.0,
    G: 1.0,
    F: 1.0,
    I: 1.0,
    H: 1.0,
    K: 1.0,
    M: 1.0,
    L: 1.0,
    N: 1.0,
    Q: 20.26,
    P: 44.94,
    S: 20.26,
    R: 20.26,
    T: 1.0,
    W: 1.0,
    V: 1.0,
    Y: 1.0,
  },
  R: {
    A: 1.0,
    C: 1.0,
    E: 1.0,
    D: 1.0,
    G: -7.49,
    F: 1.0,
    I: 1.0,
    H: 20.26,
    K: 1.0,
    M: 1.0,
    L: 1.0,
    N: 13.34,
    Q: 20.26,
    P: 20.26,
    S: 44.94,
    R: 58.28,
    T: 1.0,
    W: 58.28,
    V: 1.0,
    Y: 1.0,
  },
  T: {
    A: 1.0,
    C: 1.0,
    E: 20.26,
    D: 1.0,
    G: -7.49,
    F: 13.34,
    I: 1.0,
    H: 1.0,
    K: 1.0,
    M: 1.0,
    L: 1.0,
    N: -14.03,
    Q: -6.54,
    P: 1.0,
    S: 1.0,
    R: 1.0,
    T: 1.0,
    W: -14.03,
    V: 1.0,
    Y: 1.0,
  },
  W: {
    A: -14.03,
    C: 1.0,
    E: 1.0,
    D: 1.0,
    G: -9.37,
    F: 1.0,
    I: 1.0,
    H: 24.68,
    K: 1.0,
    M: 24.68,
    L: 13.34,
    N: 13.34,
    Q: 1.0,
    P: 1.0,
    S: 1.0,
    R: 1.0,
    T: -14.03,
    W: 1.0,
    V: -7.49,
    Y: 1.0,
  },
  V: {
    A: 1.0,
    C: 1.0,
    E: 1.0,
    D: -14.03,
    G: -7.49,
    F: 1.0,
    I: 1.0,
    H: 1.0,
    K: -1.88,
    M: 1.0,
    L: 1.0,
    N: 1.0,
    Q: 1.0,
    P: 20.26,
    S: 1.0,
    R: 1.0,
    T: -7.49,
    W: 1.0,
    V: 1.0,
    Y: -6.54,
  },
  Y: {
    A: 24.68,
    C: 1.0,
    E: -6.54,
    D: 24.68,
    G: -7.49,
    F: 1.0,
    I: 1.0,
    H: 13.34,
    K: 1.0,
    M: 44.94,
    L: 1.0,
    N: 1.0,
    Q: 1.0,
    P: 13.34,
    S: 1.0,
    R: -15.91,
    T: -7.49,
    W: -9.37,
    V: 1.0,
    Y: 13.34,
  },
};

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/** Normalise a raw sequence: upper-case and strip all whitespace. */
export function cleanSequence(sequence: string): string {
  return sequence.toUpperCase().replace(/\s+/g, '');
}

/** Count occurrences of each standard amino acid. Non-standard letters throw. */
export function aaComposition(sequence: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const aa of AMINO_ACIDS) counts[aa] = 0;
  for (const c of sequence) {
    if (!(c in counts)) {
      throw new Error(`aaComposition: '${c}' is not one of the 20 standard amino acids`);
    }
    counts[c] += 1;
  }
  return counts;
}

/**
 * Average molecular weight (Da) = Σ residue masses + one water for the peptide
 * bond hydrolysis balance.
 */
export function molecularWeight(sequence: string): number {
  let mass = WATER_MASS;
  for (const c of sequence) mass += AVG_RESIDUE_MASS[c] ?? 0;
  return mass;
}

/**
 * Net charge of the chain at a given pH via Henderson–Hasselbalch. Each basic
 * group contributes  +1 / (1 + 10^(pH - pKa))  and each acidic group
 * -1 / (1 + 10^(pKa - pH)). Termini are always present.
 */
export function netChargeAtPH(sequence: string, pH: number): number {
  const counts = aaComposition(sequence);
  const posGroups: Array<[number, number]> = [
    [1, PKA.nTerm],
    [counts.K ?? 0, PKA.K],
    [counts.R ?? 0, PKA.R],
    [counts.H ?? 0, PKA.H],
  ];
  const negGroups: Array<[number, number]> = [
    [1, PKA.cTerm],
    [counts.D ?? 0, PKA.D],
    [counts.E ?? 0, PKA.E],
    [counts.C ?? 0, PKA.C],
    [counts.Y ?? 0, PKA.Y],
  ];
  let charge = 0;
  for (const [n, pKa] of posGroups) charge += n / (1 + 10 ** (pH - pKa));
  for (const [n, pKa] of negGroups) charge -= n / (1 + 10 ** (pKa - pH));
  return charge;
}

/**
 * Theoretical isoelectric point: the pH at which net charge is zero, found by
 * bisection on [0, 14]. Net charge is monotonically decreasing in pH, so
 * bisection is guaranteed to converge.
 */
export function theoreticalPI(sequence: string, tol = 1e-4): number {
  let lo = 0;
  let hi = 14;
  // Net charge is strictly decreasing: positive at lo, negative at hi.
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const charge = netChargeAtPH(sequence, mid);
    if (charge > 0) lo = mid;
    else hi = mid;
    if (hi - lo < tol) break;
  }
  return (lo + hi) / 2;
}

/** GRAVY: grand average of hydropathy = mean Kyte–Doolittle value. */
export function gravy(sequence: string): number {
  if (sequence.length === 0) return 0;
  let sum = 0;
  for (const c of sequence) sum += KD_HYDROPATHY[c] ?? 0;
  return sum / sequence.length;
}

/** Aromaticity: mole fraction of aromatic residues (Phe + Trp + Tyr). */
export function aromaticity(sequence: string): number {
  if (sequence.length === 0) return 0;
  let aromatic = 0;
  for (const c of sequence) if (c === 'F' || c === 'W' || c === 'Y') aromatic += 1;
  return aromatic / sequence.length;
}

/**
 * Instability index (Guruprasad). II = (10/L) · Σ DIWV(dipeptide). A protein
 * with II < 40 is predicted stable in a test tube, ≥ 40 unstable.
 */
export function instabilityIndex(sequence: string): number {
  if (sequence.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < sequence.length - 1; i++) {
    const a = sequence[i];
    const b = sequence[i + 1];
    sum += DIWV[a]?.[b] ?? 0;
  }
  return (10 / sequence.length) * sum;
}

/** Convenience classifier used in the summary. */
export function isStable(sequence: string): boolean {
  return instabilityIndex(sequence) < 40;
}

/**
 * Aliphatic index (Ikai 1980): relative volume occupied by the aliphatic side
 * chains Ala, Val, Ile, Leu. AI = X_A + 2.9·X_V + 3.9·(X_I + X_L) where X are
 * mole percentages (0–100). Higher AI ⇒ greater thermostability.
 */
export function aliphaticIndex(sequence: string): number {
  if (sequence.length === 0) return 0;
  const L = sequence.length;
  const counts = aaComposition(sequence);
  const xA = (100 * (counts.A ?? 0)) / L;
  const xV = (100 * (counts.V ?? 0)) / L;
  const xI = (100 * (counts.I ?? 0)) / L;
  const xL = (100 * (counts.L ?? 0)) / L;
  return xA + 2.9 * xV + 3.9 * (xI + xL);
}

/**
 * Molar extinction coefficient at 280 nm (M^-1 cm^-1), assuming all cysteines
 * form cystines: ε = 5500·nW + 1490·nY + 125·nC.
 */
export function extinctionCoefficient280(sequence: string): number {
  const counts = aaComposition(sequence);
  return EXT_W * (counts.W ?? 0) + EXT_Y * (counts.Y ?? 0) + EXT_C * (counts.C ?? 0);
}

// ---------------------------------------------------------------------------
// Engine spec
// ---------------------------------------------------------------------------

const paramsSchema = z.object({
  sequence: z
    .string()
    .min(1, 'sequence must be non-empty')
    .describe('Protein sequence in single-letter amino-acid codes (case/space insensitive).')
    .refine(
      (s) => {
        const clean = cleanSequence(s);
        return clean.length > 0 && [...clean].every((c) => AMINO_ACIDS.includes(c));
      },
      { message: 'sequence must contain only the 20 standard amino acids (ACDEFGHIKLMNPQRSTVWY)' },
    ),
});

export type PropertiesParams = z.infer<typeof paramsSchema>;

export interface PropertiesDetail {
  cleanSequence: string;
  aaComposition: Record<string, number>;
  charged: {
    positive: number; // Arg + Lys + His residues
    negative: number; // Asp + Glu residues
    netChargeAtPH7: number;
  };
  aromaticity: number;
  aliphaticIndex: number;
}

const VERSION = '1.0.0';

function run(params: PropertiesParams): SimResult<PropertiesDetail> {
  const seq = cleanSequence(params.sequence);
  const counts = aaComposition(seq);

  const length = seq.length;
  const mw = molecularWeight(seq);
  const pI = theoreticalPI(seq);
  const gravyVal = gravy(seq);
  const ii = instabilityIndex(seq);
  const ext = extinctionCoefficient280(seq);
  const aromatic = aromaticity(seq);
  const ai = aliphaticIndex(seq);
  const netAt7 = netChargeAtPH(seq, 7);

  const positive = (counts.R ?? 0) + (counts.K ?? 0) + (counts.H ?? 0);
  const negative = (counts.D ?? 0) + (counts.E ?? 0);
  const stable = ii < 40;

  // A pH titration curve (net charge vs pH) — deterministic, nice to plot.
  const pHs: number[] = [];
  const charge: number[] = [];
  for (let i = 0; i <= 140; i++) {
    const pH = i / 10;
    pHs.push(pH);
    charge.push(netChargeAtPH(seq, pH));
  }

  return {
    engine: 'properties',
    summary:
      `${length}-residue protein: ${mw.toFixed(1)} Da, pI ${pI.toFixed(2)}, ` +
      `GRAVY ${gravyVal.toFixed(2)}, instability ${ii.toFixed(1)} (${stable ? 'stable' : 'unstable'}).`,
    metrics: [
      { key: 'length', label: 'Length', value: length, unit: 'residues' },
      { key: 'molecularWeightDa', label: 'Molecular weight', value: mw, unit: 'Da' },
      { key: 'theoreticalPI', label: 'Theoretical pI', value: pI },
      {
        key: 'gravy',
        label: 'GRAVY (hydropathy)',
        value: gravyVal,
        note: 'positive = hydrophobic',
      },
      {
        key: 'instabilityIndex',
        label: 'Instability index',
        value: ii,
        note: stable ? 'stable (< 40)' : 'unstable (>= 40)',
      },
      {
        key: 'extinction280',
        label: 'Extinction coeff. (280 nm)',
        value: ext,
        unit: 'M^-1 cm^-1',
        note: 'assumes cystines',
      },
    ],
    series: [
      {
        x: pHs,
        y: { netCharge: charge },
        xLabel: 'pH',
        yLabel: 'Net charge',
      },
    ],
    detail: {
      cleanSequence: seq,
      aaComposition: counts,
      charged: { positive, negative, netChargeAtPH7: netAt7 },
      aromaticity: aromatic,
      aliphaticIndex: ai,
    },
    provenance: provenance('properties', VERSION, { sequence: params.sequence }),
  };
}

export const spec: EngineSpec<PropertiesParams, PropertiesDetail> = {
  slug: 'properties',
  title: 'Protein Physicochemical Properties',
  domain: 'protein',
  version: VERSION,
  description:
    'ProtParam-style analysis of a protein from its amino-acid sequence: average ' +
    'molecular weight, theoretical isoelectric point (bisection on the ' +
    'Henderson–Hasselbalch net charge with standard EMBOSS pKa values), GRAVY ' +
    'hydropathy, aromaticity, Guruprasad instability index (stable/unstable at ' +
    '40), Ikai aliphatic index, the 280 nm molar extinction coefficient, and a ' +
    'net-charge-versus-pH titration curve. Fully deterministic — no randomness.',
  references: [
    'Gasteiger et al. (2005) Protein Identification and Analysis Tools on the ExPASy Server.',
    'Kyte & Doolittle (1982) J. Mol. Biol. 157:105-132.',
    'Guruprasad, Reddy & Pandit (1990) Protein Eng. 4:155-161.',
    'Ikai (1980) J. Biochem. 88:1895-1898.',
    'Pace et al. (1995) Protein Sci. 4:2411-2423.',
  ],
  paramsSchema,
  run,
  example: { sequence: 'MKWVTFISLLFLFSSAYSRGVFRRDTHKSEIAHRFKDLGE' },
  tags: ['protein', 'protparam', 'molecular-weight', 'isoelectric-point', 'gravy', 'stability'],
};

export default spec;
