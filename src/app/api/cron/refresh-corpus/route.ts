/**
 * Cron: nightly corpus refresh (03:00 UTC).
 *
 * Pulls recent papers from Europe PMC and ingests them into corpus_entries.
 * Each entry is embedded via embedClaim (title + abstract) and upserted on
 * (source, external_id) — so re-runs are idempotent.
 *
 * Auth: Vercel cron calls include "Authorization: Bearer <CRON_SECRET>".
 * We verify the bearer token on every request.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { embedClaim } from '@/lib/ai/embeddings';

export const runtime = 'nodejs';
export const maxDuration = 60;

/* ─── Europe PMC search ──────────────────────────────────────────────── */

interface EuropePmcResult {
  pmid?: string;
  doi?: string;
  title?: string;
  abstractText?: string;
}

interface EuropePmcResponse {
  resultList?: {
    result?: EuropePmcResult[];
  };
}

async function fetchEuropePmc(): Promise<
  { source: 'europepmc'; externalId: string; title: string; summary: string }[]
> {
  const url =
    'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=microbial+genomics+small+orf&format=json&pageSize=20&sort=date';

  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Europe PMC responded ${res.status}`);

  const data = (await res.json()) as EuropePmcResponse;
  const results = data?.resultList?.result ?? [];

  return results
    .filter((r) => (r.pmid ?? r.doi) != null && r.title)
    .map((r) => ({
      source: 'europepmc' as const,
      externalId: (r.pmid ?? r.doi)!,
      title: r.title!,
      summary: r.abstractText ?? '',
    }));
}

/* ─── Handler ────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET bearer token
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const entries = await fetchEuropePmc();
  if (entries.length === 0) {
    return NextResponse.json({ ingested: 0 });
  }

  let ingested = 0;

  for (const entry of entries) {
    try {
      const claim = `${entry.title} ${entry.summary}`.trim();
      const embedding = await embedClaim(claim);

      await db
        .insert(schema.corpusEntries)
        .values({
          source: entry.source,
          externalId: entry.externalId,
          title: entry.title,
          summary: entry.summary,
          metadata: { origin: 'europepmc-cron' },
          embedding,
        })
        .onConflictDoUpdate({
          target: [schema.corpusEntries.source, schema.corpusEntries.externalId],
          set: {
            metadata: sql`excluded.metadata`,
            embedding: sql`excluded.embedding`,
          },
        });

      ingested++;
    } catch {
      // Log and continue — a single failed entry shouldn't abort the batch.
      console.error(`[refresh-corpus] failed to ingest ${entry.externalId}`);
    }
  }

  return NextResponse.json({ ingested });
}
