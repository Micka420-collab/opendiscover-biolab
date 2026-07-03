import type { ReactNode } from 'react';

/**
 * The shared page header — one consistent rhythm and typography for every top-level page
 * (Lab, Gallery, Challenge, …). An optional accent eyebrow, a tracking-tight title with an
 * optional inline slot (e.g. a HelpTip), an intro paragraph, optional right-aligned actions,
 * and an optional small meta line beneath. Purely presentational.
 */
export function PageHeader({
  eyebrow,
  title,
  help,
  intro,
  actions,
  meta,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Rendered inline next to the title — typically a HelpTip. */
  help?: ReactNode;
  intro?: ReactNode;
  /** Right-aligned controls (e.g. a "Surprise me" button). */
  actions?: ReactNode;
  /** A small line beneath the intro (e.g. a provenance/how-it-works note). */
  meta?: ReactNode;
}) {
  return (
    <header className="space-y-3">
      {eyebrow && (
        <div className="text-xs uppercase tracking-widest text-accent font-mono">{eyebrow}</div>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {help}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {intro && <div className="text-muted-foreground max-w-2xl">{intro}</div>}
      {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
    </header>
  );
}
