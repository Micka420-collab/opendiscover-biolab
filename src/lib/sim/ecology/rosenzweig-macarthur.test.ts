import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { interiorEquilibrium, paramsSchema, run } from './rosenzweig-macarthur';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

const base = { r: 1, a: 1, h: 0.5, e: 0.5, m: 0.2 };

describe('rosenzweig-macarthur', () => {
  it('places the interior equilibrium at N* = m/(a(e−mh))', () => {
    const p = paramsSchema.parse({ ...base, k: 6 });
    const eq = interiorEquilibrium(p);
    // N* = 0.2 / (1·(0.5 − 0.2·0.5)) = 0.2/0.4 = 0.5
    expect(eq?.n).toBeCloseTo(0.5, 10);
    // P* = e·r·N*·(1 − N*/K) / m = 0.5·1·0.5·(1 − 0.5/6)/0.2
    expect(eq?.p).toBeCloseTo((0.5 * 1 * 0.5 * (1 - 0.5 / 6)) / 0.2, 10);
  });

  it('computes the enrichment (Hopf) threshold K_H = 2N* + 1/(ah)', () => {
    const r = run({ ...base, k: 6 });
    // 2·0.5 + 1/(1·0.5) = 1 + 2 = 3
    expect(metric(r, 'enrichmentThreshold')).toBeCloseTo(3, 10);
  });

  it('is classified stable below the threshold (K < K_H)', () => {
    const r = run({ ...base, k: 2 }); // K_H = 3
    expect(metric(r, 'limitCycle')).toBe(0);
  });

  it('breaks into a limit cycle above the threshold — the paradox of enrichment', () => {
    const r = run({ ...base, k: 6 });
    expect(metric(r, 'oscillationAmplitude')).toBeGreaterThan(0.1);
    expect(metric(r, 'limitCycle')).toBe(1);
  });

  it('enrichment amplifies oscillation (higher K ⇒ larger amplitude)', () => {
    const calm = run({ ...base, k: 2 });
    const wild = run({ ...base, k: 6 });
    expect(metric(wild, 'oscillationAmplitude')).toBeGreaterThan(
      metric(calm, 'oscillationAmplitude'),
    );
  });

  it('stays finite even for an extremely enriched system (K=200)', () => {
    const r = run({ k: 200 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const s of r.series ?? []) {
      for (const key of Object.keys(s.y)) {
        for (const v of s.y[key]) expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('reports predator extinction when e ≤ m·h (no interior equilibrium)', () => {
    const p = paramsSchema.parse({ ...base, e: 0.1, m: 0.2, h: 1, k: 6 });
    expect(interiorEquilibrium(p)).toBeNull();
    expect(Number.isNaN(metric(run(p), 'preyEquilibrium'))).toBe(true);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('rosenzweig-macarthur', { ...base, k: 5 });
    const b = runEngine('rosenzweig-macarthur', { ...base, k: 5 });
    expect(a).toEqual(b);
  });
});
