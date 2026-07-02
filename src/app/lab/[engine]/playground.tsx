'use client';

import { ResultView, type RunResult } from '@/components/lab/result-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { recordEngineRun } from '@/lib/lab/achievements';
import { experimentOverlayPath, experimentSharePath } from '@/lib/lab/share';
import type { ParamField } from '@/lib/sim';
import { useEffect, useRef, useState } from 'react';

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
  | ({ kind: 'done' } & RunResult)
  | { kind: 'error'; message: string };

/** Seed form state from the engine's documented example, falling back to each
 * field's own default. An `override` (from a shared/remixed permalink) takes
 * precedence over both. `json`-kind fields are kept as pretty-printed text. */
function initialValues(
  fields: ParamField[],
  example: unknown,
  override?: Record<string, unknown>,
): Record<string, FieldValue> {
  const ex = (example as Record<string, unknown>) ?? {};
  const ov = override ?? {};
  const values: Record<string, FieldValue> = {};
  for (const field of fields) {
    const raw =
      field.name in ov ? ov[field.name] : field.name in ex ? ex[field.name] : field.default;
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

export function Playground({
  engine,
  initialParams,
}: {
  engine: EngineView;
  initialParams?: Record<string, unknown>;
}) {
  const [values, setValues] = useState<Record<string, FieldValue>>(() =>
    initialValues(engine.fields, engine.example, initialParams),
  );
  const [state, setState] = useState<RunState>({ kind: 'idle' });
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const openedFromShare = initialParams != null;

  function setField(name: string, v: FieldValue) {
    setValues((prev) => ({ ...prev, [name]: v }));
    setShareMsg(null);
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
      setState({ kind: 'done', ...(json as RunResult) });
      recordEngineRun(engine.slug); // light this engine up in the lab dex
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }

  /** Copy a permalink that reproduces the *current* parameters exactly. */
  async function share() {
    const { params, error } = buildParams(engine.fields, values);
    if (error) {
      setState({ kind: 'error', message: error });
      return;
    }
    const path = experimentSharePath({ engine: engine.slug, params });
    const url =
      typeof window !== 'undefined' ? new URL(path, window.location.origin).toString() : path;
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg('Link copied — whoever opens it reproduces this exact run, then can remix it.');
    } catch {
      setShareMsg(url);
    }
  }

  /** Open the current run as a transparent OBS browser-source overlay. */
  function openOverlay() {
    const { params, error } = buildParams(engine.fields, values);
    if (error) {
      setState({ kind: 'error', message: error });
      return;
    }
    if (typeof window !== 'undefined') {
      window.open(experimentOverlayPath({ engine: engine.slug, params }), '_blank', 'noopener');
    }
  }

  /** Copy the transparent-overlay URL for pasting straight into an OBS Browser Source. */
  async function copyOverlayUrl() {
    const { params, error } = buildParams(engine.fields, values);
    if (error) {
      setState({ kind: 'error', message: error });
      return;
    }
    const path = experimentOverlayPath({ engine: engine.slug, params });
    const url =
      typeof window !== 'undefined' ? new URL(path, window.location.origin).toString() : path;
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg(
        'Overlay URL copied — add a Browser Source in OBS (1920×1080, transparent background).',
      );
    } catch {
      setShareMsg(url);
    }
  }

  // Opened from a shared/remixed link: reproduce the run immediately so the
  // viewer lands on the result, not an unrun form. Runs once, on mount.
  const didAutoRun = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally mount-only — reproduce the shared run once
  useEffect(() => {
    if (openedFromShare && !didAutoRun.current) {
      didAutoRun.current = true;
      void run();
    }
  }, []);

  return (
    <div className="space-y-6">
      {openedFromShare && (
        <div className="rounded-md border border-accent/40 bg-accent/5 px-4 py-2 text-sm text-muted-foreground">
          🔗 Opened from a shared experiment — the parameters below reproduce it exactly. Tweak
          anything and hit <span className="text-foreground font-medium">Share / Remix</span> to
          pass on your own version.
        </div>
      )}
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={run}
              disabled={state.kind === 'running'}
              aria-busy={state.kind === 'running'}
            >
              {state.kind === 'running' ? 'Running…' : 'Run engine'}
            </Button>
            <Button variant="outline" onClick={share} disabled={state.kind === 'running'}>
              🔗 Share / Remix
            </Button>
            <Button variant="outline" onClick={openOverlay} disabled={state.kind === 'running'}>
              📺 OBS overlay
            </Button>
            <Button variant="outline" onClick={copyOverlayUrl} disabled={state.kind === 'running'}>
              📋 Copy overlay URL
            </Button>
          </div>
          {shareMsg && <p className="text-sm text-accent break-all">{shareMsg}</p>}
          {state.kind === 'error' && (
            <p className="text-sm text-red-400" role="alert">
              Error: {state.message}
            </p>
          )}
        </CardContent>
      </Card>

      {state.kind === 'idle' && (
        <p className="text-sm text-muted-foreground">
          Set parameters and hit <span className="text-foreground">Run engine</span> to see metrics,
          charts, and the reproducibility hash. Then{' '}
          <span className="text-foreground">Share / Remix</span> to hand the exact run to someone
          else.
        </p>
      )}

      {state.kind === 'done' && <ResultView result={state} />}
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
  const descId = field.description ? `${field.name}-desc` : undefined;
  const helper = field.description ? (
    <span id={descId} className="text-[11px] text-muted-foreground">
      {field.description}
    </span>
  ) : null;

  if (field.kind === 'enum') {
    return (
      <label className="text-sm space-y-1 block">
        <FieldLabel field={field} />
        <select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          aria-describedby={descId}
          aria-required={!field.optional}
        >
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {helper}
      </label>
    );
  }

  if (field.kind === 'boolean') {
    return (
      <label className="text-sm space-y-1 block">
        <span className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            aria-describedby={descId}
          />
          <FieldLabel field={field} />
        </span>
        {helper}
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
          aria-describedby={descId}
          aria-required={!field.optional}
        />
        {helper}
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
        aria-describedby={descId}
        aria-required={!field.optional}
      />
      {helper}
    </label>
  );
}

function FieldLabel({ field }: { field: ParamField }) {
  return (
    <span className="text-muted-foreground flex items-center gap-1.5">
      {field.label}
      {!field.optional && (
        <span className="text-red-400" aria-hidden="true">
          *
        </span>
      )}
    </span>
  );
}
