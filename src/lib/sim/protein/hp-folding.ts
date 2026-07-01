/**
 * HP Lattice Protein Folding — the classic Dill model on a 2D square lattice.
 *
 * ---------------------------------------------------------------------------
 * THE MODEL
 * ---------------------------------------------------------------------------
 * A protein is reduced to a binary sequence of residues, each either
 *   H — hydrophobic  (wants to be buried, away from solvent)
 *   P — polar        (happy in solvent)
 * A conformation is a *self-avoiding walk* (SAW) on the square lattice: each
 * residue occupies a distinct integer lattice site and consecutive residues sit
 * on nearest-neighbour sites (bond length 1).
 *
 * The energy rewards hydrophobic burial. Following Dill (1985), the energy is
 *
 *     E = -1  ·  (number of H–H *topological contacts*)
 *
 * where a topological contact is a pair of H residues that are lattice
 * neighbours (unit distance apart) but are NOT adjacent along the chain
 * (|i - j| >= 2). Chain-adjacent pairs are excluded because their proximity is
 * forced by connectivity, not by folding. The native state is the SAW that
 * maximises H–H contacts, i.e. minimises E.
 *
 * ---------------------------------------------------------------------------
 * THE SEARCH — seeded Metropolis Monte Carlo with simulated annealing
 * ---------------------------------------------------------------------------
 * Finding the ground state is NP-hard in general, so we sample conformation
 * space with the Metropolis algorithm and cool the temperature geometrically
 * (simulated annealing) to settle into a low-energy basin while always
 * remembering the best (lowest-energy) conformation ever visited.
 *
 * The move set (all bond-length- and, when accepted, self-avoidance-preserving):
 *   - pivot move:  rigidly rotate the chain tail past a pivot residue by 90/180/270°.
 *                  Ergodic over SAWs; makes large global rearrangements.
 *   - corner flip: flip a single "corner" residue to the opposite corner of its
 *                  unit square. A cheap local move that compacts structure.
 *   - end move:    swing a terminal residue to another free neighbour of its
 *                  partner. Frees up trapped chain ends.
 *
 * All randomness comes from the injected seeded PRNG (`createRng`) so a run is
 * byte-for-byte reproducible from its seed — no `Math.random`, no `Date`.
 *
 * References:
 *   - K.A. Dill, "Theory for the folding and stability of globular proteins",
 *     Biochemistry 24 (1985) 1501.
 *   - K.F. Lau & K.A. Dill, Macromolecules 22 (1989) 3986 (the HP lattice model).
 *   - R. Unger & J. Moult, "Genetic algorithms for protein folding simulations",
 *     J. Mol. Biol. 231 (1993) 75 (standard 2D benchmark sequences & optima).
 */

import { z } from 'zod';
import { createRng } from '../core/prng';
import type { EngineSpec, SimResult } from '../core/types';
import { provenance } from '../core/types';

/** An integer lattice site. */
export type Point = readonly [number, number];

/** The four unit steps on the square lattice. */
const NEIGHBOURS: readonly Point[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Encode a lattice site as a string map key (coordinates may be negative). */
function key(x: number, y: number): string {
  return `${x},${y}`;
}

// ---------------------------------------------------------------------------
// Scientific primitives (exported individually so they can be unit-tested and
// reused, e.g. to score an externally supplied conformation).
// ---------------------------------------------------------------------------

/** Parse & validate an H/P sequence into an uppercase residue array. */
export function parseSequence(sequence: string): ('H' | 'P')[] {
  const up = sequence.toUpperCase();
  if (!/^[HP]+$/.test(up)) {
    throw new Error(`Invalid HP sequence: ${sequence} (only 'H' and 'P' allowed)`);
  }
  return [...up] as ('H' | 'P')[];
}

/** True iff no two residues share a lattice site (the walk is self-avoiding). */
export function isSelfAvoiding(coords: readonly Point[]): boolean {
  const seen = new Set<string>();
  for (const [x, y] of coords) {
    const k = key(x, y);
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

/**
 * Count H–H topological contacts: pairs of H residues at unit lattice distance
 * that are NOT adjacent in the sequence. O(N) via a site→index hash map.
 */
export function countHHContacts(
  coords: readonly Point[],
  residues: readonly ('H' | 'P')[],
): number {
  const site = new Map<string, number>();
  for (let i = 0; i < coords.length; i++) site.set(key(coords[i][0], coords[i][1]), i);

  let contacts = 0;
  for (let i = 0; i < coords.length; i++) {
    if (residues[i] !== 'H') continue;
    const [x, y] = coords[i];
    for (const [dx, dy] of NEIGHBOURS) {
      const j = site.get(key(x + dx, y + dy));
      // Count each unordered pair once (j > i) and require both H,
      // non-sequence-adjacent (|i - j| >= 2).
      if (j !== undefined && j > i + 1 && residues[j] === 'H') contacts++;
    }
  }
  return contacts;
}

/** Dill energy of a conformation: E = -(number of H–H topological contacts). */
export function energy(coords: readonly Point[], residues: readonly ('H' | 'P')[]): number {
  const contacts = countHHContacts(coords, residues);
  // Normalise -0 to 0 so downstream Object.is comparisons behave.
  return contacts === 0 ? 0 : -contacts;
}

/** The trivial extended (straight horizontal line) conformation — always a SAW. */
export function straightConformation(n: number): Point[] {
  return Array.from({ length: n }, (_, i) => [i, 0] as Point);
}

// ---------------------------------------------------------------------------
// Monte-Carlo moves. Each returns a *new* coordinate array (proposal) or null
// if the move is not applicable to the chosen residue. Self-avoidance of the
// proposal is validated by the caller.
// ---------------------------------------------------------------------------

/** Rotate a relative vector by 90° (r=1), 180° (r=2) or 270° (r=3) CCW. */
function rotate(dx: number, dy: number, r: number): Point {
  switch (r) {
    case 1:
      return [-dy, dx];
    case 2:
      return [-dx, -dy];
    default:
      return [dy, -dx];
  }
}

/**
 * Pivot move: keep residues 0..p fixed and rigidly rotate the tail p+1..N-1
 * about the pivot site coords[p] by a non-identity lattice rotation.
 */
function pivotMove(coords: readonly Point[], p: number, r: number): Point[] {
  const [px, py] = coords[p];
  const next = coords.slice() as Point[];
  for (let k = p + 1; k < coords.length; k++) {
    const [rx, ry] = rotate(coords[k][0] - px, coords[k][1] - py, r);
    next[k] = [px + rx, py + ry];
  }
  return next;
}

/**
 * Corner flip: if internal residue i sits at a corner (its two chain neighbours
 * are diagonal), reflect it to the opposite corner of the unit square. The new
 * site b' = a + c - b remains bonded to both neighbours.
 */
function cornerFlip(coords: readonly Point[], i: number): Point[] | null {
  const [ax, ay] = coords[i - 1];
  const [cx, cy] = coords[i + 1];
  // Corner iff the neighbours are diagonal (Chebyshev step of 1 in both axes).
  if (Math.abs(ax - cx) !== 1 || Math.abs(ay - cy) !== 1) return null;
  const bx = ax + cx - coords[i][0];
  const by = ay + cy - coords[i][1];
  const next = coords.slice() as Point[];
  next[i] = [bx, by];
  return next;
}

/**
 * End move: swing a terminal residue (end = 0 or N-1) to a different free-looking
 * neighbour of its single chain partner. Direction chosen by the PRNG.
 */
function endMove(coords: readonly Point[], end: number, dir: number): Point[] | null {
  const partner = end === 0 ? coords[1] : coords[coords.length - 2];
  const [ox, oy] = NEIGHBOURS[dir];
  const cand: Point = [partner[0] + ox, partner[1] + oy];
  // No-op if it lands back on the current site.
  if (cand[0] === coords[end][0] && cand[1] === coords[end][1]) return null;
  const next = coords.slice() as Point[];
  next[end] = cand;
  return next;
}

// ---------------------------------------------------------------------------
// The folding driver.
// ---------------------------------------------------------------------------

export interface FoldResult {
  /** Lowest energy found (<= 0). */
  bestEnergy: number;
  /** H–H topological contacts in the best conformation (= -bestEnergy). */
  hhContacts: number;
  /** Coordinates of the best conformation. */
  bestCoords: Point[];
  /** Fraction of proposed moves accepted by Metropolis over the whole run. */
  acceptanceRate: number;
  /** Sampled trajectory for charting. */
  trajectory: { step: number[]; current: number[]; best: number[] };
}

/**
 * Run seeded simulated-annealing Metropolis Monte Carlo to fold `sequence`.
 *
 * `temperature` is the *initial* annealing temperature; the schedule cools
 * geometrically toward a small floor so the walk first explores broadly and then
 * commits to a low-energy basin. The best conformation ever seen is returned
 * (annealing is a global minimiser, not just a sampler of the final T).
 */
export function foldHP(opts: {
  sequence: string;
  steps: number;
  temperature: number;
  seed: number | string;
}): FoldResult {
  const residues = parseSequence(opts.sequence);
  const n = residues.length;
  const rng = createRng(opts.seed);

  // Geometric annealing schedule from T0 down to a floor near the folding
  // transition. Below ~0.15 almost nothing is accepted, which "freezes" the
  // structure once a basin is found.
  const T0 = Math.max(opts.temperature, 1e-3);
  const TMIN = Math.min(0.15, T0);
  const coolRatio = opts.steps > 1 ? (TMIN / T0) ** (1 / (opts.steps - 1)) : 1;

  let coords: Point[] = straightConformation(n);
  let curE = energy(coords, residues);
  let bestE = curE;
  let bestCoords = coords.slice() as Point[];
  let accepted = 0;

  // Sample ~200 points along the trajectory for a lightweight chart series.
  const sampleEvery = Math.max(1, Math.floor(opts.steps / 200));
  const traj = { step: [] as number[], current: [] as number[], best: [] as number[] };

  let T = T0;
  for (let s = 0; s < opts.steps; s++) {
    // Propose a move. Local moves dominate (they refine compact states); pivots
    // provide the large jumps needed for ergodicity.
    let proposal: Point[] | null = null;
    const roll = rng.next();
    if (n >= 3 && roll < 0.45) {
      // Corner flip on a random internal residue.
      proposal = cornerFlip(coords, rng.int(1, n - 2));
    } else if (roll < 0.7) {
      // End move on a random terminus.
      proposal = endMove(coords, rng.next() < 0.5 ? 0 : n - 1, rng.int(0, 3));
    } else if (n >= 3) {
      // Pivot about a random interior residue with a random rotation.
      proposal = pivotMove(coords, rng.int(1, n - 2), rng.int(1, 3));
    }

    if (proposal && isSelfAvoiding(proposal)) {
      const propE = energy(proposal, residues);
      const dE = propE - curE;
      // Metropolis acceptance: always downhill; uphill with prob exp(-dE/T).
      if (dE <= 0 || rng.next() < Math.exp(-dE / T)) {
        coords = proposal;
        curE = propE;
        accepted++;
        if (curE < bestE) {
          bestE = curE;
          bestCoords = coords.slice() as Point[];
        }
      }
    }

    if (s % sampleEvery === 0) {
      traj.step.push(s);
      traj.current.push(curE);
      traj.best.push(bestE);
    }
    T *= coolRatio;
  }

  return {
    bestEnergy: bestE,
    hhContacts: -bestE,
    bestCoords,
    acceptanceRate: opts.steps > 0 ? accepted / opts.steps : 0,
    trajectory: traj,
  };
}

// ---------------------------------------------------------------------------
// Engine spec (registry / UI / agent tool surface).
// ---------------------------------------------------------------------------

export const paramsSchema = z.object({
  /** Residue sequence over the HP alphabet, e.g. "HHPPHH". */
  sequence: z
    .string()
    .regex(/^[HPhp]+$/, 'sequence must contain only H and P characters')
    .describe('Protein sequence over the {H, P} alphabet'),
  /** Number of Monte-Carlo steps (proposed moves). */
  steps: z.number().int().positive().max(5_000_000).default(30_000),
  /** Initial annealing temperature (energy units of one H–H contact). */
  temperature: z.number().positive().default(2.0),
  /** PRNG seed for reproducibility. */
  seed: z.union([z.number(), z.string()]).default(42),
});

export type HpFoldingParams = z.input<typeof paramsSchema>;

export interface HpFoldingDetail {
  sequence: string;
  /** Best conformation as lattice coordinates, one [x, y] per residue. */
  coordinates: Point[];
}

export const spec: EngineSpec<HpFoldingParams, HpFoldingDetail> = {
  slug: 'hp-folding',
  title: 'HP Lattice Protein Folding',
  domain: 'protein',
  version: '1.0.0',
  description:
    'Two-dimensional square-lattice HP (hydrophobic-polar) protein folding — the classic ' +
    'Dill model. A conformation is a self-avoiding walk; the energy is -1 per H–H topological ' +
    'contact (H residues that are lattice-adjacent but not sequence-adjacent). Seeded ' +
    'simulated-annealing Metropolis Monte Carlo (pivot + corner + end moves) searches for the ' +
    'minimum-energy native fold. Fully deterministic given the seed.',
  references: [
    'Dill KA. Biochemistry 24 (1985) 1501–1509.',
    'Lau KF, Dill KA. Macromolecules 22 (1989) 3986–3997.',
    'Unger R, Moult J. J. Mol. Biol. 231 (1993) 75–81.',
  ],
  paramsSchema,
  run(params: HpFoldingParams): SimResult<HpFoldingDetail> {
    const p = paramsSchema.parse(params);
    const result = foldHP({
      sequence: p.sequence,
      steps: p.steps,
      temperature: p.temperature,
      seed: p.seed,
    });

    const summary =
      `Native fold of ${p.sequence.toUpperCase()} reached ground-state energy ` +
      `E = ${result.bestEnergy} (${result.hhContacts} H–H contact` +
      `${result.hhContacts === 1 ? '' : 's'}) after ${p.steps} MC steps.`;

    return {
      engine: 'hp-folding',
      summary,
      metrics: [
        {
          key: 'bestEnergy',
          label: 'Best (ground-state) energy',
          value: result.bestEnergy,
          unit: 'contacts',
          note: 'Lowest energy found; -1 per H–H topological contact.',
        },
        {
          key: 'hhContacts',
          label: 'H–H contacts',
          value: result.hhContacts,
          note: 'Non-sequence-adjacent H–H lattice contacts in the best fold.',
        },
        {
          key: 'acceptanceRate',
          label: 'MC acceptance rate',
          value: result.acceptanceRate,
          note: 'Fraction of proposed Monte-Carlo moves accepted (annealed).',
        },
      ],
      series: [
        {
          x: result.trajectory.step,
          y: { current: result.trajectory.current, best: result.trajectory.best },
          xLabel: 'MC step',
          yLabel: 'Energy',
        },
      ],
      detail: {
        sequence: p.sequence.toUpperCase(),
        coordinates: result.bestCoords,
      },
      provenance: provenance('hp-folding', '1.0.0', { ...p }, p.seed),
    };
  },
  example: {
    sequence: 'HPHPPHHPHPPHPHHPPHPH',
    steps: 60_000,
    temperature: 2.0,
    seed: 42,
  },
  tags: ['protein', 'folding', 'lattice', 'monte-carlo', 'HP-model', 'Dill', 'self-avoiding-walk'],
};

export default spec;
