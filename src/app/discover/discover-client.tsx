'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClaimVerdict, ProbeResult, QuestView } from '@/lib/lab/discovery';
import { useMemo, useState } from 'react';

interface Reading extends ProbeResult {
  /** Stable, unique key for React (probes are append-only, so the count works). */
  key: number;
}
interface LogEntry {
  regimeId: string;
  label: string;
  isNovel: boolean;
  score: number;
  hash: string;
}

const HINT_COLOR: Record<ProbeResult['hint'], string> = {
  chaotic: 'bg-red-500',
  periodic: 'bg-emerald-500',
  marginal: 'bg-amber-500',
};
const HINT_LABEL: Record<ProbeResult['hint'], string> = {
  chaotic: 'chaotic (λ > 0)',
  periodic: 'periodic (λ < 0)',
  marginal: 'on the edge (λ ≈ 0)',
};

export function DiscoverClient({ quest }: { quest: QuestView }) {
  const axis = quest.axes[0];
  const [value, setValue] = useState(axis.base);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [verdict, setVerdict] = useState<ClaimVerdict | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<null | 'probe' | 'claim'>(null);
  const [error, setError] = useState<string | null>(null);

  const probesLeft = quest.probeBudget - readings.length;
  const totalScore = useMemo(() => log.reduce((s, e) => s + e.score, 0), [log]);
  const novelCount = useMemo(() => log.filter((e) => e.isNovel).length, [log]);
  const foundIds = useMemo(() => new Set(log.map((e) => e.regimeId)), [log]);

  async function call(action: 'probe' | 'claim') {
    setBusy(action);
    setError(null);
    try {
      const resp = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quest: quest.slug,
          action,
          axisValues: { [axis.key]: value },
          probesUsed: readings.length,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      if (action === 'probe') {
        setReadings((prev) => [...prev, { ...(json.probe as ProbeResult), key: prev.length }]);
      } else {
        const v = json.verdict as ClaimVerdict;
        setVerdict(v);
        setLog((prev) =>
          prev.some((e) => e.regimeId === v.regime.id)
            ? prev
            : [
                ...prev,
                {
                  regimeId: v.regime.id,
                  label: v.regime.label,
                  isNovel: v.isNovel,
                  score: v.score,
                  hash: v.hash,
                },
              ],
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground max-w-3xl">{quest.brief}</p>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Field map</CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Probes left: <span className="font-mono text-foreground">{probesLeft}</span>
            </span>
            <span>
              Score: <span className="font-mono text-foreground">{totalScore}</span>
            </span>
            <span>
              🌍 Novel: <span className="font-mono text-foreground">{novelCount}</span>
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Hidden landscape — you only see the probes you spend. */}
          <div>
            <div className="relative h-12 rounded-md border border-border bg-muted/20">
              {readings.map((rd) => {
                const r = rd.params[axis.key] ?? 0;
                const left = ((r - axis.min) / (axis.max - axis.min)) * 100;
                return (
                  <span
                    key={rd.key}
                    title={`${axis.label}=${r.toFixed(3)} · ${HINT_LABEL[rd.hint]}`}
                    className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${HINT_COLOR[rd.hint]}`}
                    style={{ left: `${left}%` }}
                  />
                );
              })}
              {/* current selection marker */}
              <span
                className="absolute top-0 h-full w-px bg-accent"
                style={{ left: `${((value - axis.min) / (axis.max - axis.min)) * 100}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>
                {axis.label} = {axis.min}
              </span>
              <span>{axis.max}</span>
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">
              {axis.label}: <span className="font-mono text-foreground">{value.toFixed(3)}</span>
            </span>
            <input
              type="range"
              min={axis.min}
              max={axis.max}
              step={axis.step}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="w-full accent-[hsl(142_71%_45%)]"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => call('probe')} disabled={busy !== null || probesLeft <= 0}>
              {busy === 'probe' ? 'Probing…' : `🔬 Probe (${probesLeft} left)`}
            </Button>
            <Button variant="outline" onClick={() => call('claim')} disabled={busy !== null}>
              {busy === 'claim'
                ? 'Claiming…'
                : `📌 Claim discovery at ${axis.key}=${value.toFixed(3)}`}
            </Button>
            {probesLeft <= 0 && (
              <span className="text-xs text-amber-400">
                Out of probes — commit to a claim on your best guess.
              </span>
            )}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}

          {readings.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Last reading: λ ={' '}
              <span className="font-mono text-foreground">
                {readings[readings.length - 1].signalValue.toFixed(4)}
              </span>{' '}
              — {HINT_LABEL[readings[readings.length - 1].hint]}. The exact regime stays hidden
              until you claim.
            </div>
          )}
        </CardContent>
      </Card>

      {verdict && (
        <Card className={verdict.isNovel ? 'border-fuchsia-500/60' : 'border-emerald-500/40'}>
          <CardContent className="pt-5 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={verdict.isNovel ? 'info' : 'success'}>
                {verdict.isNovel ? '🌍 NOVEL FIND' : '✓ Identified'}
              </Badge>
              <span className="font-semibold">{verdict.regime.label}</span>
              <span className="text-xs text-muted-foreground">{verdict.regime.detail}</span>
              <span className="ml-auto text-sm">
                +<span className="font-mono">{verdict.score}</span>
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{verdict.message}</p>
            <code className="block text-[10px] text-muted-foreground break-all">
              proof {verdict.hash.slice(0, 32)}…
            </code>
          </CardContent>
        </Card>
      )}

      {/* Regime dex — every distinct regime you have documented. */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Regime logbook <span className="text-sm text-muted-foreground">({log.length} found)</span>
        </h2>
        {log.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Probe the parameter, then claim to document a regime. Rare periodic windows hidden in
            the chaos are the prize — the famous landmarks are already in the books.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {log.map((e) => (
              <Badge key={e.regimeId} variant={e.isNovel ? 'info' : 'muted'}>
                {e.isNovel ? '🌍 ' : ''}
                {e.label} · +{e.score}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* What the catalogue already knows — the "does it exist?" reference. */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Documented regimes (the known catalogue)</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {quest.knownCatalog.map((k) => (
            <div
              key={k.id}
              className={`rounded-md border p-3 text-xs ${
                foundIds.has(k.id) ? 'border-emerald-500/40' : 'border-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{k.name}</span>
                {foundIds.has(k.id) && <span className="text-emerald-400">found</span>}
              </div>
              <div className="text-muted-foreground mt-0.5">{k.citation}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Anything you claim that is <em>not</em> in this list is a genuinely novel regime — and its
          proof hash makes the find reproducible and, once a shared ledger is live, yours to claim
          first.
        </p>
      </section>
    </div>
  );
}
