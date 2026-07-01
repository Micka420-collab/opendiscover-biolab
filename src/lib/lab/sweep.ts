/**
 * Parameter sweeps & lightweight optimization.
 *
 * The scientist agent rarely runs one experiment — it explores a parameter space
 * looking for interesting regimes (a bifurcation, a maximum yield, a phase
 * transition). These helpers turn "explore this engine over this space" into a
 * ranked set of experiment records, deterministically.
 */

import { createRng } from '../sim/core/prng';
import { type ExperimentRecord, metricValue, runExperiment } from './runner';

/** A dimension of the space to sweep: either an explicit list or a numeric range. */
export type ParamAxis =
  | { key: string; values: (number | string | boolean)[] }
  | { key: string; min: number; max: number; steps: number; scale?: 'linear' | 'log' };

function axisValues(axis: ParamAxis): (number | string | boolean)[] {
  if ('values' in axis) return axis.values;
  const out: number[] = [];
  for (let i = 0; i < axis.steps; i++) {
    const f = axis.steps === 1 ? 0 : i / (axis.steps - 1);
    if (axis.scale === 'log') {
      const lo = Math.log(axis.min);
      const hi = Math.log(axis.max);
      out.push(Math.exp(lo + f * (hi - lo)));
    } else {
      out.push(axis.min + f * (axis.max - axis.min));
    }
  }
  return out;
}

function cartesian(axes: ParamAxis[]): Record<string, unknown>[] {
  let combos: Record<string, unknown>[] = [{}];
  for (const axis of axes) {
    const vals = axisValues(axis);
    const next: Record<string, unknown>[] = [];
    for (const base of combos) {
      for (const v of vals) next.push({ ...base, [axis.key]: v });
    }
    combos = next;
  }
  return combos;
}

export interface SweepResult {
  scoreKey: string;
  ranked: { params: Record<string, unknown>; score: number; record: ExperimentRecord }[];
  best: { params: Record<string, unknown>; score: number; record: ExperimentRecord } | null;
  evaluated: number;
}

/**
 * Full grid sweep. `base` holds the fixed params; `axes` are swept. Each combo is
 * run and scored by the named metric (maximized by default).
 */
export async function gridSweep(
  slug: string,
  base: Record<string, unknown>,
  axes: ParamAxis[],
  opts: { scoreMetric: string; maximize?: boolean; maxRuns?: number } = { scoreMetric: '' },
): Promise<SweepResult> {
  const combos = cartesian(axes);
  const capped = opts.maxRuns ? combos.slice(0, opts.maxRuns) : combos;
  const maximize = opts.maximize ?? true;
  const scored: SweepResult['ranked'] = [];

  for (const combo of capped) {
    const params = { ...base, ...combo };
    try {
      const record = await runExperiment(slug, params);
      const raw = metricValue(record.result, opts.scoreMetric) ?? Number.NaN;
      const score = maximize ? raw : -raw;
      if (!Number.isNaN(raw)) scored.push({ params, score, record });
    } catch {
      // Skip infeasible parameter combinations.
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return {
    scoreKey: opts.scoreMetric,
    ranked: scored,
    best: scored[0] ?? null,
    evaluated: scored.length,
  };
}

/**
 * Random search — seeded, for higher-dimensional spaces where a full grid is too
 * expensive. Draws `samples` points uniformly from each numeric range.
 */
export async function randomSearch(
  slug: string,
  base: Record<string, unknown>,
  ranges: { key: string; min: number; max: number; scale?: 'linear' | 'log' }[],
  opts: { scoreMetric: string; samples: number; maximize?: boolean; seed?: string | number },
): Promise<SweepResult> {
  const rng = createRng(opts.seed ?? 'sweep');
  const maximize = opts.maximize ?? true;
  const scored: SweepResult['ranked'] = [];

  for (let i = 0; i < opts.samples; i++) {
    const combo: Record<string, number> = {};
    for (const r of ranges) {
      if (r.scale === 'log') {
        combo[r.key] = Math.exp(rng.uniform(Math.log(r.min), Math.log(r.max)));
      } else {
        combo[r.key] = rng.uniform(r.min, r.max);
      }
    }
    const params = { ...base, ...combo };
    try {
      const record = await runExperiment(slug, params);
      const raw = metricValue(record.result, opts.scoreMetric) ?? Number.NaN;
      const score = maximize ? raw : -raw;
      if (!Number.isNaN(raw)) scored.push({ params, score, record });
    } catch {
      /* skip infeasible */
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return {
    scoreKey: opts.scoreMetric,
    ranked: scored,
    best: scored[0] ?? null,
    evaluated: scored.length,
  };
}
