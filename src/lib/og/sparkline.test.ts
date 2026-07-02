import { describe, expect, it } from 'vitest';
import { buildSparkline } from './sparkline';

const parse = (points: string) =>
  points.split(' ').map((p) => {
    const [px, py] = p.split(',').map(Number);
    return { px: px as number, py: py as number };
  });

describe('buildSparkline', () => {
  it('returns null when there is nothing to draw', () => {
    expect(buildSparkline([], [])).toBeNull();
    expect(buildSparkline([1], [1])).toBeNull(); // need >= 2 points
  });

  it('returns null on any non-finite value (never draws Inf/NaN)', () => {
    expect(buildSparkline([0, 1, 2], [1, Number.NaN, 2])).toBeNull();
    expect(buildSparkline([0, 1], [1, Number.POSITIVE_INFINITY])).toBeNull();
  });

  it('maps a rising series bottom-left → top-right within the padded box', () => {
    const y = Array.from({ length: 10 }, (_, i) => i);
    const sl = buildSparkline(
      y.map((_, i) => i),
      y,
    );
    expect(sl).not.toBeNull();
    const pts = parse((sl as { points: string }).points);
    expect(pts.length).toBe(10);
    // x is evenly spaced and monotonically increasing across the width.
    for (let i = 1; i < pts.length; i++)
      expect(pts[i]?.px).toBeGreaterThan(pts[i - 1]?.px as number);
    // first point (y=0, the min) sits low (large py); last (y=9, the max) sits high (small py).
    expect(pts[0]?.py).toBeGreaterThan(pts[pts.length - 1]?.py as number);
    // all coordinates stay inside the box.
    for (const p of pts) {
      expect(p.px).toBeGreaterThanOrEqual(0);
      expect(p.px).toBeLessThanOrEqual(900);
      expect(p.py).toBeGreaterThanOrEqual(0);
      expect(p.py).toBeLessThanOrEqual(150);
    }
  });

  it('centers a flat series vertically', () => {
    const sl = buildSparkline([0, 1, 2, 3], [5, 5, 5, 5]);
    const pts = parse((sl as { points: string }).points);
    const mid = pts[0]?.py as number;
    for (const p of pts) expect(p.py).toBeCloseTo(mid, 6);
    expect(mid).toBeCloseTo(150 / 2, 6);
  });

  it('downsamples a long series to at most maxPoints (keeping endpoints)', () => {
    const big = Array.from({ length: 5000 }, (_, i) => Math.sin(i / 50));
    const sl = buildSparkline(
      big.map((_, i) => i),
      big,
    );
    const pts = parse((sl as { points: string }).points);
    expect(pts.length).toBeLessThanOrEqual(60);
    expect(pts.length).toBeGreaterThan(2);
    expect(pts[0]?.px).toBeCloseTo(6, 6); // first at left pad
    expect(pts[pts.length - 1]?.px).toBeCloseTo(900 - 6, 6); // last at right pad
  });
});
