import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const protocols = await db
    .select({
      slug: schema.protocols.slug,
      version: schema.protocols.version,
      title: schema.protocols.title,
      description: schema.protocols.description,
      domain: schema.protocols.domain,
      runnerKind: schema.protocols.runnerKind,
      inputSchema: schema.protocols.inputSchema,
    })
    .from(schema.protocols)
    .where(eq(schema.protocols.status, 'active'));

  return NextResponse.json(
    { data: protocols },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  );
}
