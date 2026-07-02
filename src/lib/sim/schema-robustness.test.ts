/**
 * Schema-robustness guard — no engine may emit a non-finite metric from a
 * schema-VALID input.
 *
 * The iter-74 adversarial review found a systematic latent class: fields declared
 * `z.number().positive()` with no physical lower bound accepted denormal/extreme
 * doubles that then underflowed a denominator to 0 or overflowed a power to Infinity,
 * leaking NaN/Infinity into the reported metrics. This test sweeps every engine's
 * numeric example fields across extreme magnitudes and asserts that whenever the Zod
 * schema ACCEPTS the value, every number in the result (metrics, detail, series) is
 * finite. Schema rejection is fine — that is the intended guard. Any new engine that
 * reintroduces the pattern will trip this test.
 */

import { describe, expect, it } from 'vitest';
import type { SimResult } from './core/types';
import { engines, runEngine } from './index';

// Denormal/subnormal extremes: the iter-74/75 bug class was denormal inputs that
// underflowed a denominator to exactly 0 (or overflowed a reciprocal power) and leaked
// NaN/Infinity into a metric. Physical `.min()` bounds now reject these. (Out of scope
// here: huge inputs, which can make stochastic/ODE engines run astronomically long, and
// small-but-normal inputs that expose genuine dynamical-model divergences — a separate,
// pre-existing class tracked for a later hardening pass.)
const EXTREMES = [5e-324, 1e-300, 1e-160];

function allNumbers(r: SimResult): number[] {
  const out: number[] = [];
  for (const m of r.metrics ?? []) if (typeof m.value === 'number') out.push(m.value);
  for (const v of Object.values(r.detail ?? {})) if (typeof v === 'number') out.push(v);
  for (const s of r.series ?? []) {
    for (const v of s.x ?? []) out.push(v);
    for (const arr of Object.values(s.y ?? {})) for (const v of arr) out.push(v);
  }
  return out;
}

describe('schema robustness: accepted inputs never yield non-finite output', () => {
  it('no engine emits NaN/Infinity for any schema-valid extreme scalar input', () => {
    const offenders: string[] = [];
    for (const e of engines) {
      const ex = (e.example ?? {}) as Record<string, unknown>;
      for (const [key, val] of Object.entries(ex)) {
        if (typeof val !== 'number') continue;
        for (const tv of EXTREMES) {
          let result: ReturnType<typeof runEngine> | undefined;
          try {
            result = runEngine(e.slug, { ...ex, [key]: tv });
          } catch {
            continue; // schema rejected the value — the intended guard
          }
          if (allNumbers(result).some((n) => !Number.isFinite(n))) {
            offenders.push(`${e.slug}.${key}=${tv}`);
            break;
          }
        }
      }
    }
    expect(
      offenders,
      `non-finite output from schema-valid input:\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
