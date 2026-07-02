/**
 * Trajectory downsampling for plotted series.
 *
 * A solver produces `len` points; a chart wants at most `n` of them. Return the
 * indices to keep, spread evenly across the run and ALWAYS including the first and
 * last point so the plotted series spans the whole trajectory.
 *
 * The `n === 1` case is deliberate: a single summary point is the FINAL state (the
 * most informative one-point description of a run), never the initial condition —
 * emitting index 0 there would show a stale `p0`/`x0` that contradicts the engine's
 * "final value" metric.
 */
export function downsampleIndices(len: number, n: number): number[] {
  if (len <= 0) return [];
  if (n <= 1) return [len - 1]; // one point → the final state, not the initial one
  if (len <= n) return Array.from({ length: len }, (_, i) => i);
  const denom = n - 1; // n >= 2 here, so never divides by zero
  return Array.from({ length: n }, (_, i) => Math.round((i * (len - 1)) / denom));
}
