import { galleryEntries } from '@/content/gallery';
import Link from 'next/link';
import { TvClient } from './tv-client';

export const metadata = {
  title: 'Lab TV — OpenDiscover BioLab',
  description:
    'A hands-off, auto-cycling showcase of community experiments running live. Leave it on stream.',
};

// The playlist IS the community gallery — as it grows, so does Lab TV.
export default function TvPage() {
  const playlist = galleryEntries.map((e) => ({
    engine: e.engine,
    params: e.params,
    title: e.title,
    author: e.author,
    blurb: e.blurb,
    engineTitle: e.engineTitle,
    sharePath: e.sharePath,
  }));

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
