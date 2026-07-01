/**
 * Regulatory-network node/edge lists (e.g. `grn`'s `detail.edges`) -> a Vega-Lite
 * node-link diagram spec, for rendering circuit topology in the lab playground
 * without pulling in a full graph-layout library.
 *
 * Layout is a deterministic circular arrangement: n nodes placed evenly around
 * a unit circle, starting at the top (12 o'clock) and proceeding clockwise.
 * Node i sits at angle `-π/2 + i·(2π/n)`, i.e. position
 * `(cos(angle), sin(angle))`. This is exact, hand-checkable trigonometry (no
 * force simulation, no randomness) — ideal for the small (2-6 node) regulatory
 * circuits these engines produce, and it renders a cycle (like the
 * repressilator's 3-gene ring) as an actual visual ring.
 *
 * Pure and synchronous — no rendering happens here; the spec is drawn
 * client-side by `vega-embed` (see `components/charts/vega-lite-embed.tsx`),
 * same as `charts.ts`.
 */

export interface GraphEdge {
  from: string;
  to: string;
  sign: 1 | -1;
}

export interface NodePosition {
  name: string;
  x: number;
  y: number;
}

/** Deterministic circular layout: node i at angle -π/2 + i·(2π/n), unit radius. */
export function computeCircularLayout(names: string[]): NodePosition[] {
  const n = names.length;
  return names.map((name, i) => {
    const angle = -Math.PI / 2 + i * ((2 * Math.PI) / n);
    return { name, x: Math.cos(angle), y: Math.sin(angle) };
  });
}

/** Scale a set of unit-circle positions by a radius (for concentric layouts). */
export function scaleLayout(positions: NodePosition[], radius: number): NodePosition[] {
  return positions.map((p) => ({ name: p.name, x: p.x * radius, y: p.y * radius }));
}

interface EdgeRow {
  from: string;
  to: string;
  sign: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
}

/**
 * Build a Vega-Lite spec for a regulatory network: a layer of edges (colored
 * green for activation, red for repression) under a layer of labeled node
 * points, laid out on a circle.
 */
export function networkGraphSpec(genes: string[], edges: GraphEdge[]): Record<string, unknown> {
  const nodes = computeCircularLayout(genes);
  const byName = new Map(nodes.map((n) => [n.name, n]));

  const edgeRows: EdgeRow[] = edges
    .map((e) => {
      const from = byName.get(e.from);
      const to = byName.get(e.to);
      if (!from || !to) return null;
      return {
        from: e.from,
        to: e.to,
        sign: e.sign > 0 ? 'activation' : 'repression',
        x: from.x,
        y: from.y,
        x2: to.x,
        y2: to.y,
      };
    })
    .filter((r): r is EdgeRow => r !== null);

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    layer: [
      {
        data: { values: edgeRows },
        mark: { type: 'rule', strokeWidth: 2 },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null, scale: { domain: [-1.3, 1.3] } },
          y: { field: 'y', type: 'quantitative', axis: null, scale: { domain: [-1.3, 1.3] } },
          x2: { field: 'x2' },
          y2: { field: 'y2' },
          color: {
            field: 'sign',
            type: 'nominal',
            scale: { domain: ['activation', 'repression'], range: ['#22c55e', '#ef4444'] },
            legend: { title: 'Regulation' },
          },
        },
      },
      {
        data: { values: nodes },
        mark: { type: 'point', filled: true, size: 400, color: '#38bdf8' },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null },
          y: { field: 'y', type: 'quantitative', axis: null },
        },
      },
      {
        data: { values: nodes },
        mark: { type: 'text', dy: -18, fontWeight: 'bold' },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null },
          y: { field: 'y', type: 'quantitative', axis: null },
          text: { field: 'name', type: 'nominal' },
        },
      },
    ],
    width: 'container',
    height: 320,
    view: { stroke: null },
  };
}

// ---------------------------------------------------------------------------
// Bipartite metabolite <-> reaction networks (e.g. `fba`'s stoichiometry)
// ---------------------------------------------------------------------------

export interface StoichiometryEdge {
  metabolite: string;
  reaction: string;
  coefficient: number;
}

interface BipartiteEdgeRow {
  metabolite: string;
  reaction: string;
  role: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
}

/**
 * Build a Vega-Lite spec for a metabolic (metabolite <-> reaction) network: a
 * bipartite graph laid out on two concentric circles — metabolites on the
 * outer ring (radius 1.5), reactions on the inner ring (radius 0.7), each
 * ring individually using the same deterministic `computeCircularLayout`.
 * A negative stoichiometric coefficient (substrate) draws an edge from the
 * metabolite inward to the reaction; a positive one (product) draws an edge
 * from the reaction outward to the metabolite.
 */
export function metabolicNetworkSpec(
  metabolites: string[],
  reactions: string[],
  edges: StoichiometryEdge[],
): Record<string, unknown> {
  const metaboliteNodes = scaleLayout(computeCircularLayout(metabolites), 1.5);
  const reactionNodes = scaleLayout(computeCircularLayout(reactions), 0.7);
  const metaboliteByName = new Map(metaboliteNodes.map((n) => [n.name, n]));
  const reactionByName = new Map(reactionNodes.map((n) => [n.name, n]));

  const edgeRows: BipartiteEdgeRow[] = edges
    .map((e) => {
      const m = metaboliteByName.get(e.metabolite);
      const r = reactionByName.get(e.reaction);
      if (!m || !r) return null;
      const substrate = e.coefficient < 0;
      const from = substrate ? m : r;
      const to = substrate ? r : m;
      return {
        metabolite: e.metabolite,
        reaction: e.reaction,
        role: substrate ? 'substrate' : 'product',
        x: from.x,
        y: from.y,
        x2: to.x,
        y2: to.y,
      };
    })
    .filter((r): r is BipartiteEdgeRow => r !== null);

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    layer: [
      {
        data: { values: edgeRows },
        mark: { type: 'rule', strokeWidth: 2 },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null, scale: { domain: [-1.8, 1.8] } },
          y: { field: 'y', type: 'quantitative', axis: null, scale: { domain: [-1.8, 1.8] } },
          x2: { field: 'x2' },
          y2: { field: 'y2' },
          color: {
            field: 'role',
            type: 'nominal',
            scale: { domain: ['substrate', 'product'], range: ['#3b82f6', '#a855f7'] },
            legend: { title: 'Role' },
          },
        },
      },
      {
        data: { values: metaboliteNodes },
        mark: { type: 'point', filled: true, size: 250, color: '#f59e0b', shape: 'circle' },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null },
          y: { field: 'y', type: 'quantitative', axis: null },
        },
      },
      {
        data: { values: reactionNodes },
        mark: { type: 'point', filled: true, size: 250, color: '#14b8a6', shape: 'square' },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null },
          y: { field: 'y', type: 'quantitative', axis: null },
        },
      },
      {
        data: { values: [...metaboliteNodes, ...reactionNodes] },
        mark: { type: 'text', dy: -14, fontWeight: 'bold', fontSize: 10 },
        encoding: {
          x: { field: 'x', type: 'quantitative', axis: null },
          y: { field: 'y', type: 'quantitative', axis: null },
          text: { field: 'name', type: 'nominal' },
        },
      },
    ],
    width: 'container',
    height: 360,
    view: { stroke: null },
  };
}
