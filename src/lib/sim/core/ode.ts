/**
 * Ordinary differential equation integrators.
 *
 * The systems-biology, enzyme-kinetics, bioprocess, and epidemiology engines all
 * reduce to "integrate dy/dt = f(t, y) from t0 to t1". We provide three schemes:
 *
 *   - `euler`  — first order, cheap, for quick sketches.
 *   - `rk4`    — fixed-step classic Runge–Kutta, the workhorse.
 *   - `rk45`   — adaptive Dormand–Prince (RKDP), for stiff-ish or long runs where
 *                a fixed step would be wasteful or inaccurate.
 *
 * `f` must be a pure function of (t, y). No engine should close over mutable
 * state inside it — that would break determinism and replay.
 */

export type Derivative = (t: number, y: number[]) => number[];

export interface OdeTrajectory {
  t: number[];
  /** y[i] is the state vector at time t[i]. */
  y: number[][];
}

function axpy(y: number[], k: number[], h: number): number[] {
  return y.map((v, i) => v + h * k[i]);
}

/** Fixed-step explicit Euler. */
export function euler(f: Derivative, y0: number[], t0: number, t1: number, steps: number): OdeTrajectory {
  const h = (t1 - t0) / steps;
  const t: number[] = [t0];
  const y: number[][] = [[...y0]];
  let cur = [...y0];
  let time = t0;
  for (let i = 0; i < steps; i++) {
    cur = axpy(cur, f(time, cur), h);
    time += h;
    t.push(time);
    y.push([...cur]);
  }
  return { t, y };
}

/** Fixed-step classic 4th-order Runge–Kutta. */
export function rk4(f: Derivative, y0: number[], t0: number, t1: number, steps: number): OdeTrajectory {
  const h = (t1 - t0) / steps;
  const t: number[] = [t0];
  const y: number[][] = [[...y0]];
  let cur = [...y0];
  let time = t0;
  for (let i = 0; i < steps; i++) {
    const k1 = f(time, cur);
    const k2 = f(time + h / 2, axpy(cur, k1, h / 2));
    const k3 = f(time + h / 2, axpy(cur, k2, h / 2));
    const k4 = f(time + h, axpy(cur, k3, h));
    cur = cur.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    time += h;
    t.push(time);
    y.push([...cur]);
  }
  return { t, y };
}

/**
 * Adaptive Dormand–Prince RK45. Samples the solution onto `outputPoints`
 * evenly-spaced times so downstream charting is uniform, while stepping
 * adaptively under the hood to hit `tol`.
 */
export function rk45(
  f: Derivative,
  y0: number[],
  t0: number,
  t1: number,
  opts: { tol?: number; outputPoints?: number; hInit?: number; maxSteps?: number } = {},
): OdeTrajectory {
  const tol = opts.tol ?? 1e-6;
  const outputPoints = opts.outputPoints ?? 200;
  const maxSteps = opts.maxSteps ?? 1_000_000;
  let h = opts.hInit ?? (t1 - t0) / 100;

  // Dormand–Prince Butcher tableau.
  const c = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
  const a: number[][] = [
    [],
    [1 / 5],
    [3 / 40, 9 / 40],
    [44 / 45, -56 / 15, 32 / 9],
    [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
    [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
  ];
  const b5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
  const b4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];

  const sampleTimes = Array.from({ length: outputPoints + 1 }, (_, i) => t0 + ((t1 - t0) * i) / outputPoints);
  const outT: number[] = [];
  const outY: number[][] = [];

  let time = t0;
  let cur = [...y0];
  let nextSample = 0;
  let steps = 0;

  const emitInterpolated = (tPrev: number, yPrev: number[], tNow: number, yNow: number[]) => {
    // Linear interpolation onto requested sample grid (adequate for plotting).
    while (nextSample < sampleTimes.length && sampleTimes[nextSample] <= tNow + 1e-12) {
      const ts = sampleTimes[nextSample];
      const frac = tNow === tPrev ? 0 : (ts - tPrev) / (tNow - tPrev);
      outT.push(ts);
      outY.push(yNow.map((v, i) => yPrev[i] + frac * (v - yPrev[i])));
      nextSample++;
    }
  };

  emitInterpolated(time, cur, time, cur); // capture t0

  while (time < t1 && steps < maxSteps) {
    if (time + h > t1) h = t1 - time;
    const k: number[][] = [];
    for (let i = 0; i < 7; i++) {
      let yi = [...cur];
      for (let j = 0; j < i; j++) yi = yi.map((v, idx) => v + h * a[i][j] * k[j][idx]);
      k[i] = f(time + c[i] * h, yi);
    }
    const y5 = cur.map((v, idx) => v + h * b5.reduce((s, bj, j) => s + bj * k[j][idx], 0));
    const y4 = cur.map((v, idx) => v + h * b4.reduce((s, bj, j) => s + bj * k[j][idx], 0));

    let err = 0;
    for (let i = 0; i < cur.length; i++) {
      const sc = tol + tol * Math.max(Math.abs(cur[i]), Math.abs(y5[i]));
      err += ((y5[i] - y4[i]) / sc) ** 2;
    }
    err = Math.sqrt(err / cur.length);

    if (err <= 1) {
      const tPrev = time;
      const yPrev = cur;
      time += h;
      cur = y5;
      emitInterpolated(tPrev, yPrev, time, cur);
    }
    // PI-ish step-size control with clamped growth.
    const factor = err === 0 ? 5 : 0.9 * err ** -0.2;
    h *= Math.min(5, Math.max(0.2, factor));
    steps++;
  }

  // Guarantee the final sample is present.
  if (outT.length === 0 || outT[outT.length - 1] < t1 - 1e-9) {
    outT.push(time);
    outY.push([...cur]);
  }
  return { t: outT, y: outY };
}

/** Extract a single state component across a trajectory. */
export function component(traj: OdeTrajectory, index: number): number[] {
  return traj.y.map((row) => row[index]);
}
