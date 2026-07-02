/**
 * Build a tiny SVG polyline of a run's first series for the Open Graph share card,
 * so every ?x= permalink previews as a distinct little chart instead of an identical
 * text card. Pure and dependency-light: downsamples with the shared series helper,
 * spaces points evenly across the width, and scales y to the box. Returns null when
 * there's nothing sensible to draw (fewer than 2 points, or any non-finite value).
 */

import { downsampleIndices } from '@/lib/sim/core/series';

export interface Sparkline {
  /** SVG polyline `points` attribute: "x1,y1 x2,y2 …". */
  points: string;
  width: number;
  height: number;
}

const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 150;
const DEFAULT_MAX_POINTS = 60;
const PAD = 6;

export function buildSparkline(
  x: readonly number[],
  y: readonly number[],
  opts: { width?: number; height?: number; maxPoints?: number } = {},
): Sparkline | null {
  const width = opts.width ?? DEFAULT_WIDTH;
  const height = opts.height ?? DEFAULT_HEIGHT;
  const maxPoints = opts.maxPoints ?? DEFAULT_MAX_POINTS;

  const n = Math.min(x.length, y.length);
  if (n < 2) return null;

  const idx = downsampleIndices(n, maxPoints);
  const ys = idx.map((i) => y[i] ?? Number.NaN);
  if (!ys.every((v) => Number.isFinite(v))) return null;

  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const ySpan = yMax - yMin;
  const innerW = width - 2 * PAD;
  const innerH = height - 2 * PAD;
  const last = idx.length - 1;

  const points = ys
    .map((yv, k) => {
      const px = PAD + (last > 0 ? k / last : 0) * innerW;
      // SVG y grows downward, so a high value maps to a small y. Flat series → centered.
      const py = ySpan > 0 ? PAD + (1 - (yv - yMin) / ySpan) * innerH : PAD + innerH / 2;
      return `${px.toFixed(2)},${py.toFixed(2)}`;
    })
    .join(' ');

  return { points, width, height };
}
