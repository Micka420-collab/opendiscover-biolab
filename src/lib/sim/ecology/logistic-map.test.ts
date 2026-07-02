import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { attractorPeriod, lyapunovExponent, run } from './logistic-map';

const LN2 = Math.log(2);

describe('logistic-map', () => {
  it('has Lyapunov exponent exactly ln 2 at r = 4 (tent-map conjugacy)', () => {
    const lyap = lyapunovExponent(4, 0.4, 1000, 20_000);
    expect(lyap).toBeCloseTo(LN2, 2); // 0.693, within ~0.005
  });

  it('is non-chaotic (λ < 0) with a stable fixed point at r = 2.5', () => {
    const r = run({ r: 2.5 });
    const lyap = r.metrics.find((m) => m.key === 'lyapunovExponent')?.value ?? 0;
    const fixed = r.metrics.find((m) => m.key === 'fixedPoint')?.value ?? 0;
    const period = r.metrics.find((m) => m.key === 'attractorPeriod')?.value;
    expect(lyap).toBeLessThan(0);
    expect(fixed).toBeCloseTo(1 - 1 / 2.5, 10); // 0.6
    expect(period).toBe(1);
  });

  it('orbit converges to the fixed point at r = 2.5', () => {
    const r = run({ r: 2.5, x0: 0.2, iterations: 200 });
    const orbit = (r.series ?? [])[0]?.y.x ?? [];
    expect(orbit[orbit.length - 1]).toBeCloseTo(0.6, 4);
  });

  it('period-doubles: period-2 at r = 3.2, period-4 at r = 3.5', () => {
    expect(attractorPeriod(3.2, 0.4, 2000)).toBe(2);
    expect(attractorPeriod(3.5, 0.4, 2000)).toBe(4);
  });

  it('flags chaos with a positive Lyapunov exponent at r = 3.9', () => {
    const r = run({ r: 3.9 });
    const lyap = r.metrics.find((m) => m.key === 'lyapunovExponent')?.value ?? -1;
    const chaotic = r.metrics.find((m) => m.key === 'chaotic')?.value;
    const period = r.metrics.find((m) => m.key === 'attractorPeriod')?.value;
    expect(lyap).toBeGreaterThan(0);
    expect(chaotic).toBe(1);
    expect(period).toBe(0); // aperiodic
  });

  it('returns a bifurcation vizSpec with sampled attractor points', () => {
    const r = run({ rSteps: 50, bifSamples: 20 });
    const viz = r.vizSpec as { data: { values: unknown[] } } | undefined;
    expect(viz?.data.values.length).toBe(50 * 20);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('logistic-map', { r: 3.83, x0: 0.31 });
    const b = runEngine('logistic-map', { r: 3.83, x0: 0.31 });
    expect(a).toEqual(b);
  });
});
