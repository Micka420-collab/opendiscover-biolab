import { describe, expect, it } from 'vitest';
import {
  combine,
  distance,
  lennardJones,
  poseEnergy,
  rotateVec,
  spec,
  transformLigand,
  vecCross,
  vecDot,
  vecNorm,
} from './docking';

describe('Lennard-Jones potential — exact analytic properties', () => {
  it('V(σ) = 0 exactly, for any ε', () => {
    expect(lennardJones(1.7, 1.7, 0.1)).toBeCloseTo(0, 12);
    expect(lennardJones(3.3, 3.3, 5)).toBeCloseTo(0, 12);
  });

  it('the minimum is exactly at r = 2^(1/6)·σ, with V = −ε', () => {
    // Derived by solving dV/dr = 0 for V(r) = 4ε[(σ/r)^12 - (σ/r)^6]:
    // 12σ^12/r^13 = 6σ^6/r^7  =>  r^6 = 2σ^6  =>  r = 2^(1/6) σ.
    // At that r, (σ/r)^6 = 1/2, so V = 4ε(1/4 - 1/2) = -ε exactly.
    for (const [sigma, eps] of [
      [1.7, 0.1],
      [1.0, 1.0],
      [2.5, 0.3],
    ]) {
      const rMin = sigma * 2 ** (1 / 6);
      expect(lennardJones(rMin, sigma, eps)).toBeCloseTo(-eps, 10);
    }
  });

  it('is repulsive (positive, large) well inside σ, and decays toward 0 far outside', () => {
    expect(lennardJones(0.5, 1.7, 0.1)).toBeGreaterThan(100);
    expect(Math.abs(lennardJones(50, 1.7, 0.1))).toBeLessThan(1e-6);
  });

  it('r <= 0 is treated as infinite (undefined/coincident atoms)', () => {
    expect(lennardJones(0, 1, 1)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('Lorentz-Berthelot combining rules — by definition', () => {
  it('σ combines by arithmetic mean, ε by geometric mean', () => {
    const a = { sigma: 1.0, epsilon: 4.0 };
    const b = { sigma: 3.0, epsilon: 9.0 };
    const c = combine(a, b);
    expect(c.sigma).toBeCloseTo(2.0, 12); // (1+3)/2
    expect(c.epsilon).toBeCloseTo(6.0, 12); // sqrt(4*9)
  });
});

describe('vector geometry', () => {
  it('cross product is orthogonal to both inputs (dot = 0)', () => {
    const a: [number, number, number] = [1, 2, 3];
    const b: [number, number, number] = [4, -1, 2];
    const c = vecCross(a, b);
    expect(vecDot(c, a)).toBeCloseTo(0, 10);
    expect(vecDot(c, b)).toBeCloseTo(0, 10);
  });

  it('distance is symmetric and zero for a point with itself', () => {
    const p: [number, number, number] = [1, 2, 3];
    const q: [number, number, number] = [4, 6, 3];
    expect(distance(p, q)).toBeCloseTo(distance(q, p), 12);
    expect(distance(p, p)).toBeCloseTo(0, 12);
    // 3-4-5-ish right triangle in the xy-plane (dz=0): sqrt(3^2+4^2)=5
    expect(distance([0, 0, 0], [3, 4, 0])).toBeCloseTo(5, 12);
  });
});

describe('Rodrigues rotation — an orthogonal transform', () => {
  it('rotating (1,0,0) by 90° about z gives (0,1,0) (right-hand rule)', () => {
    const r = rotateVec([1, 0, 0], [0, 0, 1], Math.PI / 2);
    expect(r[0]).toBeCloseTo(0, 10);
    expect(r[1]).toBeCloseTo(1, 10);
    expect(r[2]).toBeCloseTo(0, 10);
  });

  it('rotating (1,0,0) by 180° about z gives (-1,0,0)', () => {
    const r = rotateVec([1, 0, 0], [0, 0, 1], Math.PI);
    expect(r[0]).toBeCloseTo(-1, 9);
    expect(r[1]).toBeCloseTo(0, 9);
  });

  it('preserves vector norm for arbitrary axes/angles/vectors (orthogonality)', () => {
    const cases: Array<[[number, number, number], [number, number, number], number]> = [
      [[1, 2, 3], [0, 0, 1], 0.7],
      [[-2, 5, 0.5], [1, 1, 1], 2.1],
      [[0.1, 0.2, 0.3], [1, 0, 0], Math.PI / 3],
    ];
    for (const [v, axis, angle] of cases) {
      const rotated = rotateVec(v, axis, angle);
      expect(vecNorm(rotated)).toBeCloseTo(vecNorm(v), 9);
    }
  });

  it('a full 360° rotation returns the original vector', () => {
    const v: [number, number, number] = [1.3, -2.2, 0.7];
    const r = rotateVec(v, [0.3, 0.5, 0.8], 2 * Math.PI);
    expect(r[0]).toBeCloseTo(v[0], 8);
    expect(r[1]).toBeCloseTo(v[1], 8);
    expect(r[2]).toBeCloseTo(v[2], 8);
  });
});

describe('transformLigand — rigid-body invariants', () => {
  it('preserves inter-atom distances within the ligand (it is a rigid body)', () => {
    const ligand = [
      { position: [0, 0, 0] as [number, number, number], sigma: 1.5, epsilon: 0.1 },
      { position: [2, 1, 0] as [number, number, number], sigma: 1.5, epsilon: 0.1 },
      { position: [0, 3, -1] as [number, number, number], sigma: 1.5, epsilon: 0.1 },
    ];
    const before = distance(ligand[0].position, ligand[2].position);
    const moved = transformLigand(ligand, [5, -3, 2], [1, 1, 0], 1.234);
    const after = distance(moved[0].position, moved[2].position);
    expect(after).toBeCloseTo(before, 9);
  });

  it('zero rotation + zero translation is the identity', () => {
    const ligand = [{ position: [1, 2, 3] as [number, number, number], sigma: 1, epsilon: 1 }];
    const moved = transformLigand(ligand, [0, 0, 0], [0, 0, 1], 0);
    expect(moved[0].position[0]).toBeCloseTo(1, 10);
    expect(moved[0].position[1]).toBeCloseTo(2, 10);
    expect(moved[0].position[2]).toBeCloseTo(3, 10);
  });
});

describe('poseEnergy — sum of pairwise LJ terms', () => {
  it('matches a direct hand computation for one receptor atom vs one ligand atom', () => {
    const receptor = [
      { position: [0, 0, 0] as [number, number, number], sigma: 1.7, epsilon: 0.1 },
    ];
    const ligand = [{ position: [2, 0, 0] as [number, number, number], sigma: 1.7, epsilon: 0.15 }];
    const c = combine(receptor[0], ligand[0]);
    const expected = lennardJones(2, c.sigma, c.epsilon);
    expect(poseEnergy(receptor, ligand)).toBeCloseTo(expected, 12);
  });

  it('sums independently over multiple receptor/ligand atom pairs', () => {
    const receptor = [
      { position: [0, 0, 0] as [number, number, number], sigma: 1.7, epsilon: 0.1 },
      { position: [10, 0, 0] as [number, number, number], sigma: 1.7, epsilon: 0.1 },
    ];
    const ligand = [{ position: [2, 0, 0] as [number, number, number], sigma: 1.7, epsilon: 0.15 }];
    const c = combine(receptor[0], ligand[0]);
    const e1 = lennardJones(distance(receptor[0].position, ligand[0].position), c.sigma, c.epsilon);
    const e2 = lennardJones(distance(receptor[1].position, ligand[0].position), c.sigma, c.epsilon);
    expect(poseEnergy(receptor, ligand)).toBeCloseTo(e1 + e2, 10);
  });
});

describe('docking engine — physically meaningful pose ranking', () => {
  it('ranks a clash-free, near-optimal-distance pose ahead of a clashing one and a far one', () => {
    const r = spec.run(spec.example);
    const ranked = r.detail?.ranked ?? [];
    expect(ranked.length).toBe(4);

    // Poses sorted best (lowest energy) first.
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].energy).toBeGreaterThanOrEqual(ranked[i - 1].energy);
    }

    const best = r.detail?.best;
    // The winning pose must have a negative (favorable) energy, not a clash.
    expect(best?.energy).toBeLessThan(0);
    // The severely clashing pose (translation [0.5,0.5,0], very close to all
    // three receptor atoms) must score far worse (much more positive) than the winner.
    const worst = ranked[ranked.length - 1];
    expect(worst.energy).toBeGreaterThan(best!.energy + 100);
  });

  it('is deterministic', () => {
    expect(spec.run(spec.example)).toEqual(spec.run(spec.example));
  });
});
