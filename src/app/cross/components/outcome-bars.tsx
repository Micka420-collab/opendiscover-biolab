'use client';

/**
 * The true offspring distribution as colour-matched bars. Bars grow from zero on
 * reveal (unless reduced motion is requested), and the player's predicted look is
 * flagged — so "did I call it?" reads instantly.
 */

import { useEffect, useState } from 'react';
import type { PhenotypeShare } from '../lib/solve';

export function OutcomeBars({
  shares,
  colorFor,
  litterSize,
  pickedLabel,
  reduced,
}: {
  shares: PhenotypeShare[];
  colorFor: (label: string) => string;
  litterSize: number;
  pickedLabel?: string | null;
  reduced: boolean;
}) {
  const [grown, setGrown] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      setGrown(true);
      return;
    }
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  return (
    <ul className="space-y-2.5">
      {shares.map((s) => {
        const pct = s.probability * 100;
        const count = Math.round(s.probability * litterSize);
        const picked = pickedLabel != null && s.label === pickedLabel;
        const color = colorFor(s.label);
        return (
          <li key={s.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                <span className={picked ? 'font-semibold' : ''}>{s.label}</span>
                {picked && (
                  <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    your pick
                  </span>
                )}
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">
                {pct.toFixed(pct < 10 && pct > 0 ? 1 : 0)}%
                <span className="ml-1 opacity-60">
                  ≈{count}/{litterSize}
                </span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${reduced ? '' : 'transition-[width] duration-700 ease-out'}`}
                style={{ width: `${grown ? pct : 0}%`, background: color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
