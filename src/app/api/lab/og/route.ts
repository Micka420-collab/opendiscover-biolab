/**
 * GET /api/lab/og?e=<engine>&x=<token>
 *
 * Dynamic Open Graph image for a *specific* shared run. Unlike the file-convention
 * `opengraph-image.tsx` (which can't see search params), a route handler receives
 * the `?x=` token, decodes it, re-runs the engine (pure, secret-free), and renders
 * the headline metric + reproducibility hash. Falls back to a generic engine card
 * — never errors — on a missing/invalid/mismatched token or unknown engine.
 */

import { runExperiment } from '@/lib/lab/runner';
import { decodeExperiment } from '@/lib/lab/share';
import { OG_SIZE, experimentCard } from '@/lib/og/experiment-card';
import { formatMetric } from '@/lib/og/format-metric';
import { buildSparkline } from '@/lib/og/sparkline';
import { getEngine } from '@/lib/sim';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const slug = params.get('e') ?? '';
  const token = params.get('x');
  const spec = getEngine(slug);

  if (!spec) {
    return new ImageResponse(
      experimentCard({
        eyebrow: 'lab',
        title: 'OpenDiscover BioLab',
        subtitle: 'Deterministic in-silico biology lab.',
      }),
      { ...OG_SIZE },
    );
  }

  const eyebrow = spec.domain.replace(/-/g, ' ');
  const decoded = decodeExperiment(token);

  if (decoded && decoded.engine === slug) {
    try {
      const record = await runExperiment(slug, decoded.params);
      const top = record.metrics[0];
      // Mini-chart of the run's first plotted series, if any — so each share card
      // previews a distinct shape rather than an identical text card.
      const s = record.result.series?.[0];
      const firstKey = s ? Object.keys(s.y)[0] : undefined;
      const sparkline =
        s && firstKey ? (buildSparkline(s.x, s.y[firstKey] ?? []) ?? undefined) : undefined;
      return new ImageResponse(
        experimentCard({
          eyebrow,
          title: spec.title,
          subtitle: record.summary,
          metric: top ? { label: top.label, value: formatMetric(top) } : undefined,
          hash: record.outputHash,
          sparkline,
        }),
        { ...OG_SIZE },
      );
    } catch {
      // fall through to the generic engine card
    }
  }

  return new ImageResponse(
    experimentCard({
      eyebrow,
      title: spec.title,
      subtitle: `Run the ${spec.slug} engine — deterministic, no account, shareable as a link.`,
    }),
    { ...OG_SIZE },
  );
}
