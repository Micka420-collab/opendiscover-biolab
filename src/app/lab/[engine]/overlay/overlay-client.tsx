'use client';

import { VegaLiteEmbed } from '@/components/charts/vega-lite-embed';
import { type RunResult, extractDistributions } from '@/components/lab/result-view';
import { distributionToVegaLiteSpec, seriesToVegaLiteSpec } from '@/lib/lab/charts';
import { useEffect, useRef, useState } from 'react';

type OverlayState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | ({ kind: 'done' } & RunResult);

function formatValue(value: number, unit?: string): string {
  const num = Number.isInteger(value) ? String(value) : value.toPrecision(4);
  return unit ? `${num} ${unit}` : num;
}

/**
 * OBS browser-source overlay. Auto-runs the shared experiment once on mount and
 * renders an oversized, translucent result card that reads over any stream.
 * Reuses the shared `extractDistributions` + chart specs so it never drifts from
 * the playground's result rendering.
 */
export function OverlayClient({
  engine,
  title,
  params,
}: {
  engine: string;
  title: string;
  params: Record<string, unknown> | null;
}) {
  const [state, setState] = useState<OverlayState>({ kind: params ? 'loading' : 'idle' });
  const started = useRef(false);

  useEffect(() => {
    if (!params || started.current) return;
    started.current = true;
    (async () => {
      try {
        const resp = await fetch('/api/lab/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ engine, params }),
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
        setState({ kind: 'done', ...(json as RunResult) });
      } catch (e) {
        setState({ kind: 'error', message: (e as Error).message });
      }
    })();
  }, [engine, params]);

  const chartSpec =
    state.kind === 'done'
      ? state.result.series && state.result.series.length > 0
        ? seriesToVegaLiteSpec(state.result.series[0])
        : (() => {
            const dists = extractDistributions(state.result.detail);
            return dists.length > 0
              ? distributionToVegaLiteSpec(dists[0].rows, dists[0].title)
              : null;
          })()
      : null;

  return (
    <div className="min-h-screen w-full flex items-end p-12">
      <div className="w-full max-w-4xl rounded-2xl border border-white/15 bg-black/65 backdrop-blur-md p-10 space-y-5 text-white shadow-2xl">
        <div className="flex items-center gap-3 text-sm uppercase tracking-widest text-emerald-400 font-mono">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" />
          OpenDiscover BioLab · {engine}
        </div>

        {state.kind === 'idle' && (
          <p className="text-2xl text-white/70">
            Append a <code className="text-emerald-400">?x=</code> experiment link to this URL to
            display a live run.
          </p>
        )}

        {state.kind === 'loading' && <p className="text-3xl text-white/70">Running {title}…</p>}

        {state.kind === 'error' && (
          <p className="text-2xl text-red-400" role="alert">
            {state.message}
          </p>
        )}

        {state.kind === 'done' && (
          <>
            <h1 className="text-4xl font-bold leading-tight">{state.summary}</h1>
            <div className="flex flex-wrap gap-6">
              {state.metrics.slice(0, 3).map((m) => (
                <div key={m.key}>
                  <div className="text-lg text-white/60">{m.label}</div>
                  <div className="text-5xl font-mono text-emerald-400">
                    {formatValue(m.value, m.unit)}
                  </div>
                </div>
              ))}
            </div>
            {chartSpec && (
              <div className="pt-2">
                <VegaLiteEmbed spec={chartSpec} />
              </div>
            )}
            <div className="text-sm font-mono text-white/50">
              reproducible · hash {state.outputHash.slice(0, 16)}…
            </div>
          </>
        )}
      </div>
    </div>
  );
}
