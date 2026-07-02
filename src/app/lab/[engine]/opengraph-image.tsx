import { OG_CONTENT_TYPE, OG_SIZE, experimentCard } from '@/lib/og/experiment-card';
import { getEngine } from '@/lib/sim';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'OpenDiscover BioLab simulation engine';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Static per-engine card. Run-specific cards (with a headline metric + hash) are
// served by /api/lab/og, which the engine page wires in via generateMetadata when
// the URL carries a `?x=` token — the file convention can't see search params.
export default async function Image({ params }: { params: Promise<{ engine: string }> }) {
  const { engine } = await params;
  const spec = getEngine(engine);
  return new ImageResponse(
    experimentCard({
      eyebrow: spec ? spec.domain.replace(/-/g, ' ') : 'lab',
      title: spec ? spec.title : 'OpenDiscover BioLab',
      subtitle: spec
        ? `Run the ${spec.slug} engine — deterministic, no account, shareable as a link.`
        : 'Deterministic in-silico biology lab.',
    }),
    { ...OG_SIZE },
  );
}
