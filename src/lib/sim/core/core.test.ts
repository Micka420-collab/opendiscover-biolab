import { describe, expect, it } from 'vitest';
import { identity, matMul, matVec, solve, transpose } from './linalg';
import { component, euler, rk4, rk45 } from './ode';
import { createRng, hashSeed } from './prng';

describe('prng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng('abc');
    const b = createRng('abc');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    const a = createRng('abc');
    const b = createRng('abd');
    expect(a.next()).not.toBe(b.next());
  });

  it('produces uniforms in range', () => {
    const r = createRng(1);
    for (let i = 0; i < 1000; i++) {
      const u = r.next();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it('normal has ~0 mean and ~1 sd over many draws', () => {
    const r = createRng('normal');
    const n = 50000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const z = r.normal();
      sum += z;
      sumSq += z * z;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(variance - 1)).toBeLessThan(0.05);
  });

  it('poisson mean approximates lambda', () => {
    const r = createRng('pois');
    const n = 20000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += r.poisson(4);
    expect(Math.abs(sum / n - 4)).toBeLessThan(0.1);
  });

  it('hashSeed passes numbers through as uint32', () => {
    expect(hashSeed(42)).toBe(42);
  });
});

describe('ode integrators', () => {
  // dy/dt = -y, y(0)=1  => y(t)=e^-t
  const decay = (_t: number, y: number[]) => [-y[0]];

  it('rk4 matches analytic exponential decay', () => {
    const traj = rk4(decay, [1], 0, 5, 500);
    const yEnd = traj.y[traj.y.length - 1][0];
    expect(Math.abs(yEnd - Math.exp(-5))).toBeLessThan(1e-6);
  });

  it('rk45 matches analytic exponential decay', () => {
    const traj = rk45(decay, [1], 0, 5, { tol: 1e-8 });
    const yEnd = traj.y[traj.y.length - 1][0];
    expect(Math.abs(yEnd - Math.exp(-5))).toBeLessThan(1e-5);
  });

  it('euler is in the right ballpark', () => {
    const traj = euler(decay, [1], 0, 5, 5000);
    const yEnd = traj.y[traj.y.length - 1][0];
    expect(Math.abs(yEnd - Math.exp(-5))).toBeLessThan(1e-2);
  });

  it('solves the harmonic oscillator (energy roughly conserved)', () => {
    // y'' = -y  ->  [y, v]' = [v, -y]; energy = y^2 + v^2 should stay ~1.
    const sho = (_t: number, s: number[]) => [s[1], -s[0]];
    const traj = rk4(sho, [1, 0], 0, 2 * Math.PI, 2000);
    const last = traj.y[traj.y.length - 1];
    const energy = last[0] ** 2 + last[1] ** 2;
    expect(Math.abs(energy - 1)).toBeLessThan(1e-4);
    // After one full period we return near the start.
    expect(Math.abs(last[0] - 1)).toBeLessThan(1e-3);
    expect(component(traj, 0).length).toBe(traj.t.length);
  });
});

describe('linalg', () => {
  it('solves a 3x3 system', () => {
    const A = [
      [2, 1, -1],
      [-3, -1, 2],
      [-2, 1, 2],
    ];
    const b = [8, -11, -3];
    const x = solve(A, b);
    expect(x).not.toBeNull();
    // Known solution: x = [2, 3, -1]
    expect(x?.[0]).toBeCloseTo(2, 6);
    expect(x?.[1]).toBeCloseTo(3, 6);
    expect(x?.[2]).toBeCloseTo(-1, 6);
  });

  it('returns null for a singular matrix', () => {
    const A = [
      [1, 2],
      [2, 4],
    ];
    expect(solve(A, [1, 2])).toBeNull();
  });

  it('matVec and transpose agree', () => {
    const A = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    expect(matVec(A, [1, 0, 0])).toEqual([1, 4]);
    expect(transpose(A)).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it('matMul against identity is a no-op', () => {
    const A = [
      [1, 2],
      [3, 4],
    ];
    expect(matMul(A, identity(2))).toEqual(A);
  });
});
