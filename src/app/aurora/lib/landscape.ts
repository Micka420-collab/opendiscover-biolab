/**
 * The fitness landscape behind every AURORA round.
 *
 * Given a pool {@link Challenge} and an injected engine runner, we sample the knob
 * range into a curve of {knob, value, signal, met, perfect} points — the glowing
 * "SignalScope" the player reads. The live gauge and probe interpolate from these
 * REAL samples (no per-frame engine call), so heavy ODE engines never jank; only a
 * LOCK re-runs the engine authoritatively and judges with the pool's own `meetsBar`.
 *
 * The win bar is ALWAYS `meetsBar` from the challenge pool — this module never
 * invents its own pass condition, so what lights up on screen is exactly the pool's
 * bar. Pure and deterministic (runner is injected); safe in Node and the browser.
 */

import {
  type Challenge,
  TARGET_TOLERANCE,
  challengeParams,
  challengeScore,
  meetsBar,
} from '@/lib/lab/daily-challenge';
import type { SimResult } from '@/lib/sim';
import { clamp01 } from './palette';

export type Runner = (engine: string, params: Record<string, unknown>) => SimResult;

export interface Sample {
  knob: number;
  value: number;
  /** 0..1 proximity to the answer, for colour + gauge fill. */
  signal: number;
  met: boolean;
  perfect: boolean;
}

export interface Band {
  lo: number;
  hi: number;
}

export interface Marker {
  type: 'target' | 'peak';
  knob: number;
  value: number;
}

export interface Landscape {
  challenge: Challenge;
  samples: Sample[];
  passBands: Band[];
  perfectBands: Band[];
  marker: Marker | null;
  yDomain: [number, number];
  knobDomain: [number, number];
  /** Raw finite [min, max] of the sampled metric values (unpadded) — for authoritative signal. */
  valueRange: [number, number];
}

/** Read the scored metric for one knob value; NaN if the engine can't produce it. */
export function readMetric(runner: Runner, c: Challenge, knob: number): number {
  try {
    const r = runner(c.engine, challengeParams(c, knob));
    const m = r.metrics.find((mm) => mm.key === c.metricKey);
    return typeof m?.value === 'number' && Number.isFinite(m.value) ? m.value : Number.NaN;
  } catch {
    // A knob value the engine's schema rejects (e.g. an integer-only param) → no sample.
    return Number.NaN;
  }
}

/**
 * Snap a raw knob to the challenge's own step grid, so integer-only params
 * (e.g. reed-frost's `initialImmune`) receive valid values and drawn samples sit on
 * the same lattice the pool's winnability is proven against.
 */
export function snapKnob(c: Challenge, raw: number): number {
  const { min, max, step } = c.knob;
  const clamp = (x: number) => Math.min(max, Math.max(min, x));
  if (!(step > 0)) return clamp(raw);
  const snapped = min + Math.round((raw - min) / step) * step;
  return Number(clamp(snapped).toFixed(6));
}

/**
 * A goal-agnostic 0..1 "how close" signal for the gauge/colour. For `target`,
 * proximity decays with relative distance; for `maximize`/`minimize` it is the value's
 * position within the sampled range. Always finite and clamped.
 */
export function signalFor(c: Challenge, value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value)) return 0;
  if (c.goal === 'target') {
    const t = c.target ?? 0;
    const denom = Math.abs(t) > 1e-9 ? Math.abs(t) : 1;
    const d = Math.abs(value - t) / denom;
    return clamp01(1 - d / 0.5);
  }
  const span = hi - lo || 1;
  if (c.goal === 'maximize') return clamp01((value - lo) / span);
  return clamp01((hi - value) / span);
}

function isPerfect(c: Challenge, value: number, signal: number, met: boolean): boolean {
  if (!met) return false;
  if (c.goal === 'target') {
    const t = c.target ?? 0;
    const denom = Math.abs(t) > 1e-9 ? Math.abs(t) : 1;
    return Math.abs(value - t) / denom <= TARGET_TOLERANCE / 2;
  }
  return signal >= 0.92;
}

function bandsFrom(samples: Sample[], pick: (s: Sample) => boolean): Band[] {
  const bands: Band[] = [];
  let start: number | null = null;
  for (let i = 0; i < samples.length; i++) {
    const on = pick(samples[i]);
    if (on && start === null) start = samples[i].knob;
    if (start !== null && (!on || i === samples.length - 1)) {
      const end = on ? samples[i].knob : samples[i - 1].knob;
      bands.push({ lo: start, hi: end });
      start = null;
    }
  }
  return bands;
}

function findMarker(c: Challenge, samples: Sample[]): Marker | null {
  if (c.goal === 'target') {
    const t = c.target ?? 0;
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      if (!Number.isFinite(a.value) || !Number.isFinite(b.value)) continue;
      if (a.value === t) return { type: 'target', knob: a.knob, value: t };
      if ((a.value - t) * (b.value - t) < 0) {
        const frac = (t - a.value) / (b.value - a.value || 1);
        return { type: 'target', knob: a.knob + (b.knob - a.knob) * frac, value: t };
      }
    }
    let best: Sample | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const s of samples) {
      if (!Number.isFinite(s.value)) continue;
      const d = Math.abs(s.value - t);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best ? { type: 'target', knob: best.knob, value: t } : null;
  }
  let best: Sample | null = null;
  let bestV = c.goal === 'maximize' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  for (const s of samples) {
    if (!Number.isFinite(s.value)) continue;
    if (c.goal === 'maximize' ? s.value > bestV : s.value < bestV) {
      bestV = s.value;
      best = s;
    }
  }
  return best ? { type: 'peak', knob: best.knob, value: best.value } : null;
}

/** Sample a challenge's knob range into a drawable, judged landscape. */
export function sampleLandscape(c: Challenge, runner: Runner, n = 72): Landscape {
  const { min, max } = c.knob;
  const knobs: number[] = [];
  const rawValues: number[] = [];
  for (let i = 0; i < n; i++) {
    const knob = snapKnob(c, min + ((max - min) * i) / (n - 1));
    knobs.push(knob);
    rawValues.push(readMetric(runner, c, knob));
  }

  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const v of rawValues) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0;
    hi = 1;
  }

  const samples: Sample[] = knobs.map((knob, i) => {
    const value = rawValues[i];
    const signal = signalFor(c, value, lo, hi);
    const met = Number.isFinite(value) ? meetsBar(c, value) : false;
    return { knob, value, signal, met, perfect: isPerfect(c, value, signal, met) };
  });

  // y-domain: pad the value range and always include the target line if there is one.
  let yLo = lo;
  let yHi = hi;
  if (c.goal === 'target') {
    const t = c.target ?? 0;
    yLo = Math.min(yLo, t);
    yHi = Math.max(yHi, t);
  }
  if (yHi - yLo < 1e-12) yHi = yLo + 1;
  const pad = (yHi - yLo) * 0.08;

  return {
    challenge: c,
    samples,
    passBands: bandsFrom(samples, (s) => s.met),
    perfectBands: bandsFrom(samples, (s) => s.perfect),
    marker: findMarker(c, samples),
    yDomain: [yLo - pad, yHi + pad],
    knobDomain: [min, max],
    valueRange: [lo, hi],
  };
}

/** Honest linear interpolation of the metric value between real samples. */
export function valueAtKnob(land: Landscape, knob: number): number {
  const s = land.samples;
  if (s.length === 0) return Number.NaN;
  if (knob <= s[0].knob) return s[0].value;
  if (knob >= s[s.length - 1].knob) return s[s.length - 1].value;
  for (let i = 1; i < s.length; i++) {
    if (knob <= s[i].knob) {
      const a = s[i - 1];
      const b = s[i];
      if (!Number.isFinite(a.value)) return b.value;
      if (!Number.isFinite(b.value)) return a.value;
      const t = (knob - a.knob) / (b.knob - a.knob || 1);
      return a.value + (b.value - a.value) * t;
    }
  }
  return s[s.length - 1].value;
}

/** Honest linear interpolation of the 0..1 signal between real samples (for the live gauge). */
export function signalAtKnob(land: Landscape, knob: number): number {
  const s = land.samples;
  if (s.length === 0) return 0;
  if (knob <= s[0].knob) return s[0].signal;
  if (knob >= s[s.length - 1].knob) return s[s.length - 1].signal;
  for (let i = 1; i < s.length; i++) {
    if (knob <= s[i].knob) {
      const a = s[i - 1];
      const b = s[i];
      const t = (knob - a.knob) / (b.knob - a.knob || 1);
      return a.signal + (b.signal - a.signal) * t;
    }
  }
  return s[s.length - 1].signal;
}

export interface Solution {
  knob: number;
  value: number;
  met: boolean;
}

/**
 * Deterministic ghost solver: scans the knob range at the challenge's own step
 * (identical to the pool's winnability proof) and returns the best-scoring knob.
 * Guarantees a `met` result for every pooled challenge. Powers Watch mode and the
 * dial's optimum hint.
 */
export function autoTune(c: Challenge, runner: Runner): Solution {
  const { min, max, step } = c.knob;
  let bestKnob = c.knob.default;
  let bestValue = Number.NaN;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestMet = false;
  for (let v = min; v <= max + 1e-9; v += step) {
    const knob = Number(v.toFixed(6));
    const value = readMetric(runner, c, knob);
    if (!Number.isFinite(value)) continue;
    const score = challengeScore(c, value);
    if (score > bestScore) {
      bestScore = score;
      bestKnob = knob;
      bestValue = value;
      bestMet = meetsBar(c, value);
    }
  }
  return { knob: bestKnob, value: bestValue, met: bestMet };
}
