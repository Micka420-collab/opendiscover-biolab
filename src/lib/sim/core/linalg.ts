/**
 * Minimal dependency-free linear algebra.
 *
 * Enough to support flux-balance analysis (linear programming), distance-based
 * phylogenetics (matrix reductions), and multi-species ODE systems. Kept small
 * and readable rather than pulling a heavyweight numeric package into the edge
 * bundle. All routines are pure.
 */

export type Vector = number[];
export type Matrix = number[][];

export function zeros(n: number): Vector {
  return new Array(n).fill(0);
}

export function zerosMatrix(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

export function identity(n: number): Matrix {
  const m = zerosMatrix(n, n);
  for (let i = 0; i < n; i++) m[i][i] = 1;
  return m;
}

export function dot(a: Vector, b: Vector): number {
  if (a.length !== b.length) throw new Error('dot: length mismatch');
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function norm(a: Vector): number {
  return Math.sqrt(dot(a, a));
}

export function add(a: Vector, b: Vector): Vector {
  return a.map((v, i) => v + b[i]);
}

export function sub(a: Vector, b: Vector): Vector {
  return a.map((v, i) => v - b[i]);
}

export function scale(a: Vector, k: number): Vector {
  return a.map((v) => v * k);
}

export function transpose(m: Matrix): Matrix {
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  const t = zerosMatrix(cols, rows);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) t[j][i] = m[i][j];
  return t;
}

export function matVec(m: Matrix, v: Vector): Vector {
  return m.map((row) => dot(row, v));
}

export function matMul(a: Matrix, b: Matrix): Matrix {
  const n = a.length;
  const m = b[0].length;
  const k = b.length;
  const out = zerosMatrix(n, m);
  for (let i = 0; i < n; i++) {
    for (let p = 0; p < k; p++) {
      const aip = a[i][p];
      if (aip === 0) continue;
      for (let j = 0; j < m; j++) out[i][j] += aip * b[p][j];
    }
  }
  return out;
}

/**
 * Solve the dense linear system A x = b via Gaussian elimination with partial
 * pivoting. Returns null if A is singular. A is copied, not mutated.
 */
export function solve(A: Matrix, b: Vector): Vector | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const pv = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      if (factor === 0) continue;
      for (let j = col; j <= n; j++) M[r][j] -= factor * M[col][j];
    }
  }
  return M.map((row) => row[n]);
}

export function cloneMatrix(m: Matrix): Matrix {
  return m.map((row) => [...row]);
}
