import { NextResponse } from 'next/server';
import { count, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export const revalidate = 60;

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

  return NextResponse.json({ protocols });
}
