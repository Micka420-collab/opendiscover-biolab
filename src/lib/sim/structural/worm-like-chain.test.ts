import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { run, wlcForce } from './worm-like-chain';

const metric = (r: ReturnType<typeof run>, key: string) =>
  r.metrics.find((m) => m.key === key)?.value ?? Number.NaN;

const KBT_25C = 0.0138064852 * (25 + 273.15); // pN·nm

describe('worm-like-chain', () => {
  it('force is zero at zero extension', () => {
    expect(wlcForce(0, 50, KBT_25C)).toBeCloseTo(0, 12);
  });

  it('matches the Marko–Siggia formula at a spot point', () => {
    // f = (kBT/Lp)(x + 1/(4(1−x)²) − 1/4); x=0.5 → (kBT/50)(0.5 + 1 − 0.25) = 1.25·kBT/50.
    expect(wlcForce(0.5, 50, KBT_25C)).toBeCloseTo((1.25 * KBT_25C) / 50, 12);
  });

  it('is Hookean at low force with spring constant 3k_BT/(2·Lp·L)', () => {
    const Lp = 50;
    const L = 1000;
    const k = (3 * KBT_25C) / (2 * Lp * L); // pN/nm
    const x = 1e-4; // tiny fractional extension
    const z = x * L;
    // f ≈ k·z in the entropic-spring regime.
    expect(wlcForce(x, Lp, KBT_25C)).toBeCloseTo(k * z, 6);
    expect(
      metric(run({ persistenceLength: Lp, contourLength: L }), 'entropicStiffness'),
    ).toBeCloseTo(k, 12);
  });

  it('force rises monotonically and diverges toward full extension but stays finite', () => {
    let prev = -1;
    for (let x = 0; x <= 0.99; x += 0.01) {
      const f = wlcForce(x, 50, KBT_25C);
      expect(Number.isFinite(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = f;
    }
    // Near-full extension is much stiffer than mid-extension.
    expect(wlcForce(0.98, 50, KBT_25C)).toBeGreaterThan(10 * wlcForce(0.5, 50, KBT_25C));
  });

  it('produces a finite, non-negative force curve (no blow-up at the cap)', () => {
    const r = run({ maxFraction: 0.99 });
    for (const f of r.series?.[0]?.y.force ?? []) {
      expect(Number.isFinite(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(0);
    }
    expect(metric(r, 'forceAtMaxExtension')).toBeGreaterThan(metric(r, 'forceAtHalfExtension'));
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('worm-like-chain', { persistenceLength: 45, contourLength: 1500 });
    const b = runEngine('worm-like-chain', { persistenceLength: 45, contourLength: 1500 });
    expect(a).toEqual(b);
  });
});
