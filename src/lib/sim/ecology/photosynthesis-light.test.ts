import { describe, expect, it } from 'vitest';
import { grossRate, run, spec } from './photosynthesis-light';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

describe('photosynthesis-light', () => {
  it('gross rate is a saturating hyperbola: half of P_max at I=K_m, → P_max at high light', () => {
    expect(grossRate(200, 20, 200)).toBeCloseTo(10, 9); // I = K_m ⇒ half of P_max
    expect(grossRate(1e9, 20, 200)).toBeCloseTo(20, 4); // saturates at P_max
    expect(grossRate(0, 20, 200)).toBe(0);
  });

  it('net rate is negative in the dark (−R_d) and plateaus at P_max − R_d', () => {
    const r = run({ maxRate: 20, halfSatLight: 200, respiration: 2, light: 0 });
    expect(metric(r, 'netRateAtLight')).toBeCloseTo(-2, 9); // dark: loses R_d
    expect(metric(r, 'lightSaturatedNet')).toBeCloseTo(18, 9); // P_max − R_d
  });

  it('net photosynthesis is zero exactly at the reported compensation point', () => {
    const r = run({ maxRate: 20, halfSatLight: 200, respiration: 2 });
    const ic = metric(r, 'lightCompensationPoint');
    expect(ic).toBeCloseTo((2 * 200) / (20 - 2), 6); // = 22.22
    // running AT that light gives net ≈ 0
    const atIc = run({ maxRate: 20, halfSatLight: 200, respiration: 2, light: ic });
    expect(metric(atIc, 'netRateAtLight')).toBeCloseTo(0, 6);
  });

  it('net rate rises monotonically with light (so the break-even challenge is winnable)', () => {
    let prev = -1e9;
    for (let I = 0; I <= 1000; I += 25) {
      const v = metric(
        run({ maxRate: 20, halfSatLight: 200, respiration: 2, light: I }),
        'netRateAtLight',
      );
      expect(v).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = v;
    }
  });

  it('a plant that respires more than it can ever fix never breaks even (guarded to 0)', () => {
    const r = run({ maxRate: 3, halfSatLight: 200, respiration: 5 }); // P_max < R_d
    expect(metric(r, 'canBreakEven')).toBe(0);
    expect(metric(r, 'lightCompensationPoint')).toBe(0);
    expect(metric(r, 'lightSaturatedNet')).toBeCloseTo(-2, 9); // still loses carbon at full light
  });

  it('initial quantum yield is P_max/K_m (the low-light slope)', () => {
    expect(metric(run({ maxRate: 20, halfSatLight: 200 }), 'initialQuantumYield')).toBeCloseTo(
      0.1,
      9,
    );
  });

  it('rejects denormal inputs and stays finite at the schema bounds', () => {
    expect(() => run({ maxRate: 5e-324 })).toThrow();
    expect(() => run({ halfSatLight: 5e-324 })).toThrow();
    const r = run({
      maxRate: 1e6,
      halfSatLight: 1e-6,
      respiration: 1e6,
      light: 1e9,
      lightMax: 1e9,
    });
    for (const m of r.metrics) expect(Number.isFinite(m.value)).toBe(true);
    for (const y of r.series?.[0]?.y.net ?? []) expect(Number.isFinite(y)).toBe(true);
    for (const y of r.series?.[0]?.y.gross ?? []) expect(Number.isFinite(y)).toBe(true);
  });

  it('exposes the gross + net response curves and is deterministic', () => {
    const r = run({ outputPoints: 40 });
    expect(r.series?.[0]?.x).toHaveLength(40);
    expect(r.series?.[0]?.y.gross).toHaveLength(40);
    expect(r.series?.[0]?.y.net).toHaveLength(40);
    expect(run({})).toEqual(run({}));
    expect(spec.slug).toBe('photosynthesis-light');
    expect(spec.domain).toBe('ecology');
  });
});
