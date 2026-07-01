'use client';

import { useEffect, useRef } from 'react';

export function DiscoveryVisualization({ spec }: { spec: object }) {
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
