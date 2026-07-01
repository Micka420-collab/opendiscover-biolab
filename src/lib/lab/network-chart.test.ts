import { describe, expect, it } from 'vitest';
import {
  computeCircularLayout,
  metabolicNetworkSpec,
  networkGraphSpec,
  scaleLayout,
} from './network-chart';

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

describe('scaleLayout', () => {
  it('multiplies both coordinates by the radius, preserving the name', () => {
    const base = computeCircularLayout(['a', 'b']); // (0,-1), (0,1)
    const scaled = scaleLayout(base, 1.5);
    expect(scaled[0]).toEqual({ name: 'a', x: expect.closeTo(0, 9), y: expect.closeTo(-1.5, 9) });
    expect(scaled[1]).toEqual({ name: 'b', x: expect.closeTo(0, 9), y: expect.closeTo(1.5, 9) });
  });

  it('preserves the unit circle up to the scale factor (radius r after scaling)', () => {
    const base = computeCircularLayout(['a', 'b', 'c']);
    for (const r of [0.7, 1.5, 3]) {
      for (const p of scaleLayout(base, r)) {
        expect(Math.sqrt(p.x ** 2 + p.y ** 2)).toBeCloseTo(r, 9);
      }
    }
  });
});

describe('metabolicNetworkSpec — bipartite metabolite/reaction network', () => {
  // The exact FBA exampleModel structure (src/lib/sim/systems/fba.ts):
  // metabolites=['glc_c','pyr_c'], reactions=['EX_glc','GLYC','BIOMASS'],
  // stoichiometry rows glc_c=[1,-1,0], pyr_c=[0,2,-1] -- see that file's own
  // extensive documentation of this textbook uptake -> glycolysis -> biomass
  // chain. Edges hand-derived directly from those coefficients:
  //   EX_glc -> glc_c   (coefficient +1, product)
  //   glc_c  -> GLYC    (coefficient -1, substrate)
  //   GLYC   -> pyr_c   (coefficient +2, product)
  //   pyr_c  -> BIOMASS (coefficient -1, substrate)
  const metabolites = ['glc_c', 'pyr_c'];
  const reactions = ['EX_glc', 'GLYC', 'BIOMASS'];
  const edges = [
    { metabolite: 'glc_c', reaction: 'EX_glc', coefficient: 1 },
    { metabolite: 'glc_c', reaction: 'GLYC', coefficient: -1 },
    { metabolite: 'pyr_c', reaction: 'GLYC', coefficient: 2 },
    { metabolite: 'pyr_c', reaction: 'BIOMASS', coefficient: -1 },
  ];

  it('has 4 layers: edges, metabolite points, reaction points, labels', () => {
    const spec = metabolicNetworkSpec(metabolites, reactions, edges);
    const layer = spec.layer as Array<{ mark: { type: string; shape?: string } }>;
    expect(layer).toHaveLength(4);
    expect(layer[0].mark.type).toBe('rule');
    expect(layer[1].mark.type).toBe('point');
    expect(layer[2].mark.type).toBe('point');
    expect(layer[3].mark.type).toBe('text');
  });

  it('places metabolites on the outer ring (radius 1.5) and reactions on the inner ring (radius 0.7)', () => {
    const spec = metabolicNetworkSpec(metabolites, reactions, edges);
    const layer = spec.layer as Array<{
      data: { values: { name: string; x: number; y: number }[] };
    }>;
    const metaboliteNodes = layer[1].data.values;
    const reactionNodes = layer[2].data.values;
    // glc_c is the first metabolite -> angle -pi/2 -> (0, -1.5); pyr_c -> (0, 1.5).
    expect(metaboliteNodes.find((n) => n.name === 'glc_c')?.y).toBeCloseTo(-1.5, 9);
    expect(metaboliteNodes.find((n) => n.name === 'pyr_c')?.y).toBeCloseTo(1.5, 9);
    // EX_glc is the first reaction -> (0, -0.7).
    expect(reactionNodes.find((n) => n.name === 'EX_glc')?.y).toBeCloseTo(-0.7, 9);
    for (const n of metaboliteNodes) expect(Math.sqrt(n.x ** 2 + n.y ** 2)).toBeCloseTo(1.5, 9);
    for (const n of reactionNodes) expect(Math.sqrt(n.x ** 2 + n.y ** 2)).toBeCloseTo(0.7, 9);
  });

  it('directs substrate edges metabolite->reaction and product edges reaction->metabolite', () => {
    const spec = metabolicNetworkSpec(metabolites, reactions, edges);
    const layer = spec.layer as Array<{
      data: {
        values: {
          metabolite: string;
          reaction: string;
          role: string;
          x: number;
          y: number;
          x2: number;
          y2: number;
        }[];
      };
    }>;
    const rows = layer[0].data.values;
    expect(rows).toHaveLength(4);

    const byPair = new Map(rows.map((r) => [`${r.metabolite}|${r.reaction}`, r]));
    // EX_glc -> glc_c is a PRODUCT (coeff +1): edge starts at the reaction (EX_glc, y=-0.7)
    // and ends at the metabolite (glc_c, y=-1.5).
    const exGlcRow = byPair.get('glc_c|EX_glc');
    expect(exGlcRow?.role).toBe('product');
    expect(exGlcRow?.y).toBeCloseTo(-0.7, 9); // starts at the reaction
    expect(exGlcRow?.y2).toBeCloseTo(-1.5, 9); // ends at the metabolite

    // glc_c -> GLYC is a SUBSTRATE (coeff -1): edge starts at the metabolite.
    const glycRow = byPair.get('glc_c|GLYC');
    expect(glycRow?.role).toBe('substrate');
    expect(glycRow?.y).toBeCloseTo(-1.5, 9); // starts at the metabolite (glc_c)
  });

  it('every edge role is either substrate or product, matching the coefficient sign', () => {
    const spec = metabolicNetworkSpec(metabolites, reactions, edges);
    const layer = spec.layer as Array<{
      data: { values: { metabolite: string; reaction: string; role: string }[] };
    }>;
    for (const row of layer[0].data.values) {
      const edge = edges.find(
        (e) => e.metabolite === row.metabolite && e.reaction === row.reaction,
      );
      expect(row.role).toBe(edge && edge.coefficient < 0 ? 'substrate' : 'product');
    }
  });
});
