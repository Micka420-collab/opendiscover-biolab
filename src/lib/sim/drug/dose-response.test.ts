/**
 * Dose-response engine tests — validated against analytic pharmacodynamics.
 *
 * We check the science, not just "does not throw":
 *   - The Hill equation is exactly half-maximal at C = EC50.
 *   - The curve is strictly monotonic and saturates at Emax.
 *   - Inverting the Hill equation round-trips.
 *   - Relative EC50 vs absolute IC50 match hand-computed textbook values.
 *   - Least-squares fitting recovers the EC50 and Hill slope of synthetic data
 *     (clean: tight; seeded-noisy: looser but deterministic).
 *   - Bliss independence of two non-interacting drugs is additive (excess ~0).
 *   - The Loewe combination index of doses on the isobologram is exactly 1.
 *   - run() is deterministic and its spec/example are runnable.
 */

import { describe, expect, it } from 'vitest';
import { createRng } from '../core/prng';
import {
  type DataPoint,
  type HillParams,
  absoluteIC50,
  analyzeCombination,
  blissExcess,
  blissIndependence,
  doseForFraction,
  doseResponseCurve,
  fitHill,
  hillFraction,
  hillResponse,
  inverseHillConcentration,
  loeweCombinationIndex,
  logConcentrationGrid,
  run,
  spec,
} from './dose-response';

describe('Hill equation identities', () => {
  const p: HillParams = { e0: 0, emax: 100, ec50: 50, hill: 1 };

  it('is exactly half-maximal at C = EC50', () => {
    expect(hillFraction(50, 50, 1)).toBeCloseTo(0.5, 12);
    // Response is exactly (E0 + Emax)/2 regardless of Hill slope.
    for (const n of [0.5, 1, 2, 4]) {
      expect(hillResponse(50, { e0: 10, emax: 90, ec50: 50, hill: n })).toBeCloseTo(50, 10);
    }
  });

  it('approaches E0 as C -> 0 and Emax as C -> infinity', () => {
    expect(hillResponse(1e-9, p)).toBeCloseTo(0, 6);
    expect(hillResponse(1e12, p)).toBeCloseTo(100, 6);
  });

  it('is strictly monotonic increasing when Emax > E0', () => {
    const cs = logConcentrationGrid(-2, 4, 60);
    const r = cs.map((c) => hillResponse(c, p));
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThan(r[i - 1]);
    // Saturates below Emax, never exceeds it.
    expect(Math.max(...r)).toBeLessThan(100);
    expect(r[r.length - 1]).toBeGreaterThan(99);
  });

  it('is strictly monotonic decreasing for an inhibition curve (Emax < E0)', () => {
    const inh: HillParams = { e0: 100, emax: 0, ec50: 10, hill: 1 };
    const cs = logConcentrationGrid(-2, 4, 60);
    const r = cs.map((c) => hillResponse(c, inh));
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeLessThan(r[i - 1]);
  });

  it('a larger Hill slope makes the curve steeper around EC50', () => {
    // At one decade below EC50 a steeper curve sits closer to the baseline.
    const shallow = hillResponse(5, { e0: 0, emax: 100, ec50: 50, hill: 1 });
    const steep = hillResponse(5, { e0: 0, emax: 100, ec50: 50, hill: 4 });
    expect(steep).toBeLessThan(shallow);
  });
});

describe('inverse Hill', () => {
  it('round-trips concentration -> response -> concentration', () => {
    const p: HillParams = { e0: 5, emax: 95, ec50: 12, hill: 1.7 };
    for (const c of [0.5, 3, 12, 40, 200]) {
      const e = hillResponse(c, p);
      expect(inverseHillConcentration(e, p)).toBeCloseTo(c, 8);
    }
  });

  it('returns NaN for responses outside the (E0, Emax) range', () => {
    const p: HillParams = { e0: 0, emax: 100, ec50: 10, hill: 1 };
    expect(Number.isNaN(inverseHillConcentration(-5, p))).toBe(true);
    expect(Number.isNaN(inverseHillConcentration(150, p))).toBe(true);
  });
});

describe('EC50 vs IC50', () => {
  it('absolute IC50 equals EC50 only for complete inhibition (bottom = 0)', () => {
    const complete: HillParams = { e0: 100, emax: 0, ec50: 2, hill: 1 };
    // Response = 50 (=50% of control) occurs exactly at the EC50 parameter.
    expect(absoluteIC50(complete)).toBeCloseTo(2, 10);
  });

  it('absolute IC50 exceeds EC50 for incomplete inhibition', () => {
    // e0=100, emax=20 (80% max inhibition), ec50=1, n=1.
    // f at response 50: (50-100)/(20-100) = 0.625  =>  C = ec50*(0.625/0.375) = 5/3.
    const incomplete: HillParams = { e0: 100, emax: 20, ec50: 1, hill: 1 };
    expect(absoluteIC50(incomplete)).toBeCloseTo(5 / 3, 10);
    expect(absoluteIC50(incomplete)).toBeGreaterThan(incomplete.ec50);
  });

  it('is NaN for a stimulatory curve (never reaches 50% of control)', () => {
    const stim: HillParams = { e0: 0, emax: 100, ec50: 10, hill: 1 };
    expect(Number.isNaN(absoluteIC50(stim))).toBe(true);
  });
});

describe('least-squares fitting recovers known parameters', () => {
  const truth: HillParams = { e0: 0, emax: 100, ec50: 5, hill: 1.5 };

  function synth(cs: number[]): DataPoint[] {
    return cs.map((c) => ({ concentration: c, response: hillResponse(c, truth) }));
  }

  it('recovers EC50, Hill slope and Emax from clean synthetic data', () => {
    const cs = logConcentrationGrid(-1, 3, 25);
    const fit = fitHill(synth(cs));
    expect(fit.ec50).toBeCloseTo(truth.ec50, 3);
    expect(fit.hill).toBeCloseTo(truth.hill, 3);
    expect(fit.emax).toBeCloseTo(truth.emax, 3);
    expect(fit.e0).toBeCloseTo(truth.e0, 3);
    expect(fit.r2).toBeGreaterThan(0.9999);
  });

  it('recovers parameters from seeded-noisy data within tolerance and deterministically', () => {
    const cs = logConcentrationGrid(-1, 3, 30);
    const rng = createRng(2024);
    // 2% multiplicative + small additive Gaussian measurement noise.
    const noisy: DataPoint[] = cs.map((c) => {
      const clean = hillResponse(c, truth);
      return { concentration: c, response: clean * (1 + rng.normal(0, 0.02)) + rng.normal(0, 1) };
    });
    const fitA = fitHill(noisy);
    const fitB = fitHill(noisy);
    // Deterministic: identical data -> identical fit.
    expect(fitA.ec50).toBe(fitB.ec50);
    expect(fitA.hill).toBe(fitB.hill);
    // Recovered within a few percent of the truth.
    expect(Math.abs(fitA.ec50 - truth.ec50) / truth.ec50).toBeLessThan(0.1);
    expect(Math.abs(fitA.hill - truth.hill) / truth.hill).toBeLessThan(0.15);
    expect(fitA.r2).toBeGreaterThan(0.98);
  });

  it('recovers an inhibition curve (top -> bottom) from data', () => {
    const inh: HillParams = { e0: 100, emax: 10, ec50: 25, hill: 2 };
    const cs = logConcentrationGrid(0, 4, 24);
    const data = cs.map((c) => ({ concentration: c, response: hillResponse(c, inh) }));
    const fit = fitHill(data);
    expect(fit.ec50).toBeCloseTo(25, 2);
    expect(fit.hill).toBeCloseTo(2, 3);
    expect(fit.e0).toBeCloseTo(100, 2);
    expect(fit.emax).toBeCloseTo(10, 2);
  });
});

describe('Bliss independence', () => {
  it('predicts fa + fb - fa*fb', () => {
    expect(blissIndependence(0.5, 0.5)).toBeCloseTo(0.75, 12);
    expect(blissIndependence(0.4, 0.6)).toBeCloseTo(0.76, 12);
    expect(blissIndependence(0, 0.3)).toBeCloseTo(0.3, 12);
  });

  it('two non-interacting drugs are additive (excess ~ 0)', () => {
    // If the drugs act independently the fraction unaffected multiplies, so the
    // TRUE combined fraction affected equals the Bliss prediction exactly.
    const faA = 0.4;
    const faB = 0.6;
    const trueCombined = 1 - (1 - faA) * (1 - faB); // = 0.76
    expect(blissExcess(trueCombined, faA, faB)).toBeCloseTo(0, 12);
  });

  it('analyzeCombination defaults observed to the Bliss prediction (excess 0)', () => {
    const drugA: HillParams = { e0: 0, emax: 1, ec50: 1, hill: 1 };
    const drugB: HillParams = { e0: 0, emax: 1, ec50: 5, hill: 1 };
    const a = analyzeCombination(drugA, drugB, 1, 5); // each at its own EC50 -> fa=0.5
    expect(a.faA).toBeCloseTo(0.5, 12);
    expect(a.faB).toBeCloseTo(0.5, 12);
    expect(a.blissExpected).toBeCloseTo(0.75, 12);
    expect(a.blissExcess).toBeCloseTo(0, 12);
  });
});

describe('Loewe additivity / combination index', () => {
  it('CI = dA/DA + dB/DB and equals 1 on the isobologram', () => {
    // Half of each isoeffective single-agent dose lies on the additivity line.
    expect(loeweCombinationIndex(1.5, 15, 3, 30)).toBeCloseTo(1, 12);
    expect(loeweCombinationIndex(3, 0, 3, 30)).toBeCloseTo(1, 12); // drug A alone
  });

  it('doseForFraction inverts the Hill fraction (dose = EC50 at fa = 0.5)', () => {
    expect(doseForFraction(0.5, 7, 1)).toBeCloseTo(7, 12);
    // fa=0.75, n=1 => dose = ec50 * (0.75/0.25) = 3*ec50.
    expect(doseForFraction(0.75, 2, 1)).toBeCloseTo(6, 12);
  });

  it('analyzeCombination yields CI = 1 for doses placed on the additive isobole', () => {
    const drugA: HillParams = { e0: 0, emax: 1, ec50: 1, hill: 1 };
    const drugB: HillParams = { e0: 0, emax: 1, ec50: 10, hill: 1 };
    const target = 0.75;
    // Isoeffective single-agent doses for the target effect.
    const DA = doseForFraction(target, drugA.ec50, drugA.hill); // 3
    const DB = doseForFraction(target, drugB.ec50, drugB.hill); // 30
    // Put exactly half of each on the combination -> must sit on the isobole.
    const a = analyzeCombination(drugA, drugB, DA / 2, DB / 2, target);
    expect(a.isoDoseA).toBeCloseTo(DA, 10);
    expect(a.isoDoseB).toBeCloseTo(DB, 10);
    expect(a.loeweCI).toBeCloseTo(1, 10);
  });

  it('flags synergy (CI < 1) when less drug than additive is needed', () => {
    const drugA: HillParams = { e0: 0, emax: 1, ec50: 1, hill: 1 };
    const drugB: HillParams = { e0: 0, emax: 1, ec50: 10, hill: 1 };
    const target = 0.75;
    const DA = doseForFraction(target, drugA.ec50, drugA.hill);
    const DB = doseForFraction(target, drugB.ec50, drugB.hill);
    const a = analyzeCombination(drugA, drugB, DA / 4, DB / 4, target); // only quarter-doses
    expect(a.loeweCI).toBeLessThan(1);
  });
});

describe('run() curve mode', () => {
  it('reports ec50, hillSlope, emax and ic50 metrics and a log-conc series', () => {
    const res = run({
      e0: 0,
      emax: 100,
      ec50: 50,
      hill: 1,
      logConcMin: -2,
      logConcMax: 4,
      numPoints: 61,
    });
    const m = Object.fromEntries(res.metrics.map((x) => [x.key, x.value]));
    expect(m.ec50).toBe(50);
    expect(m.hillSlope).toBe(1);
    expect(m.emax).toBe(100);
    expect(res.metrics.some((x) => x.key === 'ic50')).toBe(true);

    const series = res.series![0];
    expect(series.xLabel).toBe('log10(concentration)');
    // x is log10(concentration) and response is monotonic in it.
    const r = series.y.response;
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThanOrEqual(r[i - 1]);
  });

  it('response at C = EC50 is exactly the E0/Emax midpoint', () => {
    const res = run({ e0: 20, emax: 80, ec50: 10, hill: 2, concentrations: [10] });
    const series = res.series![0];
    expect(series.y.response[0]).toBeCloseTo(50, 10);
    expect(series.x[0]).toBeCloseTo(1, 12); // log10(10)
  });

  it('is deterministic and reproduces the noisy channel under a fixed seed', () => {
    const params = { e0: 0, emax: 100, ec50: 30, hill: 1.5, noiseCv: 0.05, seed: 7 };
    const a = run(params);
    const b = run(params);
    expect(a.series![0].y.measuredResponse).toEqual(b.series![0].y.measuredResponse);
    expect(a.metrics).toEqual(b.metrics);
    // A different seed changes the measured channel but not the clean curve.
    const c = run({ ...params, seed: 8 });
    expect(c.series![0].y.measuredResponse).not.toEqual(a.series![0].y.measuredResponse);
    expect(c.series![0].y.response).toEqual(a.series![0].y.response);
  });

  it('includes Bliss/Loewe metrics when a combination is supplied', () => {
    const res = run({
      combo: {
        drugA: { e0: 0, emax: 1, ec50: 1, hill: 1 },
        drugB: { e0: 0, emax: 1, ec50: 10, hill: 1 },
        doseA: 1,
        doseB: 10,
      },
    });
    const keys = res.metrics.map((x) => x.key);
    expect(keys).toContain('blissExpected');
    expect(keys).toContain('loeweCI');
  });
});

describe('run() fit mode', () => {
  it('fits supplied (concentration,response) data and recovers EC50', () => {
    const truth: HillParams = { e0: 0, emax: 100, ec50: 8, hill: 1.2 };
    const cs = logConcentrationGrid(-1, 3, 20);
    const data = cs.map((c) => ({ concentration: c, response: hillResponse(c, truth) }));
    const res = run({ data });
    const m = Object.fromEntries(res.metrics.map((x) => [x.key, x.value]));
    expect(m.ec50).toBeCloseTo(8, 2);
    expect(m.hillSlope).toBeCloseTo(1.2, 2);
    expect(m.r2).toBeGreaterThan(0.9999);
    expect(res.series![0].y.observed.length).toBe(cs.length);
    expect(res.series![0].y.fitted.length).toBe(cs.length);
  });
});

describe('doseResponseCurve & spec', () => {
  it('doseResponseCurve returns aligned concentration/log/response points', () => {
    const pts = doseResponseCurve({ e0: 0, emax: 100, ec50: 50, hill: 1 }, [5, 50, 500]);
    expect(pts).toHaveLength(3);
    expect(pts[1].response).toBeCloseTo(50, 10);
    expect(pts[1].logConcentration).toBeCloseTo(Math.log10(50), 12);
  });

  it('exposes a runnable spec whose example is valid', () => {
    expect(spec.slug).toBe('dose-response');
    expect(spec.domain).toBe('drug-discovery');
    const out = spec.run(spec.example);
    expect(out.engine).toBe('dose-response');
    expect(out.provenance.version).toBe('1.0.0');
    expect(out.metrics.length).toBeGreaterThan(0);
    expect(out.series?.length).toBeGreaterThan(0);
  });
});
