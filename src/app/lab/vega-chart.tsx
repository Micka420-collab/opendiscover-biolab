'use client';

import { useEffect, useRef } from 'react';

/** Renders a Vega-Lite spec client-side. Same pattern as the Discovery Card viz. */
export function VegaChart({ spec }: { spec: object }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const vegaEmbed = (await import('vega-embed')).default;
      if (!ref.current || cancelled) return;
      try {
        await vegaEmbed(ref.current, spec as never, { actions: false });
      } catch (e) {
        if (ref.current) {
          ref.current.innerHTML = `<div class="text-sm text-muted-foreground">Chart failed to render: ${(e as Error).message}</div>`;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spec]);

  return <div ref={ref} className="w-full overflow-x-auto" />;
}

/** Build a Vega-Lite line-chart spec from a SimResult series, x-vs-each-y line. */
export function seriesToVegaLiteSpec(series: {
  x: number[];
  y: Record<string, number[]>;
  xLabel?: string;
  yLabel?: string;
}): Record<string, unknown> {
  const values: Array<{ x: number; y: number; channel: string }> = [];
  for (const [channel, ys] of Object.entries(series.y)) {
    for (let i = 0; i < series.x.length; i++) {
      values.push({ x: series.x[i], y: ys[i], channel });
    }
  }
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: 'container',
    height: 260,
    data: { values },
    mark: { type: 'line', point: values.length < 200 },
    encoding: {
      x: { field: 'x', type: 'quantitative', title: series.xLabel ?? 'x' },
      y: { field: 'y', type: 'quantitative', title: series.yLabel ?? 'value' },
      color: { field: 'channel', type: 'nominal', title: 'series' },
    },
  };
}
