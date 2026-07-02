import { OG_CONTENT_TYPE, OG_SIZE, experimentCard } from '@/lib/og/experiment-card';
import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'OpenDiscover BioLab — deterministic in-silico biology lab';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    experimentCard({
      eyebrow: 'in-silico · deterministic · no account',
      title: 'Invent biology, live.',
      subtitle:
        'A browser biotech lab where every run reproduces byte-for-byte — and is a shareable, remixable link.',
    }),
    { ...OG_SIZE },
  );
}
