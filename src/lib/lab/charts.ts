/**
 * `Series` -> Vega-Lite spec, for rendering an engine's result series in the lab
 * playground without any engine-specific chart code. Every engine returns its
 * series in the same column-oriented `{ x, y: Record<name, number[]> }` shape
 * (see `sim/core/types.ts`); this just reshapes that into Vega-Lite's expected
 * long-format `values` array and a matching line-chart spec.
 *
 * Pure and synchronous — no rendering happens here, just spec construction. The
 * actual chart is drawn client-side by `vega-embed` (see
 * `components/charts/vega-lite-embed.tsx`).
 */

import type { Series } from '../sim/core/types';

/** One row per (x, series-name) pair — Vega-Lite's long/tidy format. */
export interface SeriesRow {
  x: number;
  series: string;
  y: number;
}

export function seriesToRows(series: Series): SeriesRow[] {
  const rows: SeriesRow[] = [];
  const names = Object.keys(series.y);
  for (const name of names) {
    const ys = series.y[name];
    for (let i = 0; i < series.x.length; i++) {
      const y = ys[i];
      if (y === undefined) continue;
      rows.push({ x: series.x[i], series: name, y });
    }
  }
  return rows;
}

/**
 * A multi-line Vega-Lite spec for one `Series`: one line per y-column, colored
 * by series name, with axis labels taken from `xLabel`/`yLabel` when present.
 */
export function seriesToVegaLiteSpec(series: Series, title?: string): Record<string, unknown> {
  const values = seriesToRows(series);
  const multiSeries = Object.keys(series.y).length > 1;
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    title,
    data: { values },
    mark: { type: 'line', point: values.length <= 60 },
    encoding: {
      x: { field: 'x', type: 'quantitative', title: series.xLabel ?? 'x' },
      y: { field: 'y', type: 'quantitative', title: series.yLabel ?? 'y' },
      ...(multiSeries ? { color: { field: 'series', type: 'nominal', title: 'series' } } : {}),
    },
    width: 'container',
    height: 260,
  };
}

/** One labelled class with its probability — a categorical distribution row. */
export interface DistributionRow {
  label: string;
  probability: number;
}

/**
 * A Vega-Lite bar-chart spec for a categorical probability distribution, e.g.
 * `breeding`'s `phenotypeDistribution`/`genotypeDistribution` (a generalised
 * Punnett square) — any engine's `{ <name>: string; probability: number }[]`
 * detail field, reshaped by the caller into `DistributionRow[]`. Bars are
 * sorted descending by probability so the most likely class reads first.
 */
export function distributionToVegaLiteSpec(
  rows: DistributionRow[],
  title?: string,
): Record<string, unknown> {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    title,
    data: { values: rows },
    mark: 'bar',
    encoding: {
      x: { field: 'label', type: 'nominal', title: 'Class', sort: '-y' },
      y: {
        field: 'probability',
        type: 'quantitative',
        title: 'Probability',
        axis: { format: '.0%' },
      },
      tooltip: [
        { field: 'label', type: 'nominal' },
        { field: 'probability', type: 'quantitative', format: '.2%' },
      ],
    },
    width: 'container',
    height: 220,
  };
}
