'use client';

/**
 * A small "?" affordance that opens a plain-language explanation — the in-app help that
 * makes the lab approachable to anyone, no background required. Accessible: a real button
 * with aria-expanded/controls, a labelled popover, dismissed on Escape or an outside click,
 * keyboard-operable throughout.
 */

import type { HelpCard } from '@/lib/lab/help-content';
import { useEffect, useId, useRef, useState } from 'react';

export function HelpTip({
  title,
  children,
  side = 'right',
  className,
}: {
  /** Accessible label / popover heading — what the "?" explains. */
  title: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={`relative inline-flex align-middle ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`What is this? ${title}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-semibold leading-none text-muted-foreground hover:text-accent hover:border-accent transition-colors"
      >
        ?
      </button>
      {open && (
        // Disclosure pattern: the trigger button carries aria-expanded + aria-controls,
        // so the revealed panel needs no ARIA role of its own (avoids a native <dialog>).
        <div
          id={panelId}
          className={`absolute top-6 z-50 w-72 max-w-[80vw] rounded-lg border border-border bg-background p-3 text-left shadow-xl ${
            side === 'right' ? 'left-0' : 'right-0'
          }`}
        >
          <div className="mb-1 flex items-start justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent">
              {title}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close explanation"
              className="text-muted-foreground hover:text-foreground text-sm leading-none"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </span>
  );
}

/** Renders a {@link HelpCard} — what you're doing, why it matters, how to find it, glossary. */
export function HelpCardBody({ card }: { card: HelpCard }) {
  return (
    <div className="space-y-2 text-sm text-foreground">
      <p>
        <span className="text-muted-foreground">What you're doing — </span>
        {card.plainWhat}
      </p>
      <p>
        <span className="text-muted-foreground">Why it matters — </span>
        {card.plainWhy}
      </p>
      <p>
        <span className="text-muted-foreground">How to find it — </span>
        {card.plainHow}
      </p>
      {card.terms.length > 0 && (
        <dl className="border-t border-border pt-2 text-xs">
          {card.terms.map((t) => (
            <div key={t.term} className="flex gap-1">
              <dt className="font-semibold text-foreground">{t.term}:</dt>
              <dd className="text-muted-foreground">{t.meaning}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
