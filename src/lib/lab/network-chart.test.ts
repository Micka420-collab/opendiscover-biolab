import { describe, expect, it } from 'vitest';
import { computeCircularLayout, networkGraphSpec } from './network-chart';

describe('computeCircularLayout — exact trigonometry, hand-verified', () => {
  it('places 2 nodes at opposite poles (0,-1) and (0,1)', () => {
    const nodes = computeCircularLayout(['a', 'b']);
    expect(nodes[0].x).toBeCloseTo(0, 10);
    expect(nodes[0].y).toBeCloseTo(-1, 10);
    expect(nodes[1].x).toBeCloseTo(0, 10);
    expect(nodes[1].y).toBeCloseTo(1, 10);
  });

  it('places 3 nodes at -90°, 30°, 150° (an equilateral triangle on the unit circle)', () => {
    const nodes = computeCircularLayout(['a', 'b', 'c']);
    const sqrt3over2 = Math.sqrt(3) / 2;
    expect(nodes[0].x).toBeCloseTo(0, 10);
    expect(nodes[0].y).toBeCloseTo(-1, 10);
    expect(nodes[1].x).toBeCloseTo(sqrt3over2, 10);
    expect(nodes[1].y).toBeCloseTo(0.5, 10);
    expect(nodes[2].x).toBeCloseTo(-sqrt3over2, 10);
    expect(nodes[2].y).toBeCloseTo(0.5, 10);
  });

  it('every node sits at unit distance from the origin (it is a circle)', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const nodes = computeCircularLayout(Array.from({ length: n }, (_, i) => `g${i}`));
      for (const node of nodes) {
        const r = Math.sqrt(node.x ** 2 + node.y ** 2);
        expect(r).toBeCloseTo(1, 9);
      }
    }
  });

  it('preserves node names in order', () => {
    const nodes = computeCircularLayout(['x', 'y', 'z']);
    expect(nodes.map((n) => n.name)).toEqual(['x', 'y', 'z']);
  });
});

describe('networkGraphSpec — valid Vega-Lite structure with correct data', () => {
  it('has exactly 3 layers: edges (rule), nodes (point), labels (text)', () => {
    const spec = networkGraphSpec(
      ['g0', 'g1', 'g2'],
      [
        { from: 'g0', to: 'g1', sign: -1 },
        { from: 'g1', to: 'g2', sign: -1 },
        { from: 'g2', to: 'g0', sign: -1 },
      ],
    );
    const layer = spec.layer as Array<{ mark: { type: string } }>;
    expect(layer).toHaveLength(3);
    expect(layer[0].mark.type).toBe('rule');
    expect(layer[1].mark.type).toBe('point');
    expect(layer[2].mark.type).toBe('text');
  });

  it('embeds exactly one data row per edge, with correctly matched endpoint coordinates', () => {
    const spec = networkGraphSpec(['a', 'b'], [{ from: 'a', to: 'b', sign: 1 }]);
    const layer = spec.layer as Array<{ data: { values: unknown[] } }>;
    const edgeRows = layer[0].data.values as {
      from: string;
      to: string;
      x: number;
      y: number;
      x2: number;
      y2: number;
      sign: string;
    }[];
    expect(edgeRows).toHaveLength(1);
    expect(edgeRows[0].from).toBe('a');
    expect(edgeRows[0].to).toBe('b');
    // a is node 0 -> (0,-1); b is node 1 -> (0,1) for n=2.
    expect(edgeRows[0].x).toBeCloseTo(0, 9);
    expect(edgeRows[0].y).toBeCloseTo(-1, 9);
    expect(edgeRows[0].x2).toBeCloseTo(0, 9);
    expect(edgeRows[0].y2).toBeCloseTo(1, 9);
    expect(edgeRows[0].sign).toBe('activation');
  });

  it('labels repression edges distinctly from activation edges', () => {
    const spec = networkGraphSpec(
      ['a', 'b'],
      [
        { from: 'a', to: 'b', sign: 1 },
        { from: 'b', to: 'a', sign: -1 },
      ],
    );
    const layer = spec.layer as Array<{ data: { values: { sign: string }[] } }>;
    const signs = layer[0].data.values.map((r) => r.sign).sort();
    expect(signs).toEqual(['activation', 'repression']);
  });

  it('embeds exactly one node row per gene, matching the circular layout', () => {
    const spec = networkGraphSpec(['g0', 'g1', 'g2'], []);
    const layer = spec.layer as Array<{ data: { values: unknown[] } }>;
    const nodeRows = layer[1].data.values as { name: string; x: number; y: number }[];
    expect(nodeRows).toHaveLength(3);
    expect(nodeRows.map((n) => n.name)).toEqual(['g0', 'g1', 'g2']);
  });

  it('drops an edge silently if it references an unknown gene name (defensive, not thrown)', () => {
    const spec = networkGraphSpec(['a', 'b'], [{ from: 'a', to: 'ghost', sign: 1 }]);
    const layer = spec.layer as Array<{ data: { values: unknown[] } }>;
    expect(layer[0].data.values).toHaveLength(0);
  });

  it('is a valid-shaped Vega-Lite spec (has the $schema key and container sizing)', () => {
    const spec = networkGraphSpec(['a', 'b'], []);
    expect(spec.$schema).toContain('vega-lite');
    expect(spec.width).toBe('container');
  });
});
