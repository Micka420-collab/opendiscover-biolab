'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ParamField } from '@/lib/lab/params-form';
import type { Metric, SimResult } from '@/lib/sim/core/types';
import { useMemo, useState } from 'react';
import { VegaChart, seriesToVegaLiteSpec } from '../vega-chart';

type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; inputHash: string; outputHash: string; result: SimResult }
  | { kind: 'error'; message: string; issues?: Array<{ path: string; message: string }> };

/** Coerce a raw form-field string back into the JS value its kind implies. */
function coerceFieldValue(field: ParamField, raw: string): unknown {
  if (raw === '' && field.optional) return undefined;
  switch (field.kind) {
    case 'number':
      return Number(raw);
    case 'boolean':
      return raw === 'true';
    case 'json':
      return JSON.parse(raw);
    default:
      return raw;
  }
}

function initialFieldValue(field: ParamField, example: Record<string, unknown>): string {
  const value = field.name in example ? example[field.name] : field.default;
  if (value === undefined) return '';
  if (field.kind === 'json') return JSON.stringify(value, null, 2);
  return String(value);
}

export function EnginePlayground({
  slug,
  fields,
  example,
}: {
  slug: string;
  fields: ParamField[];
  example: Record<string, unknown>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, initialFieldValue(f, example)])),
  );
  const [state, setState] = useState<RunState>({ kind: 'idle' });

  const chartSpecs = useMemo(() => {
    if (state.kind !== 'done') return [];
    const specs: Record<string, unknown>[] = [];
    if (state.result.vizSpec) specs.push(state.result.vizSpec);
    for (const series of state.result.series ?? []) specs.push(seriesToVegaLiteSpec(series));
    return specs;
  }, [state]);

  async function run() {
    setState({ kind: 'running' });
    let params: Record<string, unknown>;
    try {
      params = Object.fromEntries(
        fields
          .map((f) => [f.name, coerceFieldValue(f, values[f.name] ?? '')] as const)
          .filter(([, v]) => v !== undefined),
      );
    } catch (e) {
      setState({ kind: 'error', message: `Invalid JSON field: ${(e as Error).message}` });
      return;
    }

    try {
      const resp = await fetch('/api/lab/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: slug, params }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setState({
          kind: 'error',
          message: json.error ?? `HTTP ${resp.status}`,
          issues: json.issues?.map((i: { path: (string | number)[]; message: string }) => ({
            path: i.path.join('.') || '(root)',
            message: i.message,
          })),
        });
        return;
      }
      setState({
        kind: 'done',
        inputHash: json.inputHash,
        outputHash: json.outputHash,
        result: json.result as SimResult,
      });
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-6">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field) => (
            <label key={field.name} htmlFor={field.name} className="text-sm space-y-1 block">
              <span className="text-muted-foreground flex items-center justify-between">
                <span className="font-mono">{field.name}</span>
                {field.optional && <span className="text-xs">optional</span>}
              </span>
              {field.kind === 'boolean' ? (
                <select
                  id={field.name}
                  value={values[field.name]}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  className="w-full bg-muted/30 border border-border rounded px-2 py-1 font-mono text-xs"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : field.kind === 'enum' ? (
                <select
                  id={field.name}
                  value={values[field.name]}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  className="w-full bg-muted/30 border border-border rounded px-2 py-1 font-mono text-xs"
                >
                  {field.optional && <option value="">(unset)</option>}
                  {field.enumValues?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.kind === 'json' ? (
                <textarea
                  id={field.name}
                  value={values[field.name]}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  rows={3}
                  className="w-full bg-muted/30 border border-border rounded px-2 py-1 font-mono text-xs"
                />
              ) : (
                <input
                  id={field.name}
                  type={field.kind === 'number' ? 'number' : 'text'}
                  step={field.kind === 'number' && !field.integer ? 'any' : undefined}
                  min={field.min}
                  max={field.max}
                  value={values[field.name]}
                  onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  className="w-full bg-muted/30 border border-border rounded px-2 py-1 font-mono text-xs"
                />
              )}
              {field.description && (
                <span className="text-xs text-muted-foreground block">{field.description}</span>
              )}
            </label>
          ))}
          <Button onClick={run} disabled={state.kind === 'running'} className="w-full">
            {state.kind === 'running' ? 'Running…' : 'Run engine'}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {state.kind === 'idle' && (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
            Set parameters and run the engine to see results.
          </div>
        )}

        {state.kind === 'error' && (
          <Card>
            <CardContent className="pt-5 space-y-2">
              <p className="text-sm text-red-400">Error: {state.message}</p>
              {state.issues && (
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {state.issues.map((issue) => (
                    <li key={`${issue.path}-${issue.message}`}>
                      <code className="font-mono">{issue.path}</code>: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {state.kind === 'done' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Result</span>
                  <code className="text-xs font-mono text-muted-foreground">
                    {state.outputHash.slice(0, 16)}…
                  </code>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">{state.result.summary}</p>
                <MetricsGrid metrics={state.result.metrics} />
              </CardContent>
            </Card>

            {chartSpecs.map((spec, i) => (
              // Charts are order-stable per run (vizSpec then series in engine order); no id to key by.
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed set generated once per completed run
              <Card key={i}>
                <CardContent className="pt-5">
                  <VegaChart spec={spec} />
                </CardContent>
              </Card>
            ))}

            {state.result.detail !== undefined && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Detail</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
                    {JSON.stringify(state.result.detail, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MetricsGrid({ metrics }: { metrics: Metric[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {metrics.map((m) => (
        <div key={m.key} className="border border-border rounded p-2">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {m.label}
            {m.unit && <Badge variant="muted">{m.unit}</Badge>}
          </div>
          <div className="font-mono text-lg">{m.value.toFixed(4)}</div>
          {m.note && <div className="text-xs text-muted-foreground mt-0.5">{m.note}</div>}
        </div>
      ))}
    </div>
  );
}
