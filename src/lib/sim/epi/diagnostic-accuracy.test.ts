import { describe, expect, it } from 'vitest';
import { negativePredictiveValue, positivePredictiveValue, run, spec } from './diagnostic-accuracy';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('diagnostic-accuracy (Bayes predictive value)', () => {
  it('PPV matches Bayes and is low for a rare disease (base-rate fallacy)', () => {
    // p=0.01, sens=0.95, spec=0.90 ⇒ 0.0095/(0.0095+0.099) = 0.0876
    expect(positivePredictiveValue(0.01, 0.95, 0.9)).toBeCloseTo(0.0876, 4);
    const r = run({ prevalence: 0.01, sensitivity: 0.95, specificity: 0.9 });
    expect(metric(r, 'ppv')).toBeCloseTo(0.0876, 4);
    // false positives outnumber true positives when the disease is rare
    expect(metric(r, 'falsePositives')).toBeGreaterThan(metric(r, 'truePositives'));
  });

  it('false-discovery rate is 1 − PPV', () => {
    const r = run({ prevalence: 0.05, sensitivity: 0.9, specificity: 0.85 });
    expect(metric(r, 'falseDiscoveryRate')).toBeCloseTo(1 - metric(r, 'ppv'), 12);
  });

  it('PPV rises monotonically with prevalence and crosses 0.5 (challenge is winnable)', () => {
    let prev = -1;
    for (let x = 0; x <= 0.2; x += 0.005) {
      const v = positivePredictiveValue(x, 0.99, 0.95);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
    // 50/50 tipping point near p≈0.048 for sens=0.99, spec=0.95
    expect(
      metric(run({ prevalence: 0.048, sensitivity: 0.99, specificity: 0.95 }), 'ppv'),
    ).toBeCloseTo(0.5, 2);
  });

  it('higher specificity rescues PPV at fixed low prevalence', () => {
    const loose = run({ prevalence: 0.001, sensitivity: 0.99, specificity: 0.95 });
    const tight = run({ prevalence: 0.001, sensitivity: 0.99, specificity: 0.999 });
    expect(metric(tight, 'ppv')).toBeGreaterThan(metric(loose, 'ppv'));
  });

  it('a perfect test gives PPV = NPV = 1', () => {
    const r = run({ prevalence: 0.3, sensitivity: 1, specificity: 1 });
    expect(metric(r, 'ppv')).toBeCloseTo(1, 12);
    expect(metric(r, 'npv')).toBeCloseTo(1, 12);
    expect(metric(r, 'falsePositives')).toBe(0);
  });

  it('degenerate cases (no positives / no negatives) are guarded to a finite value', () => {
    // p=0, spec=1 ⇒ no positive tests at all ⇒ PPV guarded to 0 (finite, not NaN)
    expect(positivePredictiveValue(0, 0.95, 1)).toBe(0);
    // p=1, sens=1 ⇒ no negative tests ⇒ NPV guarded to 0
    expect(negativePredictiveValue(1, 1, 0.9)).toBe(0);
    for (const combo of [
      { prevalence: 0, sensitivity: 0, specificity: 1 },
      { prevalence: 1, sensitivity: 1, specificity: 0 },
      { prevalence: 0, sensitivity: 1, specificity: 0 },
    ]) {
      const r = run(combo);
      for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    }
  });

  it('stays finite at the schema bounds', () => {
    const r = run({ prevalence: 1, sensitivity: 1, specificity: 1, populationSize: 1e9 });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.ppv ?? []) expect(Number.isFinite(y)).toBe(true);
    for (const y of r.series?.[0]?.y.npv ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the PPV/NPV-vs-prevalence curves and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.ppv).toHaveLength(40);
    expect(r.series?.[0]?.y.npv).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('diagnostic-accuracy');
    expect(spec.domain).toBe('epidemiology');
  });
});
