import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { run, spikeStats } from './izhikevich';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('spikeStats', () => {
  it('is fully guarded for the 0- and 1-spike cases', () => {
    expect(spikeStats([], 300)).toEqual({
      count: 0,
      rateHz: 0,
      meanISI: 0,
      cvISI: 0,
      firstSpikeLatency: 0,
    });
    const one = spikeStats([50], 300);
    expect(one.count).toBe(1);
    expect(one.rateHz).toBeCloseTo(1 / 0.3, 6); // 1 spike in 0.3 s
    expect(one.meanISI).toBe(0);
    expect(one.cvISI).toBe(0);
    expect(one.firstSpikeLatency).toBe(50);
  });

  it('computes mean ISI and a zero CV for a perfectly periodic train', () => {
    const s = spikeStats([10, 20, 30, 40], 100);
    expect(s.count).toBe(4);
    expect(s.meanISI).toBeCloseTo(10, 12);
    expect(s.cvISI).toBeCloseTo(0, 12); // perfectly regular
    expect(s.firstSpikeLatency).toBe(10);
  });

  it('gives a positive CV for an irregular train', () => {
    const s = spikeStats([10, 30, 35, 70], 100); // ISIs 20,5,35 — uneven
    expect(s.cvISI).toBeGreaterThan(0);
  });
});

describe('izhikevich', () => {
  it('the regular-spiking default fires a tonic train', () => {
    const r = run({}); // RS: a=0.02,b=0.2,c=-65,d=8,I=10
    expect(metric(r, 'spikeCount')).toBeGreaterThan(1);
    expect(metric(r, 'firingRateHz')).toBeGreaterThan(0);
    expect(metric(r, 'meanISI')).toBeGreaterThan(0);
  });

  it('stays quiescent below the rheobase current', () => {
    const r = run({ current: 0, tEnd: 300 });
    expect(metric(r, 'spikeCount')).toBe(0);
    expect(metric(r, 'firingRateHz')).toBe(0);
    expect(metric(r, 'meanISI')).toBe(0);
    expect(metric(r, 'firstSpikeLatency')).toBe(0);
  });

  it('fires faster with stronger drive', () => {
    const low = run({ current: 6, tEnd: 400 });
    const high = run({ current: 20, tEnd: 400 });
    expect(metric(high, 'firingRateHz')).toBeGreaterThan(metric(low, 'firingRateHz'));
  });

  it('never leaks a non-finite membrane potential, even under strong drive', () => {
    const r = run({ current: 90, tEnd: 400, dt: 1 });
    for (const v of r.series?.[0]?.y.v ?? []) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeLessThanOrEqual(30); // capped at the spike peak
      expect(v).toBeGreaterThan(-100);
    }
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('izhikevich', { current: 12 });
    const b = runEngine('izhikevich', { current: 12 });
    expect(a).toEqual(b);
  });
});
