'use client';

import { useEffect, useRef } from 'react';

/**
 * A cohesive dark Vega-Lite theme matching the app (dark mode is always on): transparent
 * background so charts sit on the card, muted axes/gridlines tuned to the --border /
 * --muted-foreground tokens, the accent green (hsl(142 71% 45%) ≈ #22c55e) as the default mark,
 * and a vivid but harmonious category palette for multi-series charts. Applied once here at the
 * embed layer so EVERY engine chart is themed without touching (or retesting) the pure spec
 * builders in `charts.ts` / `network-chart.ts`; specs that set explicit colors (the regulatory
 * and metabolic network diagrams) keep their semantic encoding, since encoded scales override
 * config defaults.
 */
const CHART_THEME = {
  background: 'transparent',
  font: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
  view: { stroke: 'transparent' },
  line: { stroke: '#22c55e', strokeWidth: 2 },
  area: { fill: '#22c55e', fillOpacity: 0.15, line: { stroke: '#22c55e' } },
  path: { stroke: '#22c55e' },
  bar: { fill: '#22c55e', cornerRadiusEnd: 2 },
  rect: { fill: '#22c55e' },
  arc: { fill: '#22c55e' },
  point: { fill: '#22c55e', stroke: 'transparent', size: 40 },
  symbol: { fill: '#22c55e' },
  rule: { stroke: '#52525b' },
  text: { fill: '#e4e4e7' },
  axis: {
    domainColor: '#3f3f46',
    gridColor: '#27272a',
    gridOpacity: 0.7,
    tickColor: '#3f3f46',
    labelColor: '#a1a1aa',
    titleColor: '#d4d4d8',
    labelFontSize: 11,
    titleFontSize: 12,
    titleFontWeight: 500,
    titlePadding: 8,
  },
  legend: {
    labelColor: '#d4d4d8',
    titleColor: '#a1a1aa',
    labelFontSize: 11,
    titleFontSize: 11,
    symbolType: 'circle',
  },
  title: { color: '#fafafa', fontSize: 13, fontWeight: 600, anchor: 'start' as const },
  range: {
    category: [
      '#22c55e',
      '#38bdf8',
      '#f59e0b',
      '#a855f7',
      '#ef4444',
      '#14b8a6',
      '#ec4899',
      '#eab308',
    ],
  },
};

/** Lazily loads `vega-embed` (client-only, ~200KB) and renders any Vega-Lite spec, themed. */
export function VegaLiteEmbed({ spec }: { spec: object }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const vegaEmbed = (await import('vega-embed')).default;
      if (!ref.current || cancelled) return;
      // Merge the theme as the spec's Vega-Lite config; any config the spec already carries wins.
      const existing = (spec as { config?: Record<string, unknown> }).config ?? {};
      const themed = {
        ...(spec as Record<string, unknown>),
        config: { ...CHART_THEME, ...existing },
      };
      try {
        await vegaEmbed(ref.current, themed as never, { actions: false });
      } catch (e) {
        if (ref.current) {
          ref.current.innerHTML = `<div class="text-sm text-muted-foreground">Visualization failed to render: ${(e as Error).message}</div>`;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spec]);

  return <div ref={ref} className="w-full overflow-x-auto" />;
}
