import { describe, expect, it } from 'vitest';
import { lengthConstant, run, spec } from './cable-length-constant';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('cable-length-constant (passive cable)', () => {
  it('length constant is √(d·Rm/(4·Ri)) with the µm→cm conversion', () => {
    // d=2µm=2e-4cm, Rm=1e4, Ri=100 ⇒ √(2e-4·1e4/400)=√0.005=0.0707cm=707.1µm
    expect(lengthConstant(2, 10000, 100)).toBeCloseTo(707.107, 2);
    expect(
      metric(
        run({ diameter: 2, membraneResistance: 10000, axialResistivity: 100 }),
        'lengthConstant',
      ),
    ).toBeCloseTo(707.107, 2);
  });

  it('voltage falls to 1/e at exactly one length constant', () => {
    const lambda = lengthConstant(2, 10000, 100);
    const r = run({
      diameter: 2,
      membraneResistance: 10000,
      axialResistivity: 100,
      distance: lambda,
    });
    expect(metric(r, 'voltageFractionAtDistance')).toBeCloseTo(1 / Math.E, 6);
  });

  it('half-decay distance is λ·ln2 and effective reach is λ·ln100', () => {
    const r = run({ diameter: 2, membraneResistance: 10000, axialResistivity: 100 });
    const lambda = metric(r, 'lengthConstant');
    expect(metric(r, 'halfDecayDistance')).toBeCloseTo(lambda * Math.LN2, 6);
    expect(metric(r, 'effectiveReach')).toBeCloseTo(lambda * Math.log(100), 6);
    // sanity: the reported voltage halves over the half-decay distance
    const half = run({
      diameter: 2,
      membraneResistance: 10000,
      axialResistivity: 100,
      distance: metric(r, 'halfDecayDistance'),
    });
    expect(metric(half, 'voltageFractionAtDistance')).toBeCloseTo(0.5, 6);
  });

  it('a fatter fibre carries the signal further (monotonic knob for the challenge)', () => {
    const thin = run({ diameter: 1, distance: 500 });
    const fat = run({ diameter: 8, distance: 500 });
    expect(metric(fat, 'lengthConstant')).toBeGreaterThan(metric(thin, 'lengthConstant'));
    expect(metric(fat, 'voltageFractionAtDistance')).toBeGreaterThan(
      metric(thin, 'voltageFractionAtDistance'),
    );
    // the daily challenge tunes diameter to ~2.08 µm for 50% at 500 µm
    expect(
      metric(
        run({ diameter: 2.08, membraneResistance: 10000, axialResistivity: 100, distance: 500 }),
        'voltageFractionAtDistance',
      ),
    ).toBeCloseTo(0.5, 2);
  });

  it('better insulation (higher Rm) lengthens λ; more axial resistance (higher Ri) shortens it', () => {
    const base = metric(
      run({ diameter: 2, membraneResistance: 10000, axialResistivity: 100 }),
      'lengthConstant',
    );
    expect(
      metric(
        run({ diameter: 2, membraneResistance: 40000, axialResistivity: 100 }),
        'lengthConstant',
      ),
    ).toBeGreaterThan(base);
    expect(
      metric(
        run({ diameter: 2, membraneResistance: 10000, axialResistivity: 400 }),
        'lengthConstant',
      ),
    ).toBeLessThan(base);
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ diameter: 5e-324 })).toThrow();
    expect(() => run({ membraneResistance: 5e-324 })).toThrow();
    const r = run({
      diameter: 0.1,
      membraneResistance: 1,
      axialResistivity: 1e5,
      distance: 1e7,
      distanceMax: 1e7,
    });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.voltage ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the decay curve (starts at 1) and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.voltage?.[0]).toBeCloseTo(1, 9); // V/V₀ = 1 at x=0
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('cable-length-constant');
    expect(spec.domain).toBe('neuroscience');
  });
});
