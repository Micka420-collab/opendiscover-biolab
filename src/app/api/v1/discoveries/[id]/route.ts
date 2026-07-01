import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { limitSubmission } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Rate limit keyed by IP
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const rl = await limitSubmission(ip);
  if (!rl.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const { id } = await params;

  // Fetch discovery with protocol in one query
  const [row] = await db
    .select({
      id: schema.discoveries.id,
      title: schema.discoveries.title,
      summary: schema.discoveries.summary,
      cardMarkdown: schema.discoveries.cardMarkdown,
      noveltyScore: schema.discoveries.noveltyScore,
      noveltyReasoning: schema.discoveries.noveltyReasoning,
      status: schema.discoveries.status,
      doi: schema.discoveries.doi,
      citations: schema.discoveries.citations,
      createdAt: schema.discoveries.createdAt,
      protocolSlug: schema.protocols.slug,
      protocolTitle: schema.protocols.title,
      protocolDomain: schema.protocols.domain,
    })
    .from(schema.discoveries)
    .innerJoin(schema.protocols, eq(schema.discoveries.protocolId, schema.protocols.id))
    .where(eq(schema.discoveries.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Fetch distinct contributors via discoveryTriggers → submissions → users
  const contributorRows = await db
    .selectDistinct({ handle: schema.users.handle })
    .from(schema.discoveryTriggers)
    .innerJoin(
      schema.submissions,
      eq(schema.discoveryTriggers.submissionId, schema.submissions.id),
    )
    .innerJoin(schema.users, eq(schema.submissions.contributorId, schema.users.id))
    .where(eq(schema.discoveryTriggers.discoveryId, id));

  return NextResponse.json({
    id: row.id,
    title: row.title,
    summary: row.summary,
    cardMarkdown: row.cardMarkdown,
    noveltyScore: row.noveltyScore,
    noveltyReasoning: row.noveltyReasoning,
    status: row.status,
    doi: row.doi,
    citations: row.citations,
    protocol: {
      slug: row.protocolSlug,
      title: row.protocolTitle,
      domain: row.protocolDomain,
    },
    contributors: contributorRows.map((c) => ({ handle: c.handle })),
    createdAt: row.createdAt,
    export: {
      jsonLd: `/api/discoveries/${id}/export?format=json-ld`,
      bibtex: `/api/discoveries/${id}/export?format=bibtex`,
      roCrate: `/api/discoveries/${id}/export?format=ro-crate`,
    },
  });
}
