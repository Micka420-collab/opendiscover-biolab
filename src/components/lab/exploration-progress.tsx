'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type CatalogEntry,
  EXPLORED_EVENT,
  EXPLORED_STORAGE_KEY,
  computeAchievements,
  getExploredEngines,
} from '@/lib/lab/achievements';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface DexEntry extends CatalogEntry {
  title: string;
}

/**
 * Lab-wide exploration dex: how many engines you've run, which badges you've
 * unlocked, and a chip grid of the whole catalog with explored engines lit up.
 * Reads localStorage and live-updates when the playground records a run.
 */
export function ExplorationProgress({ catalog }: { catalog: DexEntry[] }) {
  const [explored, setExplored] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setExplored(getExploredEngines());
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === EXPLORED_STORAGE_KEY) refresh();
    };
    window.addEventListener(EXPLORED_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(EXPLORED_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const summary = useMemo(() => computeAchievements(explored, catalog), [explored, catalog]);
  const exploredSet = useMemo(() => new Set(explored), [explored]);
  const pct = summary.total > 0 ? Math.round((100 * summary.exploredCount) / summary.total) : 0;

  return (
    <Card className="border-accent/30 bg-accent/[0.03]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span>Your lab dex</span>
          <span className="text-sm font-normal text-muted-foreground">
            {summary.exploredCount}/{summary.total} engines · {summary.domainsCovered}/
            {summary.totalDomains} domains
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="h-1.5 w-full bg-muted/40 rounded overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>

        {/* Achievements */}
        <div className="flex flex-wrap gap-2">
          {summary.achievements.map((a) => (
            <div
              key={a.id}
              title={a.description}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                a.unlocked
                  ? 'border-accent/60 bg-accent/10 text-foreground'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <span className={a.unlocked ? '' : 'grayscale opacity-60'}>{a.icon}</span>
              <span>{a.name}</span>
              {!a.unlocked && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {a.have}/{a.need}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Dex chip grid */}
        <div className="flex flex-wrap gap-1.5">
          {catalog.map((e) => {
            const on = exploredSet.has(e.slug);
            return (
              <Link
                key={e.slug}
                href={`/lab/${e.slug}`}
                title={`${e.title}${on ? ' — explored · open to revisit' : ' — open to explore'}`}
                className={`rounded px-1.5 py-0.5 text-[10px] font-mono border transition-colors hover:border-accent hover:text-accent ${
                  on
                    ? 'border-accent/50 bg-accent/10 text-accent'
                    : 'border-border text-muted-foreground/60'
                }`}
              >
                {e.slug}
              </Link>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Tracked locally in your browser. Run any engine to light it up.
        </p>
      </CardContent>
    </Card>
  );
}
