import { SHARE_PARAM, decodeExperiment } from '@/lib/lab/share';
import { getEngine } from '@/lib/sim';
import { notFound } from 'next/navigation';
import { OverlayClient } from './overlay-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ engine: string }> }) {
  const { engine } = await params;
  const spec = getEngine(engine);
  return {
    title: spec ? `${spec.title} — Overlay` : 'Overlay',
    robots: { index: false },
  };
}

export default async function OverlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ engine: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { engine } = await params;
  const spec = getEngine(engine);
  if (!spec) notFound();

  const sp = await searchParams;
  const token = typeof sp[SHARE_PARAM] === 'string' ? sp[SHARE_PARAM] : undefined;
  const shared = decodeExperiment(token);
  const initialParams = shared && shared.engine === engine ? shared.params : null;

  return <OverlayClient engine={engine} title={spec.title} params={initialParams} />;
}
