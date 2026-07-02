'use client';

/**
 * Shared rendering of a lab run's result — metric grid, network graphs,
 * distribution bar charts, time series, and the reproducibility hash.
 *
 * Extracted so the interactive playground (`/lab/[engine]`) and the OBS overlay
 * (`/lab/[engine]/overlay`) render identical result content without forking the
 * duck-typing/extraction logic that decides which charts an engine's `detail`
 * supports.
 */

import { VegaLiteEmbed } from '@/components/charts/vega-lite-embed';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { distributionToVegaLiteSpec, seriesToVegaLiteSpec } from '@/lib/lab/charts';
import {
  type GraphEdge,
  type StoichiometryEdge,
  metabolicNetworkSpec,
  networkGraphSpec,
} from '@/lib/lab/network-chart';
import type { Metric, SimResult } from '@/lib/sim';
import { useMemo } from 'react';

/** The `/api/lab/run` response shape (a hashed experiment record, minus params). */
export interface RunResult {
  engine: string;
  version: string;
  inputHash: string;
  outputHash: string;
  summary: string;
  metrics: Metric[];
  result: SimResult;
}

/** Detects the `{ genes: string[], edges: {from,to,sign}[] }` shape some
 * engines (e.g. `grn`) expose in `detail`, without assuming every engine has it. */
export function extractNetwork(detail: unknown): { genes: string[]; edges: GraphEdge[] } | null {
  if (!detail || typeof detail !== 'object') return null;
  const d = detail as Record<string, unknown>;
  if (!Array.isArray(d.genes) || !Array.isArray(d.edges)) return null;
  if (!d.genes.every((g) => typeof g === 'string')) return null;
  const validEdge = (e: unknown): e is GraphEdge =>
    typeof e === 'object' &&
    e !== null &&
    typeof (e as GraphEdge).from === 'string' &&
    typeof (e as GraphEdge).to === 'string' &&
    ((e as GraphEdge).sign === 1 || (e as GraphEdge).sign === -1);
  if (!d.edges.every(validEdge)) return null;
  return { genes: d.genes as string[], edges: d.edges as GraphEdge[] };
}

/** Detects the bipartite `{ metabolites, reactions, stoichiometryEdges }` shape
 * `fba` exposes in `detail`, without assuming every engine has it. */
export function extractMetabolicNetwork(
  detail: unknown,
): { metabolites: string[]; reactions: string[]; edges: StoichiometryEdge[] } | null {
  if (!detail || typeof detail !== 'object') return null;
  const d = detail as Record<string, unknown>;
  if (
    !Array.isArray(d.metabolites) ||
    !Array.isArray(d.reactions) ||
    !Array.isArray(d.stoichiometryEdges)
  ) {
    return null;
  }
  if (!d.metabolites.every((m) => typeof m === 'string')) return null;
  if (!d.reactions.every((r) => typeof r === 'string')) return null;
  const validEdge = (e: unknown): e is StoichiometryEdge =>
    typeof e === 'object' &&
    e !== null &&
    typeof (e as StoichiometryEdge).metabolite === 'string' &&
    typeof (e as StoichiometryEdge).reaction === 'string' &&
    typeof (e as StoichiometryEdge).coefficient === 'number';
  if (!d.stoichiometryEdges.every(validEdge)) return null;
  return {
    metabolites: d.metabolites as string[],
    reactions: d.reactions as string[],
    edges: d.stoichiometryEdges as StoichiometryEdge[],
  };
}

/**
 * Detects any top-level `detail` field shaped like a categorical probability
 * distribution — an array of objects each carrying a `probability: number` plus
 * exactly one other string field (the class label). Requires the probabilities
 * to sum to ~1 so it fires on a real partition of outcomes, not a list of
 * independent per-item scores that merely happen to be named "probability".
 */
export function extractDistributions(
  detail: unknown,
): { key: string; title: string; rows: { label: string; probability: number }[] }[] {
  if (!detail || typeof detail !== 'object') return [];
  const charts: { key: string; title: string; rows: { label: string; probability: number }[] }[] =
    [];
  for (const [key, value] of Object.entries(detail as Record<string, unknown>)) {
    if (!Array.isArray(value) || value.length === 0) continue;
    const isRow = (v: unknown): v is Record<string, unknown> =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as Record<string, unknown>).probability === 'number';
    if (!value.every(isRow)) continue;
    const rows = value as Record<string, unknown>[];
    const labelKey = Object.keys(rows[0]).find(
      (k) => k !== 'probability' && typeof rows[0][k] === 'string',
    );
    if (!labelKey) continue;
    if (!rows.every((r) => typeof r[labelKey] === 'string')) continue;
    const sum = rows.reduce((s, r) => s + (r.probability as number), 0);
    if (Math.abs(sum - 1) > 1e-6) continue;
    charts.push({
      key,
      title: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      rows: rows.map((r) => ({
        label: r[labelKey] as string,
        probability: r.probability as number,
      })),
    });
  }
  return charts;
}

export function ResultView({ result: state }: { result: RunResult }) {
  const specs = useMemo(
    () => (state.result.series ?? []).map((s, i) => ({ i, spec: seriesToVegaLiteSpec(s) })),
    [state.result.series],
  );
  const network = useMemo(() => extractNetwork(state.result.detail), [state.result.detail]);
  const networkSpec = useMemo(
    () => (network ? networkGraphSpec(network.genes, network.edges) : null),
    [network],
  );
  const metabolicNetwork = useMemo(
    () => extractMetabolicNetwork(state.result.detail),
    [state.result.detail],
  );
  const metabolicSpec = useMemo(
    () =>
      metabolicNetwork
        ? metabolicNetworkSpec(
            metabolicNetwork.metabolites,
            metabolicNetwork.reactions,
            metabolicNetwork.edges,
          )
        : null,
    [metabolicNetwork],
  );
  const distributions = useMemo(
    () => extractDistributions(state.result.detail),
    [state.result.detail],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>{state.summary}</span>
          <code className="text-xs font-mono text-muted-foreground">
            hash {state.outputHash.slice(0, 16)}…
          </code>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {state.metrics.length > 0 && (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {state.metrics.map((m) => (
              <div key={m.key} className="border border-border rounded p-3">
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="text-lg font-mono">
                  {Number.isInteger(m.value) ? m.value : m.value.toPrecision(4)}
                  {m.unit && <span className="text-xs text-muted-foreground ml-1">{m.unit}</span>}
                </div>
                {m.note && <div className="text-xs text-muted-foreground mt-1">{m.note}</div>}
              </div>
            ))}
          </div>
        )}

        {networkSpec && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">Regulatory network topology</div>
            <VegaLiteEmbed spec={networkSpec} />
          </div>
        )}

        {metabolicSpec && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">
              Metabolic network (● metabolites, ■ reactions)
            </div>
            <VegaLiteEmbed spec={metabolicSpec} />
          </div>
        )}

        {distributions.map(({ key, title, rows }) => (
          <div key={key}>
            <div className="text-xs text-muted-foreground mb-2">{title}</div>
            <VegaLiteEmbed spec={distributionToVegaLiteSpec(rows, title)} />
          </div>
        ))}

        {specs.map(({ i, spec }) => (
          <VegaLiteEmbed key={i} spec={spec} />
        ))}

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Raw result JSON</summary>
          <pre className="mt-2 overflow-x-auto bg-muted/30 border border-border rounded p-3">
            {JSON.stringify(state.result, null, 2)}
          </pre>
        </details>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="muted">engine {state.engine}</Badge>
          <Badge variant="outline">v{state.version}</Badge>
          <code>input {state.inputHash.slice(0, 12)}…</code>
        </div>
      </CardContent>
    </Card>
  );
}
