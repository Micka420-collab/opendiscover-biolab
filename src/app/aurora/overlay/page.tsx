import type { Metadata } from 'next';
import { AuroraClient } from '../aurora-client';
import { buildGauntlet } from '../lib/gauntlet';

// The daily gauntlet is derived from today's (UTC) date — render per request.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AURORA — live stream view',
  description: 'A hands-free, auto-solving view of the discovery game for streaming. Leave it on.',
  robots: { index: false },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Watch mode: the deterministic auto-tuner solves round after round across the whole pool,
// forever — a stream that never idles. A ?lit= relay pre-lights the Earth cosmetically.
export default async function AuroraOverlayPage({ searchParams }: { searchParams: SearchParams }) {
  const date = new Date().toISOString().slice(0, 10);
  const gauntlet = buildGauntlet(date);
  const sp = await searchParams;
  const litParam = typeof sp.lit === 'string' ? sp.lit : undefined;

  return <AuroraClient gauntlet={gauntlet} date={date} litParam={litParam} mode="watch" />;
}
