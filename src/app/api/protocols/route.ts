import { db, schema } from '@/lib/db';
import { desc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

// Dynamic (not statically generated): this reads live data on every request,
// so it must never be executed at build time (when the database may not yet
// be reachable). Edge caching is still achieved via the Cache-Control header.
export const dynamic = 'force-dynamic';

export async function GET() {
  const protocols = await db
    .select({
      id: schema.protocols.id,
      slug: schema.protocols.slug,
      version: schema.protocols.version,
      title: schema.protocols.title,
      description: schema.protocols.description,
      domain: schema.protocols.domain,
      status: schema.protocols.status,
      runnerKind: schema.protocols.runnerKind,
      submissions: sql<number>`(SELECT COUNT(*) FROM ${schema.submissions} WHERE ${schema.submissions.protocolId} = ${schema.protocols.id})`,
      discoveries: sql<number>`(SELECT COUNT(*) FROM ${schema.discoveries} WHERE ${schema.discoveries.protocolId} = ${schema.protocols.id})`,
    })
    .from(schema.protocols)
    .where(eq(schema.protocols.enabled, true))
    .orderBy(desc(schema.protocols.createdAt));

  return NextResponse.json(
    { protocols },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
  );
}
