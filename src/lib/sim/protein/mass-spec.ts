/**
 * Peptide mass spectrometry — monoisotopic fragment-ion (b/y) prediction.
 *
 * Tandem MS (MS/MS) fragments a peptide along its backbone amide bonds under
 * collision-induced dissociation (CID/HCD). The two dominant, charge-retentive
 * fragment series are:
 *
 *   b-ion  (N-terminal fragment, i residues):  m/z = (Σ residues[1..i] + z·p) / z
 *   y-ion  (C-terminal fragment, i residues):  m/z = (Σ residues[n-i+1..n] + H₂O + z·p) / z
 *
 * where p is the proton mass and z the fragment's charge. Residue masses are
 * NOT hardcoded from a literature table — they are computed from each residue's
 * elemental formula (C, H, N, O, S atom counts) times the monoisotopic atomic
 * masses, which are physical constants (CODATA). This is the same approach
 * every real proteomics tool uses, and it means every residue mass here is
 * independently re-derivable from first principles rather than trusted as a
 * copied number.
 *
 * Determinism: purely arithmetic, no randomness, no external state.
 *
 * References:
 *   - Roepstorff P, Fohlman J (1984). "Proposal for a common nomenclature for
 *     sequence ions in mass spectra of peptides." Biomed. Mass Spectrom. 11:601
 *     (defines the a/b/c and x/y/z ion series).
 *   - Steen H, Mann M (2004). "The ABC's (and XYZ's) of peptide sequencing."
 *     Nat. Rev. Mol. Cell Biol. 5:699–711.
 *   - CODATA 2018 recommended values for atomic/proton mass.
 */

import { z } from 'zod';
import { provenance } from '../core/types';
import type { EngineSpec, SimResult } from '../core/types';

// ---------------------------------------------------------------------------
// Physical constants (monoisotopic, CODATA) — the only "magic numbers" here.
// Every residue/peptide mass below is derived arithmetically from these.
// ---------------------------------------------------------------------------

/** Monoisotopic atomic masses (Da), CODATA. */
const ATOMIC_MASS = {
  H: 1.0078250319,
  C: 12.0, // exact, by definition of the unified atomic mass unit
  N: 14.0030740052,
  O: 15.9949146221,
  S: 31.97207069,
} as const;

/** CODATA monoisotopic proton mass (Da) — used for [M+zH]^z+ ionization. */
const PROTON_MASS = 1.00727646688;

/** Elemental formula of each amino-acid RESIDUE (the amino acid minus H₂O, as
 * it appears once condensed into a peptide chain). Standard biochemistry. */
const RESIDUE_FORMULA: Record<string, { C: number; H: number; N: number; O: number; S: number }> = {
  G: { C: 2, H: 3, N: 1, O: 1, S: 0 }, // Glycine
  A: { C: 3, H: 5, N: 1, O: 1, S: 0 }, // Alanine
  S: { C: 3, H: 5, N: 1, O: 2, S: 0 }, // Serine
  P: { C: 5, H: 7, N: 1, O: 1, S: 0 }, // Proline
  V: { C: 5, H: 9, N: 1, O: 1, S: 0 }, // Valine
  T: { C: 4, H: 7, N: 1, O: 2, S: 0 }, // Threonine
  C: { C: 3, H: 5, N: 1, O: 1, S: 1 }, // Cysteine
  L: { C: 6, H: 11, N: 1, O: 1, S: 0 }, // Leucine
  I: { C: 6, H: 11, N: 1, O: 1, S: 0 }, // Isoleucine
  N: { C: 4, H: 6, N: 2, O: 2, S: 0 }, // Asparagine
  D: { C: 4, H: 5, N: 1, O: 3, S: 0 }, // Aspartate
  Q: { C: 5, H: 8, N: 2, O: 2, S: 0 }, // Glutamine
  K: { C: 6, H: 12, N: 2, O: 1, S: 0 }, // Lysine
  E: { C: 5, H: 7, N: 1, O: 3, S: 0 }, // Glutamate
  M: { C: 5, H: 9, N: 1, O: 1, S: 1 }, // Methionine
  H: { C: 6, H: 7, N: 3, O: 1, S: 0 }, // Histidine
  F: { C: 9, H: 9, N: 1, O: 1, S: 0 }, // Phenylalanine
  R: { C: 6, H: 12, N: 4, O: 1, S: 0 }, // Arginine
  Y: { C: 9, H: 9, N: 1, O: 2, S: 0 }, // Tyrosine
  W: { C: 11, H: 10, N: 2, O: 1, S: 0 }, // Tryptophan
};

/** A residue's monoisotopic mass, computed from its elemental formula. */
export function residueMass(aa: string): number {
  const f = RESIDUE_FORMULA[aa.toUpperCase()];
  if (!f) throw new Error(`Unknown residue: "${aa}" (expects one of the 20 standard amino acids)`);
  return (
    f.C * ATOMIC_MASS.C +
    f.H * ATOMIC_MASS.H +
    f.N * ATOMIC_MASS.N +
    f.O * ATOMIC_MASS.O +
    f.S * ATOMIC_MASS.S
  );
}

/** Water's monoisotopic mass (2H + O), added once per peptide (condensation). */
export const WATER_MASS = 2 * ATOMIC_MASS.H + ATOMIC_MASS.O;

/** Neutral monoisotopic mass of an intact peptide: Σ residues + H₂O. */
export function peptideNeutralMass(sequence: string): number {
  let sum = 0;
  for (const aa of sequence) sum += residueMass(aa);
  return sum + WATER_MASS;
}

/** m/z of the peptide ionized to charge z (the precursor ion). */
export function precursorMZ(sequence: string, z: number): number {
  return (peptideNeutralMass(sequence) + z * PROTON_MASS) / z;
}

/** m/z of the b-ion covering the first `i` residues, at charge `z`. */
export function bIonMZ(sequence: string, i: number, z: number): number {
  let sum = 0;
  for (let k = 0; k < i; k++) sum += residueMass(sequence[k]);
  return (sum + z * PROTON_MASS) / z;
}

/** m/z of the y-ion covering the last `i` residues, at charge `z`. */
export function yIonMZ(sequence: string, i: number, z: number): number {
  let sum = 0;
  for (let k = sequence.length - i; k < sequence.length; k++) sum += residueMass(sequence[k]);
  return (sum + WATER_MASS + z * PROTON_MASS) / z;
}

export interface FragmentIon {
  series: 'b' | 'y';
  position: number; // number of residues in the fragment
  charge: number;
  mz: number;
}

/** Every b/y fragment ion (positions 1..n-1) at each requested charge. */
export function fragmentSpectrum(sequence: string, charges: number[]): FragmentIon[] {
  const n = sequence.length;
  const ions: FragmentIon[] = [];
  for (const z of charges) {
    for (let i = 1; i <= n - 1; i++) {
      ions.push({ series: 'b', position: i, charge: z, mz: bIonMZ(sequence, i, z) });
      ions.push({ series: 'y', position: i, charge: z, mz: yIonMZ(sequence, i, z) });
    }
  }
  return ions.sort((a, b) => a.mz - b.mz);
}

/**
 * Match an observed peak list against a candidate sequence's predicted b/y
 * ions (singly charged) within a tolerance — the core operation behind
 * peptide-spectrum matching in proteomics search engines (e.g. SEQUEST,
 * Mascot). Returns which observed peaks matched which predicted ion.
 */
export function matchSpectrum(
  sequence: string,
  observedMz: number[],
  toleranceDa = 0.02,
): { matched: number; total: number; matches: { observed: number; ion: FragmentIon }[] } {
  const predicted = fragmentSpectrum(sequence, [1]);
  const matches: { observed: number; ion: FragmentIon }[] = [];
  for (const obs of observedMz) {
    let best: FragmentIon | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const ion of predicted) {
      const diff = Math.abs(ion.mz - obs);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = ion;
      }
    }
    if (best && bestDiff <= toleranceDa) matches.push({ observed: obs, ion: best });
  }
  return { matched: matches.length, total: observedMz.length, matches };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export const massSpecParams = z.object({
  /** Peptide sequence, one-letter amino-acid code (standard 20 only). */
  sequence: z.string().min(2).max(100),
  /** Precursor charge state for [M+zH]^z+ (informational metric). */
  precursorCharge: z.number().int().min(1).max(6).default(2),
  /** Fragment-ion charge states to compute (usually 1, sometimes 2). */
  fragmentCharges: z.array(z.number().int().min(1).max(4)).min(1).max(3).default([1]),
});

export type MassSpecParams = z.input<typeof massSpecParams>;

export interface MassSpecDetail {
  neutralMass: number;
  precursorMZ: number;
  ions: FragmentIon[];
  /** Max |b_i + y_(n-i) − (M + 2p)| across all i — should be ~0 (algebraic identity). */
  complementarityMaxError: number;
}

function run(rawParams: MassSpecParams): SimResult<MassSpecDetail> {
  const p = massSpecParams.parse(rawParams);
  const seq = p.sequence.toUpperCase();
  const n = seq.length;

  const neutralMass = peptideNeutralMass(seq);
  const precMZ = precursorMZ(seq, p.precursorCharge);
  const ions = fragmentSpectrum(seq, p.fragmentCharges);

  // b_i (z=1) + y_(n-i) (z=1) must equal neutralMass + 2*proton for every i —
  // a pure algebraic identity of the definitions above, checked numerically.
  let complementarityMaxError = 0;
  for (let i = 1; i <= n - 1; i++) {
    const sum = bIonMZ(seq, i, 1) + yIonMZ(seq, n - i, 1);
    const expected = neutralMass + 2 * PROTON_MASS;
    complementarityMaxError = Math.max(complementarityMaxError, Math.abs(sum - expected));
  }

  return {
    engine: 'mass-spec',
    summary: `Peptide ${seq} (${n} residues): neutral mass ${neutralMass.toFixed(4)} Da, [M+${p.precursorCharge}H]${p.precursorCharge}+ = ${precMZ.toFixed(4)}; ${ions.length} fragment ions predicted.`,
    metrics: [
      { key: 'neutralMass', label: 'Neutral monoisotopic mass', value: neutralMass, unit: 'Da' },
      {
        key: 'precursorMZ',
        label: `[M+${p.precursorCharge}H]${p.precursorCharge}+`,
        value: precMZ,
        unit: 'm/z',
      },
      { key: 'fragmentCount', label: 'Fragment ions', value: ions.length },
      {
        key: 'complementarityMaxError',
        label: 'b/y complementarity max error',
        value: complementarityMaxError,
        unit: 'Da',
        note: 'b_i + y_(n-i) = M + 2·proton by construction; should be ~0',
      },
    ],
    detail: { neutralMass, precursorMZ: precMZ, ions, complementarityMaxError },
    provenance: provenance('mass-spec', '1.0.0', p),
  };
}

export const spec: EngineSpec<MassSpecParams, MassSpecDetail> = {
  slug: 'mass-spec',
  title: 'Peptide Mass Spectrometry (b/y Fragment Ions)',
  domain: 'protein',
  version: '1.0.0',
  description:
    'Predicts monoisotopic b/y fragment-ion m/z values for a peptide under CID/HCD tandem mass ' +
    'spectrometry, plus the precursor m/z at a given charge state. Residue masses are computed ' +
    "from each amino acid's elemental formula times CODATA atomic masses (not a hardcoded " +
    'literature table), so every number is independently re-derivable. Includes a simple ' +
    'peak-matching utility for scoring a candidate sequence against an observed spectrum.',
  references: [
    'Roepstorff P, Fohlman J (1984). Biomed. Mass Spectrom. 11:601 — ion nomenclature.',
    'Steen H, Mann M (2004). Nat. Rev. Mol. Cell Biol. 5:699 — "The ABC\'s (and XYZ\'s) of peptide sequencing."',
  ],
  tags: ['mass-spectrometry', 'proteomics', 'fragmentation', 'peptide', 'ms-ms'],
  paramsSchema: massSpecParams,
  example: {
    sequence: 'PEPTIDE',
    precursorCharge: 2,
    fragmentCharges: [1],
  },
  run,
};
