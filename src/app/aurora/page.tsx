import type { Metadata } from 'next';
import { AuroraClient } from './aurora-client';
import { buildGauntlet } from './lib/gauntlet';

// The daily gauntlet is derived from today's (UTC) date — render per request.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AURORA — light the planet, one discovery at a time',
  description:
    'A live citizen-science discovery game: tune the science until it locks, and light the Earth. Five deterministic rounds a day, shared by everyone — built on OpenDiscover BioLab’s reproducible engines. As cool to watch as to play.',
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function AuroraPage({ searchParams }: { searchParams: SearchParams }) {
  const date = new Date().toISOString().slice(0, 10);
  const gauntlet = buildGauntlet(date);
  const sp = await searchParams;
  const litParam = typeof sp.lit === 'string' ? sp.lit : undefined;
  const mode: 'play' | 'watch' | 'endless' =
    sp.mode === 'watch' ? 'watch' : sp.mode === 'endless' ? 'endless' : 'play';

  return <AuroraClient gauntlet={gauntlet} date={date} litParam={litParam} mode={mode} />;
}
