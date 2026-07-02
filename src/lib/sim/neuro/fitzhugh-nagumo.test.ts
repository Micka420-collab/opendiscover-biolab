import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { fixedPoint, run } from './fitzhugh-nagumo';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('fitzhugh-nagumo', () => {
  it('finds a fixed point that lies on both nullclines', () => {
    const fp = fixedPoint(0.7, 0.8, 0.5);
    expect(Math.abs(fp.residual)).toBeLessThan(1e-8); // v-nullcline satisfied
    expect(fp.w).toBeCloseTo((fp.v + 0.7) / 0.8, 10); // w-nullcline satisfied
  });

  it('is quiescent (excitable rest) below the oscillatory range', () => {
    const r = run({ current: 0 });
    expect(metric(r, 'oscillationAmplitude')).toBeLessThan(0.2);
    expect(metric(r, 'spiking')).toBe(0);
    expect(metric(r, 'firingRate')).toBe(0);
  });

  it('fires a repetitive spike train inside the oscillatory range', () => {
    const r = run({ current: 0.5 });
    expect(metric(r, 'oscillationAmplitude')).toBeGreaterThan(1.5);
    expect(metric(r, 'spiking')).toBe(1);
    expect(metric(r, 'firingRate')).toBeGreaterThan(0);
  });

  it('spike amplitude is far larger when firing than at rest', () => {
    const rest = run({ current: 0 });
    const firing = run({ current: 0.5 });
    expect(metric(firing, 'oscillationAmplitude')).toBeGreaterThan(
      metric(rest, 'oscillationAmplitude') + 1,
    );
  });

  it('emits finite series (time course + phase portrait)', () => {
    const r = run({ current: 0.5 });
    expect((r.series ?? []).length).toBe(2);
    for (const s of r.series ?? []) {
      for (const key of Object.keys(s.y)) {
        for (const val of s.y[key]) expect(Number.isFinite(val)).toBe(true);
      }
    }
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('fitzhugh-nagumo', { current: 0.6 });
    const b = runEngine('fitzhugh-nagumo', { current: 0.6 });
    expect(a).toEqual(b);
  });
});
