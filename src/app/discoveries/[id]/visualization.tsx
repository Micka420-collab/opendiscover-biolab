'use client';

import { VegaLiteEmbed } from '@/components/charts/vega-lite-embed';

export function DiscoveryVisualization({ spec }: { spec: object }) {
  return <VegaLiteEmbed spec={spec} />;
}
