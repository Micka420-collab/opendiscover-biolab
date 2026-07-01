/**
 * Geometric rigid-body molecular docking — Lennard-Jones shape-complementarity
 * scoring over a candidate set of ligand poses.
 *
 * This is a deliberately SIMPLIFIED model of the core idea behind classical
 * geometric docking (Kuntz et al. 1982, DOCK): score how well a ligand's shape
 * complements a receptor's binding site, then rank a set of candidate rigid-body
 * poses (translation + rotation) by that score. It is NOT a production docking
 * engine — no electrostatics, no solvation, no receptor/ligand flexibility, no
 * calibrated force-field atom typing, and no continuous pose optimization (only
 * ranks the discrete poses it is given). Treat scores as illustrative shape/
 * contact energetics, not binding-affinity predictions.
 *
 * Pairwise atom-atom interaction is the standard 12-6 Lennard-Jones potential:
 *
 *   V(r) = 4ε[(σ/r)¹² − (σ/r)⁶]
 *
 * with Lorentz-Berthelot combining rules for unlike-atom pairs:
 *   σ_ij = (σ_i + σ_j) / 2          (arithmetic mean, by definition)
 *   ε_ij = √(ε_i · ε_j)             (geometric mean, by definition)
 *
 * V(r) has two analytically exact, independently-verifiable properties used
 * directly as test invariants: V(σ) = 0, and the minimum V(2^(1/6)σ) = −ε
 * (found by setting dV/dr = 0 and solving — reproduced in the test file).
 *
 * Poses are rigid transforms (translate + rotate) applied to the ligand's atom
 * coordinates. Rotation uses Rodrigues' rotation formula about an arbitrary
 * unit axis, which is an orthogonal transform — it provably preserves vector
 * norms and pairwise distances, checked directly as a test invariant rather
 * than trusted from the formula's reputation.
 *
 * References:
 *   - Kuntz ID, Blaney JM, Oatley SJ, Langridge R, Ferrin TE (1982). "A
 *     geometric approach to macromolecule-ligand interactions." J. Mol. Biol.
 *     161:269–288.
 *   - Lennard-Jones JE (1924). Proc. R. Soc. Lond. A 106:463 — the 12-6 potential.
 *   - Rodrigues O. (1840) — the axis-angle rotation formula.
 */

import { z } from 'zod';
import { provenance } from '../core/types';
import type { EngineSpec, SimResult } from '../core/types';

export type Vec3 = [number, number, number];

export interface Atom {
  position: Vec3;
  /** LJ size parameter σ (distance at which V=0). */
  sigma: number;
  /** LJ well depth ε (interaction strength). */
  epsilon: number;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export function vecAdd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vecSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vecNorm(a: Vec3): number {
  return Math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2);
}

export function vecDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vecCross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function distance(a: Vec3, b: Vec3): number {
  return vecNorm(vecSub(a, b));
}

/**
 * Rodrigues' rotation formula: rotate vector `v` by `angleRad` about a unit
 * axis `axis`. An orthogonal transform — preserves |v| and pairwise distances.
 */
export function rotateVec(v: Vec3, axis: Vec3, angleRad: number): Vec3 {
  const n = vecNorm(axis);
  const k: Vec3 = n > 0 ? [axis[0] / n, axis[1] / n, axis[2] / n] : [0, 0, 1];
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dot = vecDot(k, v);
  const cross = vecCross(k, v);
  return [
    v[0] * cos + cross[0] * sin + k[0] * dot * (1 - cos),
    v[1] * cos + cross[1] * sin + k[1] * dot * (1 - cos),
    v[2] * cos + cross[2] * sin + k[2] * dot * (1 - cos),
  ];
}

// ---------------------------------------------------------------------------
// Lennard-Jones scoring
// ---------------------------------------------------------------------------

/** Lorentz-Berthelot combining rules for unlike-atom σ/ε. */
export function combine(
  a: { sigma: number; epsilon: number },
  b: { sigma: number; epsilon: number },
) {
  return { sigma: (a.sigma + b.sigma) / 2, epsilon: Math.sqrt(a.epsilon * b.epsilon) };
}

/** The 12-6 Lennard-Jones potential at separation r. */
export function lennardJones(r: number, sigma: number, epsilon: number): number {
  if (r <= 0) return Number.POSITIVE_INFINITY;
  const sr6 = (sigma / r) ** 6;
  const sr12 = sr6 * sr6;
  return 4 * epsilon * (sr12 - sr6);
}

/** Total pairwise LJ interaction energy between every receptor/ligand atom. */
export function poseEnergy(receptor: Atom[], ligand: Atom[]): number {
  let total = 0;
  for (const r of receptor) {
    for (const l of ligand) {
      const { sigma, epsilon } = combine(r, l);
      total += lennardJones(distance(r.position, l.position), sigma, epsilon);
    }
  }
  return total;
}

/** Apply a rigid-body transform (rotate about the origin, then translate) to a ligand. */
export function transformLigand(
  ligand: Atom[],
  translation: Vec3,
  rotationAxis: Vec3,
  rotationAngleRad: number,
): Atom[] {
  return ligand.map((a) => ({
    ...a,
    position: vecAdd(rotateVec(a.position, rotationAxis, rotationAngleRad), translation),
  }));
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

const atomSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  sigma: z.number().positive().default(1.7),
  epsilon: z.number().positive().default(0.1),
});

const poseSchema = z.object({
  translation: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 0]),
  rotationAxis: z.tuple([z.number(), z.number(), z.number()]).default([0, 0, 1]),
  rotationDeg: z.number().default(0),
});

export const dockingParams = z.object({
  /** Fixed receptor atoms (binding-site model). */
  receptor: z.array(atomSchema).min(1).max(200),
  /** Ligand atoms, in their own local frame (transformed per candidate pose). */
  ligand: z.array(atomSchema).min(1).max(100),
  /** Candidate rigid-body poses to score and rank. */
  poses: z.array(poseSchema).min(1).max(500),
});

export type DockingParams = z.input<typeof dockingParams>;

export interface RankedPose {
  index: number;
  translation: Vec3;
  rotationAxis: Vec3;
  rotationDeg: number;
  energy: number;
  minReceptorLigandDistance: number;
}

export interface DockingDetail {
  ranked: RankedPose[];
  best: RankedPose;
}

function run(rawParams: DockingParams): SimResult<DockingDetail> {
  const p = dockingParams.parse(rawParams);
  const receptor: Atom[] = p.receptor;

  const ranked: RankedPose[] = p.poses.map((pose, index) => {
    const posed = transformLigand(
      p.ligand,
      pose.translation,
      pose.rotationAxis,
      (pose.rotationDeg * Math.PI) / 180,
    );
    const energy = poseEnergy(receptor, posed);
    let minDist = Number.POSITIVE_INFINITY;
    for (const r of receptor)
      for (const l of posed) minDist = Math.min(minDist, distance(r.position, l.position));
    return {
      index,
      translation: pose.translation,
      rotationAxis: pose.rotationAxis,
      rotationDeg: pose.rotationDeg,
      energy,
      minReceptorLigandDistance: minDist,
    };
  });

  ranked.sort((a, b) => a.energy - b.energy); // most negative (most stable) first
  const best = ranked[0];

  return {
    engine: 'docking',
    summary: `Scored ${ranked.length} candidate pose${ranked.length > 1 ? 's' : ''}; best pose #${best.index} at energy ${best.energy.toFixed(3)} (closest contact ${best.minReceptorLigandDistance.toFixed(3)}).`,
    metrics: [
      { key: 'poseCount', label: 'Poses scored', value: ranked.length },
      { key: 'bestEnergy', label: 'Best pose energy', value: best.energy },
      { key: 'bestPoseIndex', label: 'Best pose index', value: best.index },
      {
        key: 'bestContactDistance',
        label: 'Closest receptor–ligand contact (best pose)',
        value: best.minReceptorLigandDistance,
      },
    ],
    detail: { ranked, best },
    provenance: provenance('docking', '1.0.0', p),
  };
}

export const spec: EngineSpec<DockingParams, DockingDetail> = {
  slug: 'docking',
  title: 'Geometric Molecular Docking (Lennard-Jones Pose Scoring)',
  domain: 'drug-discovery',
  version: '1.0.0',
  description:
    'Ranks a set of candidate rigid-body ligand poses (translation + rotation) against a fixed ' +
    'receptor by total pairwise Lennard-Jones 12-6 shape/contact energy, using Lorentz-Berthelot ' +
    'combining rules for unlike atoms. A simplified model of classical geometric docking ' +
    '(Kuntz et al. 1982) — no electrostatics, solvation, flexibility, or calibrated force field; ' +
    'scores are illustrative shape-complementarity energetics, not binding-affinity predictions.',
  references: [
    'Kuntz ID et al. (1982). J. Mol. Biol. 161:269 — geometric docking.',
    'Lennard-Jones JE (1924). Proc. R. Soc. Lond. A 106:463 — the 12-6 potential.',
  ],
  tags: ['docking', 'lennard-jones', 'drug-discovery', 'rigid-body', 'pose-scoring'],
  paramsSchema: dockingParams,
  example: {
    receptor: [
      { position: [0, 0, 0], sigma: 1.7, epsilon: 0.1 },
      { position: [3, 0, 0], sigma: 1.7, epsilon: 0.1 },
      { position: [0, 3, 0], sigma: 1.7, epsilon: 0.1 },
    ],
    ligand: [{ position: [0, 0, 0], sigma: 1.7, epsilon: 0.15 }],
    poses: [
      { translation: [1, 1, 0], rotationAxis: [0, 0, 1], rotationDeg: 0 },
      { translation: [1.9, 1.9, 0], rotationAxis: [0, 0, 1], rotationDeg: 0 },
      { translation: [0.5, 0.5, 0], rotationAxis: [0, 0, 1], rotationDeg: 0 },
      { translation: [10, 10, 10], rotationAxis: [0, 0, 1], rotationDeg: 0 },
    ],
  },
  run,
};
