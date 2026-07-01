'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface LiveEvent {
  type: string;
  discoveryId: string;
  title?: string;
  summary?: string;
  noveltyScore?: number;
  at?: number;
}

export function LiveDiscoveryFeed({ initialEvents = [] }: { initialEvents?: LiveEvent[] }) {
  const [events, setEvents] = useState<LiveEvent[]>(initialEvents);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/realtime/discoveries');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener('discovery', (e) => {
      try {
        const ev = JSON.parse((e as MessageEvent).data) as LiveEvent;
        setEvents((prev) => [ev, ...prev].slice(0, 20));
      } catch {}
    });
    return () => es.close();
  }, []);

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Live discoveries</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
          {connected ? 'streaming' : 'reconnecting'}
        </div>
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Waiting for the next signal…</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li key={`${ev.discoveryId}-${ev.at}`} className="text-sm">
              <Link
                href={`/discoveries/${ev.discoveryId}`}
                className="block p-2 rounded hover:bg-muted/50 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 flex-1">{ev.title ?? ev.discoveryId}</span>
                  {ev.noveltyScore != null && (
                    <Badge variant="muted" className="shrink-0 font-mono">
                      {ev.noveltyScore.toFixed(2)}
                    </Badge>
                  )}
                </div>
                {ev.summary && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{ev.summary}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
