import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { hybridConstants, paramsSchema, run } from './pk-two-compartment';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

const defaults = paramsSchema.parse({});

describe('pk-two-compartment', () => {
  it('hybrid constants satisfy Vieta: α+β = Σk and α·β = k10·k21, with α>β>0', () => {
    const { k10, k12, k21, alpha, beta } = hybridConstants(defaults);
    expect(alpha + beta).toBeCloseTo(k10 + k12 + k21, 10);
    expect(alpha * beta).toBeCloseTo(k10 * k21, 10);
    expect(alpha).toBeGreaterThan(beta);
    expect(beta).toBeGreaterThan(0);
  });

  it('Cmax of a bolus is Dose/V1 at t=0', () => {
    const r = run({ dose: 100, v1: 10 });
    expect(metric(r, 'cmax')).toBeCloseTo(10, 10);
    expect(r.series?.[0]?.y.central[0]).toBeCloseTo(10, 8);
  });

  it('AUC(0→∞) equals Dose/CL and Vss equals V1+V2', () => {
    const r = run({ dose: 100, cl: 5, v1: 10, v2: 20 });
    expect(metric(r, 'auc')).toBeCloseTo(20, 10);
    expect(metric(r, 'vss')).toBeCloseTo(30, 10);
  });

  it('trapezoidal AUC of the plasma curve converges to Dose/CL over a long horizon', () => {
    const r = run({ dose: 100, cl: 5, tEnd: 240, outputPoints: 4000 });
    const s = r.series?.[0];
    const x = s?.x ?? [];
    const y = s?.y.central ?? [];
    let auc = 0;
    for (let i = 1; i < x.length; i++) {
      auc += (((y[i] ?? 0) + (y[i - 1] ?? 0)) / 2) * ((x[i] ?? 0) - (x[i - 1] ?? 0));
    }
    expect(auc).toBeCloseTo(20, 1); // within ~0.05 of Dose/CL = 20
  });

  it('the terminal phase decays with rate β (slope of log-concentration)', () => {
    const r = run({ tEnd: 30 });
    const beta = metric(r, 'beta');
    const central = (t: number) => {
      const rr = run({ tEnd: t, outputPoints: 2 });
      return rr.series?.[0]?.y.central.at(-1) ?? Number.NaN;
    };
    const c1 = central(15);
    const c2 = central(20);
    // ln(C(15)/C(20)) ≈ β·(20−15) once the fast α-phase has vanished.
    expect(Math.log(c1 / c2) / 5).toBeCloseTo(beta, 3);
  });

  it('plasma concentration is positive and monotonically decreasing after a bolus', () => {
    const r = run({ tEnd: 48, outputPoints: 500 });
    const y = r.series?.[0]?.y.central ?? [];
    for (let i = 1; i < y.length; i++) {
      expect(y[i]).toBeGreaterThan(0);
      expect(y[i] as number).toBeLessThanOrEqual((y[i - 1] as number) + 1e-12);
    }
  });

  it('tissue (peripheral) concentration starts at 0, peaks, then falls', () => {
    const r = run({ tEnd: 24, outputPoints: 500 });
    const peri = r.series?.[0]?.y.peripheral ?? [];
    expect(peri[0]).toBeCloseTo(0, 10);
    const peak = Math.max(...peri);
    const peakIdx = peri.indexOf(peak);
    expect(peakIdx).toBeGreaterThan(0);
    expect(peakIdx).toBeLessThan(peri.length - 1); // an interior maximum
    const tmax = metric(r, 'peripheralTmax');
    expect(tmax).toBeGreaterThan(0);
    expect(tmax).toBeLessThan(24);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('pk-two-compartment', { dose: 50, cl: 3 });
    const b = runEngine('pk-two-compartment', { dose: 50, cl: 3 });
    expect(a).toEqual(b);
  });
});
