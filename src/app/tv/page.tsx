import { galleryEntries } from '@/content/gallery';
import { engines } from '@/lib/sim';
import Link from 'next/link';
import { dailyPlaylist } from './playlist';
import { TvClient } from './tv-client';

export const metadata = {
  title: 'Lab TV — OpenDiscover BioLab',
  description:
    'A hands-off, auto-cycling showcase of community experiments running live. Leave it on stream.',
};

// Force a per-request render so the day seed is fresh (the channel re-orders daily).
export const dynamic = 'force-dynamic';

// Curated gallery runs lead; every remaining engine follows via its example — so
// Lab TV cycles the whole catalog. A per-day seed reshuffles each group so the
// channel opens on a different experiment every day, without ever dropping one.
export default function TvPage() {
  const daySeed = new Date().toISOString().slice(0, 10);
  const playlist = dailyPlaylist(galleryEntries, engines, daySeed);

  if (playlist.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No experiments to broadcast yet — add one to the{' '}
        <Link href="/gallery" className="text-accent hover:underline">
          gallery
        </Link>
        .
      </p>
    );
  }

  return <TvClient playlist={playlist} dwellMs={12000} />;
}
