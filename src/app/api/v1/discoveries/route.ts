import { type NextRequest, NextResponse } from 'next/server';
import { and, count, desc, eq, gte, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { limitSubmission } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  domain: z.string().optional(),
  status: z.enum(['provisional', 'confirmed', 'disputed']).optional(),
  q: z.string().optional(),
  min_score: z.coerce.number().min(0).max(1).optional(),
});

export async function GET(req: NextRequest) {
  // Rate limit keyed by IP
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const rl = await limitSubmission(ip);
  if (!rl.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // Parse & validate query params
  const raw = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_params', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { page, limit, domain, status, q, min_score: minScore } = parsed.data;
  const offset = (page - 1) * limit;

  // Build shared WHERE conditions
  const conditions = [
    // Only promoted discoveries are public
    ...(status
      ? [eq(schema.discoveries.status, status as 'provisional' | 'confirmed' | 'disputed')]
      : []),
    ...(q ? [ilike(schema.discoveries.title, `%${q}%`)] : []),
    ...(minScore !== undefined ? [gte(schema.discoveries.noveltyScore, minScore)] : []),
    ...(domain ? [eq(schema.protocols.domain, domain)] : []),
  ];

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Run data query and COUNT in parallel
  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: schema.discoveries.id,
        title: schema.discoveries.title,
        summary: schema.discoveries.summary,
        noveltyScore: schema.discoveries.noveltyScore,
        status: schema.discoveries.status,
        doi: schema.discoveries.doi,
        createdAt: schema.discoveries.createdAt,
        protocolSlug: schema.protocols.slug,
        protocolDomain: schema.protocols.domain,
      })
      .from(schema.discoveries)
      .innerJoin(schema.protocols, eq(schema.discoveries.protocolId, schema.protocols.id))
      .where(whereClause)
      .orderBy(desc(schema.discoveries.createdAt))
      .limit(limit)
      .offset(offset),

    db
      .select({ total: count() })
      .from(schema.discoveries)
      .innerJoin(schema.protocols, eq(schema.discoveries.protocolId, schema.protocols.id))
      .where(whereClause),
  ]);

  const total = Number(countRow?.total ?? 0);

  const data = rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    noveltyScore: row.noveltyScore,
    status: row.status,
    protocol: {
      slug: row.protocolSlug,
      domain: row.protocolDomain,
    },
    doi: row.doi,
    createdAt: row.createdAt,
    href: `https://opendiscover.science/discoveries/${row.id}`,
  }));

  return NextResponse.json(
    { data, meta: { page, limit, total } },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  );
}
