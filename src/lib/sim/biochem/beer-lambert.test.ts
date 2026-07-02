import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { absorptivity, run, unmix } from './beer-lambert';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('beer-lambert', () => {
  it('absorbances add (the mixture equals the sum of component contributions)', () => {
    const r = run({});
    const s = r.series?.[0];
    const total = s?.y.absorbance ?? [];
    const c1 = s?.y.component1 ?? [];
    const c2 = s?.y.component2 ?? [];
    for (let j = 0; j < total.length; j++) {
      expect(total[j]).toBeCloseTo((c1[j] ?? 0) + (c2[j] ?? 0), 12);
    }
  });

  it('un-mixing recovers the true concentrations from the spectrum (self-check)', () => {
    const r = run({ conc1: 20, conc2: 15 });
    expect(metric(r, 'recoveredConc1')).toBeCloseTo(20, 4);
    expect(metric(r, 'recoveredConc2')).toBeCloseTo(15, 4);
    expect(metric(r, 'wellConditioned')).toBe(1);
  });

  it('a single component: peak absorbance = l·c·εmax at its band centre', () => {
    const r = run({
      conc1: 25,
      eMax1: 0.02,
      peak1: 500,
      width1: 30,
      conc2: 0,
      lambdaMin: 400,
      lambdaMax: 600,
    });
    // conc2 = 0 → component 2 contributes nothing (tiny ridge bias only).
    expect(Math.abs(metric(r, 'recoveredConc2'))).toBeLessThan(1e-4);
    expect(metric(r, 'peakAbsorbance')).toBeCloseTo(1 * 25 * 0.02, 3); // = 0.5
    expect(metric(r, 'peakWavelength')).toBeCloseTo(500, 0);
  });

  it('flags (and stays finite for) two spectrally identical bands', () => {
    const r = run({
      eMax1: 0.02,
      peak1: 500,
      width1: 30,
      conc1: 10,
      eMax2: 0.02,
      peak2: 500,
      width2: 30,
      conc2: 10,
    });
    expect(metric(r, 'wellConditioned')).toBe(0); // cannot separate identical spectra
    expect(Number.isFinite(metric(r, 'recoveredConc1'))).toBe(true); // no NaN/Inf
    expect(Number.isFinite(metric(r, 'recoveredConc2'))).toBe(true);
  });

  it('minimum %T follows from the peak absorbance (T = 10^(−A))', () => {
    const r = run({});
    expect(metric(r, 'minTransmittancePct')).toBeCloseTo(
      100 * 10 ** -metric(r, 'peakAbsorbance'),
      9,
    );
  });

  it('absorptivity is a Gaussian peaking at εmax at the band centre', () => {
    expect(absorptivity(500, 0.02, 500, 30)).toBeCloseTo(0.02, 12); // at peak
    expect(absorptivity(530, 0.02, 500, 30)).toBeCloseTo(0.02 * Math.exp(-0.5), 12); // one σ away
  });

  it('unmix on exact data returns the generating coefficients', () => {
    const e1 = [1, 0.5, 0.2];
    const e2 = [0.1, 0.8, 1];
    const a = e1.map((v, j) => 3 * v + 7 * (e2[j] ?? 0)); // c1=3, c2=7
    const rec = unmix(e1, e2, a);
    expect(rec.c1).toBeCloseTo(3, 6);
    expect(rec.c2).toBeCloseTo(7, 6);
    expect(rec.wellConditioned).toBe(true);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('beer-lambert', { conc1: 12, conc2: 8 });
    const b = runEngine('beer-lambert', { conc1: 12, conc2: 8 });
    expect(a).toEqual(b);
  });
});
