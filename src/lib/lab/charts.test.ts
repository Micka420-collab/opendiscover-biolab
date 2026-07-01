import { describe, expect, it } from 'vitest';
import type { Series } from '../sim/core/types';
import { distributionToVegaLiteSpec, seriesToRows, seriesToVegaLiteSpec } from './charts';

describe('seriesToRows', () => {
  it('reshapes column-oriented series into tidy (x, series, y) rows', () => {
    const series: Series = { x: [0, 1, 2], y: { biomass: [1, 2, 4], substrate: [10, 8, 5] } };
    expect(seriesToRows(series)).toEqual([
      { x: 0, series: 'biomass', y: 1 },
      { x: 1, series: 'biomass', y: 2 },
      { x: 2, series: 'biomass', y: 4 },
      { x: 0, series: 'substrate', y: 10 },
      { x: 1, series: 'substrate', y: 8 },
      { x: 2, series: 'substrate', y: 5 },
    ]);
  });

  it('handles a single y-column', () => {
    const series: Series = { x: [0, 5], y: { value: [1, 2] } };
    expect(seriesToRows(series)).toEqual([
      { x: 0, series: 'value', y: 1 },
      { x: 5, series: 'value', y: 2 },
    ]);
  });

  it('skips indices where a y-column is shorter than x', () => {
    const series: Series = { x: [0, 1, 2], y: { value: [1, 2] } };
    expect(seriesToRows(series)).toEqual([
      { x: 0, series: 'value', y: 1 },
      { x: 1, series: 'value', y: 2 },
    ]);
  });

  it('returns [] for an empty series', () => {
    expect(seriesToRows({ x: [], y: {} })).toEqual([]);
  });
});

describe('seriesToVegaLiteSpec', () => {
  it('builds a single-line spec without a color encoding for one y-column', () => {
    const series: Series = { x: [0, 1], y: { value: [1, 2] }, xLabel: 'time', yLabel: 'conc' };
    const spec = seriesToVegaLiteSpec(series, 'Test');
    expect(spec).toMatchObject({
      title: 'Test',
      mark: { type: 'line', point: true },
      encoding: {
        x: { field: 'x', type: 'quantitative', title: 'time' },
        y: { field: 'y', type: 'quantitative', title: 'conc' },
      },
    });
    expect((spec.encoding as Record<string, unknown>).color).toBeUndefined();
    expect((spec.data as { values: unknown[] }).values).toHaveLength(2);
  });

  it('adds a color-by-series encoding for multiple y-columns', () => {
    const series: Series = { x: [0, 1], y: { a: [1, 2], b: [3, 4] } };
    const spec = seriesToVegaLiteSpec(series);
    expect(spec.encoding).toMatchObject({
      color: { field: 'series', type: 'nominal', title: 'series' },
    });
  });

  it('defaults axis titles to "x"/"y" when the series has no labels', () => {
    const spec = seriesToVegaLiteSpec({ x: [0], y: { v: [1] } });
    expect(spec.encoding).toMatchObject({
      x: { title: 'x' },
      y: { title: 'y' },
    });
  });

  it('disables point markers once a series has more than 60 samples', () => {
    const x = Array.from({ length: 61 }, (_, i) => i);
    const spec = seriesToVegaLiteSpec({ x, y: { v: x } });
    expect(spec.mark).toEqual({ type: 'line', point: false });
  });
});

describe('distributionToVegaLiteSpec', () => {
  it('builds a bar-mark spec with the given rows as data.values, unmodified', () => {
    const rows = [
      { label: 'Round, Yellow', probability: 9 / 16 },
      { label: 'Round, Green', probability: 3 / 16 },
      { label: 'Wrinkled, Yellow', probability: 3 / 16 },
      { label: 'Wrinkled, Green', probability: 1 / 16 },
    ];
    const spec = distributionToVegaLiteSpec(rows, 'Dihybrid F2');
    expect(spec.title).toBe('Dihybrid F2');
    expect(spec.mark).toBe('bar');
    expect((spec.data as { values: unknown[] }).values).toEqual(rows);
  });

  it('encodes label on x (nominal, sorted by descending y) and probability on y (quantitative)', () => {
    const spec = distributionToVegaLiteSpec([{ label: 'A', probability: 1 }]);
    expect(spec.encoding).toMatchObject({
      x: { field: 'label', type: 'nominal', sort: '-y' },
      y: { field: 'probability', type: 'quantitative' },
    });
  });

  it('handles an empty distribution without throwing', () => {
    const spec = distributionToVegaLiteSpec([]);
    expect((spec.data as { values: unknown[] }).values).toEqual([]);
  });
});
