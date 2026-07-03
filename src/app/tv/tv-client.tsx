'use client';

import { ResultView, type RunResult } from '@/components/lab/result-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PlaylistItem } from './playlist';

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | ({ kind: 'done' } & RunResult);

/**
 * Lab TV — a hands-off, auto-cycling showcase. Runs each playlist experiment
 * live, shows the result, dwells, then advances. Built for streamers to leave
 * running; reuses the shared ResultView so it never drifts from the playground.
 */
export function TvClient({ playlist, dwellMs }: { playlist: PlaylistItem[]; dwellMs: number }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [paused, setPaused] = useState(false);
  const item = playlist[index];

  // Run the current item whenever it changes.
  useEffect(() => {
    let cancelled = false;
    setPhase({ kind: 'loading' });
    (async () => {
      try {
        const resp = await fetch('/api/lab/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ engine: item.engine, params: item.params }),
        });
        const json = await resp.json();
        if (cancelled) return;
        if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
        setPhase({ kind: 'done', ...(json as RunResult) });
      } catch (e) {
        if (!cancelled) setPhase({ kind: 'error', message: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item]);

  // Auto-advance once the result is on screen (unless paused).
  useEffect(() => {
    if (paused) return;
    if (phase.kind === 'loading') return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % playlist.length), dwellMs);
    return () => clearTimeout(t);
  }, [phase, paused, dwellMs, playlist.length]);

  const go = (delta: number) => setIndex((i) => (i + delta + playlist.length) % playlist.length);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-accent font-mono">
          <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
          Lab TV · live
          <span className="text-muted-foreground">
            {index + 1}/{playlist.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-8" onClick={() => go(-1)}>
            ‹ Prev
          </Button>
          <Button variant="outline" className="h-8" onClick={() => setPaused((p) => !p)}>
            {paused ? '▶ Play' : '⏸ Pause'}
          </Button>
          <Button variant="outline" className="h-8" onClick={() => go(1)}>
            Next ›
          </Button>
        </div>
      </div>

      {/* Dwell progress bar — resets each item via the key. */}
      <div className="h-1 w-full bg-muted/40 rounded overflow-hidden">
        <div
          key={`${index}-${phase.kind}-${paused}`}
          className="h-full bg-accent"
          style={{
            width: phase.kind === 'done' && !paused ? '100%' : '0%',
            transition: phase.kind === 'done' && !paused ? `width ${dwellMs}ms linear` : 'none',
          }}
        />
      </div>

      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="muted">{item.engine}</Badge>
          <span className="text-xs text-muted-foreground">{item.engineTitle}</span>
          <span className="text-xs text-muted-foreground">· by {item.author}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
        <p className="text-sm text-muted-foreground max-w-3xl line-clamp-2">{item.blurb}</p>
        <Link href={item.sharePath} className="text-xs text-accent hover:underline">
          Open this run in the Lab →
        </Link>
      </header>

      {phase.kind === 'loading' && (
        <div
          className="rounded-lg border border-border bg-muted/20 p-6 text-sm text-muted-foreground animate-pulse"
          aria-busy="true"
        >
          Running {item.engineTitle}…
        </div>
      )}
      {phase.kind === 'error' && (
        <p className="text-sm text-red-400" role="alert">
          Error: {phase.message}
        </p>
      )}
      {phase.kind === 'done' && <ResultView result={phase} />}
    </div>
  );
}
