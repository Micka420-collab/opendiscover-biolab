import { galleryEntries } from '@/content/gallery';
import { engines } from '@/lib/sim';
import Link from 'next/link';
import { buildPlaylist } from './playlist';
import { TvClient } from './tv-client';

export const metadata = {
  title: 'Lab TV — OpenDiscover BioLab',
  description:
    'A hands-off, auto-cycling showcase of community experiments running live. Leave it on stream.',
};

// Curated gallery runs lead; every remaining engine follows via its example — so
// Lab TV cycles the whole catalog, and grows automatically as either does.
export default function TvPage() {
  const playlist = buildPlaylist(galleryEntries, engines);

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
