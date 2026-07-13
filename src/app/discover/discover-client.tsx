'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClaimVerdict, ProbeResult, QuestView } from '@/lib/lab/discovery';
import { useEffect, useMemo, useState } from 'react';

interface Reading extends ProbeResult {
  key: number;
}
interface LogEntry {
  regimeId: string;
  label: string;
  isNovel: boolean;
  score: number;
  hash: string;
  rarity: number;
}
type Logbook = Record<string, Record<string, LogEntry>>;

const STORAGE_KEY = 'discover:logbook:v2';

const BAND_COLOR: Record<ProbeResult['band'], string> = {
  high: 'bg-red-500',
  low: 'bg-emerald-500',
  mid: 'bg-amber-500',
};

function tier(rarity: number, isNovel: boolean): { label: string; cls: string } {
  if (isNovel || rarity >= 0.8) return { label: 'Legendary', cls: 'text-fuchsia-400' };
  if (rarity >= 0.6) return { label: 'Rare', cls: 'text-sky-400' };
  if (rarity >= 0.35) return { label: 'Uncommon', cls: 'text-emerald-400' };
  return { label: 'Common', cls: 'text-muted-foreground' };
}

function loadLogbook(): Logbook {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Logbook;
  } catch {
    return {};
  }
}

export function DiscoverClient({ quests }: { quests: QuestView[] }) {
  const [questIdx, setQuestIdx] = useState(0);
  const quest = quests[questIdx];
  const axis = quest.axes[0];

  const [value, setValue] = useState(axis.base);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [verdict, setVerdict] = useState<ClaimVerdict | null>(null);
  const [busy, setBusy] = useState<null | 'probe' | 'claim'>(null);
  const [error, setError] = useState<string | null>(null);
  const [logbook, setLogbook] = useState<Logbook>({});

  // Load the persisted logbook once, on the client.
  useEffect(() => setLogbook(loadLogbook()), []);
  // Reset the in-round state when switching quests.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on quest change
  useEffect(() => {
    setValue(quest.axes[0].base);
    setReadings([]);
    setVerdict(null);
    setError(null);
  }, [questIdx]);

  const found = logbook[quest.slug] ?? {};
  const foundIds = useMemo(() => new Set(Object.keys(found)), [found]);
  const probesLeft = quest.probeBudget - readings.length;
  const questScore = useMemo(() => Object.values(found).reduce((s, e) => s + e.score, 0), [found]);
  const novelCount = useMemo(() => Object.values(found).filter((e) => e.isNovel).length, [found]);

  const catalogLabel = (id: string): string =>
    quest.knownCatalog.find((k) => k.id === id)?.name ??
    id.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

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
        setLogbook((prev) => {
          const entry: LogEntry = {
            regimeId: v.regime.id,
            label: v.regime.label,
            isNovel: v.isNovel,
            score: v.score,
            hash: v.hash,
            rarity: v.rarity,
          };
          const forQuest = { ...(prev[quest.slug] ?? {}) };
          // Keep the best score for a regime already found.
          if (!forQuest[v.regime.id] || forQuest[v.regime.id].score < v.score) {
            forQuest[v.regime.id] = entry;
          }
          const next = { ...prev, [quest.slug]: forQuest };
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Quest picker */}
      {quests.length > 1 && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Expedition:</span>
          <select
            value={questIdx}
            onChange={(e) => setQuestIdx(Number(e.target.value))}
            className="bg-muted/30 border border-border rounded px-2 py-1 text-sm"
          >
            {quests.map((q, i) => (
              <option key={q.slug} value={i}>
                {q.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <div>
        <h2 className="text-xl font-bold">{quest.title}</h2>
        <p className="text-sm text-muted-foreground max-w-3xl mt-1">{quest.brief}</p>
      </div>

      {/* Objectives */}
      <div className="flex flex-wrap gap-2">
        {quest.targets.map((t) => (
          <Badge key={t} variant={foundIds.has(t) ? 'success' : 'outline'}>
            {foundIds.has(t) ? '✓ ' : '◎ '}
            {catalogLabel(t)}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">Field map — {axis.label}</CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Probes: <span className="font-mono text-foreground">{probesLeft}</span>
            </span>
            <span>
              Regimes: <span className="font-mono text-foreground">{foundIds.size}</span>
            </span>
            <span>
              🌍 <span className="font-mono text-foreground">{novelCount}</span>
            </span>
            <span>
              Score: <span className="font-mono text-foreground">{questScore}</span>
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="relative h-12 rounded-md border border-border bg-muted/20">
              {readings.map((rd) => {
                const r = rd.params[axis.key] ?? 0;
                const left = ((r - axis.min) / (axis.max - axis.min)) * 100;
                return (
                  <span
                    key={rd.key}
                    title={`${axis.label}=${r.toFixed(3)} · ${rd.signalLabel}=${rd.signalValue.toFixed(3)} (${rd.band})`}
                    className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${BAND_COLOR[rd.band]}`}
                    style={{ left: `${left}%` }}
                  />
                );
              })}
              <span
                className="absolute top-0 h-full w-px bg-accent"
                style={{ left: `${((value - axis.min) / (axis.max - axis.min)) * 100}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>{axis.min}</span>
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
              {busy === 'claim' ? 'Claiming…' : `📌 Claim at ${axis.key}=${value.toFixed(3)}`}
            </Button>
            {probesLeft <= 0 && (
              <span className="text-xs text-amber-400">Out of probes — commit to a claim.</span>
            )}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}

          {readings.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Last reading: {readings[readings.length - 1].signalLabel} ={' '}
              <span className="font-mono text-foreground">
                {readings[readings.length - 1].signalValue.toFixed(4)}
              </span>
              . The exact regime stays hidden until you claim.
            </div>
          )}
        </CardContent>
      </Card>

      {verdict &&
        (() => {
          const t = tier(verdict.rarity, verdict.isNovel);
          return (
            <Card className={verdict.isNovel ? 'border-fuchsia-500/60' : 'border-emerald-500/40'}>
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={verdict.isNovel ? 'info' : 'success'}>
                    {verdict.isNovel ? '🌍 NOVEL FIND' : '✓ Identified'}
                  </Badge>
                  <span className="font-semibold">{verdict.regime.label}</span>
                  <span className={`text-xs font-medium ${t.cls}`}>{t.label}</span>
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
          );
        })()}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Regime logbook{' '}
          <span className="text-sm text-muted-foreground">({foundIds.size} found)</span>
        </h2>
        {foundIds.size === 0 ? (
          <p className="text-sm text-muted-foreground">
            Probe to sense the terrain, then claim to document a regime. Rare, off-catalogue regimes
            are the prize — the famous landmarks are already in the books.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.values(found).map((e) => {
              const t = tier(e.rarity, e.isNovel);
              return (
                <Badge key={e.regimeId} variant={e.isNovel ? 'info' : 'muted'}>
                  {e.isNovel ? '🌍 ' : ''}
                  <span className={t.cls}>{e.label}</span> · +{e.score}
                </Badge>
              );
            })}
          </div>
        )}
      </section>

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
          Anything you claim that is <em>not</em> in this list is a genuinely novel regime — its
          proof hash makes the find reproducible and, once a shared ledger is live, yours to claim
          first.
        </p>
      </section>
    </div>
  );
}
