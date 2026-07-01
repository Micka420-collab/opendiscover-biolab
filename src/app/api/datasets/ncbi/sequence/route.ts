/**
 * NCBI sequence slice proxy.
 *
 * Fetches a slice from NCBI E-utilities EFetch, returns FASTA + JSON metadata.
 * Cached aggressively (24h) via Vercel runtime cache + s-maxage on response.
 *
 * Why a proxy:
 *   - Avoid leaking the user's IP to NCBI; rate-limit is shared via our API key.
 *   - Cache identical slice requests across all contributors so a popular
 *     genome window is fetched once.
 *   - Sanitize input — only fetch slices, no metadata bombs.
 */

import { unstable_cache } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const params = z.object({
  accession: z.string().regex(/^[A-Z0-9_.]+$/i, 'invalid accession'),
  start: z.coerce.number().int().min(1),
  stop: z.coerce.number().int().min(1),
  strand: z.enum(['1', '2']).default('1'),
});

export const runtime = 'nodejs';
export const maxDuration = 30;

const fetchSlice = unstable_cache(
  async (accession: string, start: number, stop: number, strand: string) => {
    const url = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi');
    url.searchParams.set('db', 'nuccore');
    url.searchParams.set('id', accession);
    url.searchParams.set('seq_start', String(start));
    url.searchParams.set('seq_stop', String(stop));
    url.searchParams.set('strand', strand);
    url.searchParams.set('rettype', 'fasta');
    url.searchParams.set('retmode', 'text');
    if (process.env.NCBI_API_KEY) url.searchParams.set('api_key', process.env.NCBI_API_KEY);

    const resp = await fetch(url, { headers: { Accept: 'text/plain' } });
    if (!resp.ok) throw new Error(`NCBI returned ${resp.status}`);
    const fasta = await resp.text();
    return parseFasta(fasta);
  },
  ['ncbi-slice'],
  { revalidate: 60 * 60 * 24 }, // 24h
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = params.safeParse({
    accession: url.searchParams.get('accession'),
    start: url.searchParams.get('start'),
    stop: url.searchParams.get('stop'),
    strand: url.searchParams.get('strand') ?? '1',
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', details: parsed.error.format() },
      { status: 400 },
    );
  }
  const { accession, start, stop, strand } = parsed.data;
  if (stop <= start) {
    return NextResponse.json({ error: 'stop must be > start' }, { status: 400 });
  }
  if (stop - start > 200_000) {
    return NextResponse.json({ error: 'slice too large (max 200kb)' }, { status: 400 });
  }
  try {
    const parsedFasta = await fetchSlice(accession, start, stop, strand);
    return NextResponse.json(parsedFasta, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

function parseFasta(text: string): { header: string; sequence: string } {
  const lines = text.split(/\r?\n/);
  const headerLine = lines.find((l) => l.startsWith('>')) ?? '';
  const seq = lines
    .filter((l) => !l.startsWith('>'))
    .join('')
    .toUpperCase()
    .replace(/[^ACGTN]/g, '');
  return { header: headerLine.slice(1), sequence: seq };
}
