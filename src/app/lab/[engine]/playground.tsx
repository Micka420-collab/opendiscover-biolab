'use client';

import { VegaLiteEmbed } from '@/components/charts/vega-lite-embed';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { distributionToVegaLiteSpec, seriesToVegaLiteSpec } from '@/lib/lab/charts';
import {
  type GraphEdge,
  type StoichiometryEdge,
  metabolicNetworkSpec,
  networkGraphSpec,
} from '@/lib/lab/network-chart';
import type { Metric, ParamField, SimResult } from '@/lib/sim';
import { useMemo, useState } from 'react';

/** Detects the `{ genes: string[], edges: {from,to,sign}[] }` shape some
 * engines (e.g. `grn`) expose in `detail`, without assuming every engine has it. */
function extractNetwork(detail: unknown): { genes: string[]; edges: GraphEdge[] } | null {
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
function extractMetabolicNetwork(
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
 * distribution — an array of objects each carrying a `probability: number`
 * plus exactly one other string field (the class label), e.g. `breeding`'s
 * `phenotypeDistribution: { phenotype: string; probability: number }[]` or
 * `genotypeDistribution: { genotype: string; probability: number }[]`. Works
 * for any engine exposing this shape, not just `breeding` — same duck-typed
 * pattern as `extractNetwork`/`extractMetabolicNetwork` above.
 *
 * Requires the probabilities to sum to ~1: that's what distinguishes a real
 * partition of outcomes (chartable as one distribution) from a list of
 * independent per-item scores that merely happen to be named "probability"
 * (e.g. `secondary-structure`'s `turns[].probability`, one bend likelihood
 * per candidate tetrapeptide — those don't sum to 1 and aren't mutually
 * exclusive classes, so they must NOT be picked up here).
 */
function extractDistributions(
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

interface EngineView {
  slug: string;
  title: string;
  example: unknown;
  fields: ParamField[];
}

type FieldValue = string | number | boolean;

type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | {
      kind: 'done';
      engine: string;
      version: string;
      inputHash: string;
      outputHash: string;
      summary: string;
      metrics: Metric[];
      result: SimResult;
    }
  | { kind: 'error'; message: string };

/** Seed form state from the engine's documented example, falling back to each
 * field's own default. `json`-kind fields are kept as pretty-printed text. */
function initialValues(fields: ParamField[], example: unknown): Record<string, FieldValue> {
  const ex = (example as Record<string, unknown>) ?? {};
  const values: Record<string, FieldValue> = {};
  for (const field of fields) {
    const raw = field.name in ex ? ex[field.name] : field.default;
    if (raw === undefined) continue;
    if (field.kind === 'json') {
      values[field.name] = JSON.stringify(raw, null, 2);
    } else {
      values[field.name] = raw as FieldValue;
    }
  }
  return values;
}

function buildParams(
  fields: ParamField[],
  values: Record<string, FieldValue>,
): { params: Record<string, unknown>; error?: string } {
  const params: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.name];
    if (raw === undefined || raw === '') continue;
    if (field.kind === 'number') {
      const n = Number(raw);
      if (Number.isNaN(n)) return { params, error: `"${field.label}" must be a number` };
      params[field.name] = n;
    } else if (field.kind === 'boolean') {
      params[field.name] = Boolean(raw);
    } else if (field.kind === 'json') {
      try {
        params[field.name] = JSON.parse(String(raw));
      } catch {
        return { params, error: `"${field.label}" must be valid JSON` };
      }
    } else {
      params[field.name] = raw;
    }
  }
  return { params };
}

export function Playground({ engine }: { engine: EngineView }) {
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    initialValues(engine.fields, engine.example),
  );
  const [state, setState] = useState<RunState>({ kind: 'idle' });

  function setField(name: string, v: FieldValue) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }

  async function run() {
    const { params, error } = buildParams(engine.fields, values);
    if (error) {
      setState({ kind: 'error', message: error });
      return;
    }
    setState({ kind: 'running' });
    try {
      const resp = await fetch('/api/lab/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: engine.slug, params }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      setState({ kind: 'done', ...json });
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {engine.fields.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                value={values[field.name]}
                onChange={(v) => setField(field.name, v)}
              />
            ))}
          </div>
          <Button onClick={run} disabled={state.kind === 'running'}>
            {state.kind === 'running' ? 'Running…' : 'Run engine'}
          </Button>
          {state.kind === 'error' && <p className="text-sm text-red-400">{state.message}</p>}
        </CardContent>
      </Card>

      {state.kind === 'done' && <ResultView state={state} />}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ParamField;
  value: FieldValue | undefined;
  onChange: (v: FieldValue) => void;
}) {
  const inputClass = 'w-full bg-muted/30 border border-border rounded px-2 py-1 font-mono text-sm';

  if (field.kind === 'enum') {
    return (
      <label className="text-sm space-y-1 block">
        <FieldLabel field={field} />
        <select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.kind === 'boolean') {
    return (
      <label className="text-sm flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <FieldLabel field={field} />
      </label>
    );
  }

  if (field.kind === 'json') {
    return (
      <label className="text-sm space-y-1 block md:col-span-2">
        <FieldLabel field={field} />
        <textarea
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={`${inputClass} text-xs`}
        />
      </label>
    );
  }

  return (
    <label className="text-sm space-y-1 block">
      <FieldLabel field={field} />
      <input
        type={field.kind === 'number' ? 'number' : 'text'}
        value={(value as string | number) ?? ''}
        min={field.kind === 'number' ? field.min : undefined}
        max={field.kind === 'number' ? field.max : undefined}
        step={field.kind === 'number' && !field.integer ? 'any' : undefined}
        onChange={(e) =>
          onChange(field.kind === 'number' ? e.target.valueAsNumber : e.target.value)
        }
        className={inputClass}
      />
    </label>
  );
}

function FieldLabel({ field }: { field: ParamField }) {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5" title={field.description}>
      {field.label}
      {!field.optional && <span className="text-red-400">*</span>}
    </span>
  );
}

function ResultView({ state }: { state: Extract<RunState, { kind: 'done' }> }) {
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
