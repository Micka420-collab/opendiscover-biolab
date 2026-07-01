/**
 * Typed queries — including pgvector kNN via Drizzle's `sql` builder.
 *
 * Uses HNSW indexes (declared in drizzle/0001_pgvector_indexes.sql) for
 * sub-10ms cosine-distance retrieval at our scale.
 */

import type { CorpusNeighbor } from '@/lib/ai/novelty';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index';
import { corpusEntries, discoveries, protocols, submissions, users } from './schema';

/* ─── Vector kNN ─────────────────────────────────────────────────────── */

const vectorLit = (v: number[]) => sql.raw(`'[${v.join(',')}]'::vector`);

export async function nearestCorpus(embedding: number[], limit = 12): Promise<CorpusNeighbor[]> {
  const v = vectorLit(embedding);
  const rows = await db
    .select({
      id: corpusEntries.id,
      source: corpusEntries.source,
      externalId: corpusEntries.externalId,
      title: corpusEntries.title,
      summary: corpusEntries.summary,
      distance: sql<number>`${corpusEntries.embedding} <=> ${v}`.as('distance'),
    })
    .from(corpusEntries)
    .where(sql`${corpusEntries.embedding} IS NOT NULL`)
    .orderBy(sql`${corpusEntries.embedding} <=> ${v}`)
    .limit(limit);

  return rows.map((r) => ({
    externalId: r.externalId,
    source: r.source,
    title: r.title,
    summary: r.summary,
    similarity: 1 - Number(r.distance),
  }));
}

export async function nearestSubmissions(args: {
  embedding: number[];
  protocolId: string;
  excludeId: string;
  limit?: number;
}) {
  const v = vectorLit(args.embedding);
  return db
    .select({
      id: submissions.id,
      contributorId: submissions.contributorId,
      sliceKey: submissions.sliceKey,
      embedding: submissions.embedding,
      rawOutput: submissions.rawOutput,
    })
    .from(submissions)
    .where(
      and(
        eq(submissions.protocolId, args.protocolId),
        sql`${submissions.id} != ${args.excludeId}`,
        sql`${submissions.embedding} IS NOT NULL`,
        inArray(submissions.status, ['triaged_interesting', 'promoted']),
      ),
    )
    .orderBy(sql`${submissions.embedding} <=> ${v}`)
    .limit(args.limit ?? 100);
}

/* ─── Discovery feed ─────────────────────────────────────────────────── */

export async function recentDiscoveries(limit = 50) {
  return db
    .select({
      id: discoveries.id,
      title: discoveries.title,
      summary: discoveries.summary,
      noveltyScore: discoveries.noveltyScore,
      status: discoveries.status,
      createdAt: discoveries.createdAt,
      authorHandle: users.handle,
      protocolSlug: protocols.slug,
      protocolTitle: protocols.title,
    })
    .from(discoveries)
    .innerJoin(users, eq(users.id, discoveries.authorId))
    .innerJoin(protocols, eq(protocols.id, discoveries.protocolId))
    .orderBy(desc(discoveries.noveltyScore), desc(discoveries.createdAt))
    .limit(limit);
}

export async function discoveryById(id: string) {
  const [row] = await db.select().from(discoveries).where(eq(discoveries.id, id)).limit(1);
  return row;
}

/* ─── Convenience updaters ───────────────────────────────────────────── */

export async function setSubmissionEmbedding(submissionId: string, embedding: number[]) {
  const v = vectorLit(embedding);
  await db
    .update(submissions)
    .set({ embedding: sql`${v}` })
    .where(eq(submissions.id, submissionId));
}
