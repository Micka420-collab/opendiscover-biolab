import { DiscoveryFilters } from '@/components/discovery/discovery-filters';
import { LiveDiscoveryFeed } from '@/components/discovery/live-feed';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db, schema } from '@/lib/db';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

const FALLBACK_DOMAINS = ['Genomics'];

const FALLBACK_DISCOVERIES = [
  {
    id: 'fallback-1',
    title: 'Sample promoted discovery',
    summary: 'A provisional example discovery used when the database is unavailable.',
    noveltyScore: 0.512,
    status: 'provisional',
    createdAt: new Date().toISOString(),
    authorHandle: 'demo-user',
    protocolTitle: 'Small ORF Mining v1',
  },
];

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'muted'> = {
  provisional: 'warning',
  under_review: 'info',
  confirmed: 'success',
  disputed: 'warning',
  refuted: 'danger',
  retracted: 'muted',
};

type SearchParams = {
  q?: string;
  domain?: string;
  status?: string;
  sort?: string;
};

async function fetchDomains(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ domain: schema.protocols.domain })
    .from(schema.protocols)
    .orderBy(schema.protocols.domain);
  return rows.map((r) => r.domain);
}

async function fetchDiscoveries(params: SearchParams) {
  const { q, domain, status, sort } = params;

  const conditions = [];

  if (q) {
    conditions.push(
      or(
        ilike(schema.discoveries.title, `%${q}%`),
        sql`to_tsvector('english', ${schema.discoveries.title} || ' ' || ${schema.discoveries.summary}) @@ plainto_tsquery('english', ${q})`,
      ),
    );
  }

  if (status) {
    conditions.push(
      eq(schema.discoveries.status, status as typeof schema.discoveries.status._.data),
    );
  }

  const orderBy =
    sort === 'score'
      ? [desc(schema.discoveries.noveltyScore), desc(schema.discoveries.createdAt)]
      : [desc(schema.discoveries.createdAt), desc(schema.discoveries.noveltyScore)];

  if (domain) {
    return db
      .select({
        id: schema.discoveries.id,
        title: schema.discoveries.title,
        summary: schema.discoveries.summary,
        noveltyScore: schema.discoveries.noveltyScore,
        status: schema.discoveries.status,
        createdAt: schema.discoveries.createdAt,
        authorHandle: schema.users.handle,
        protocolTitle: schema.protocols.title,
      })
      .from(schema.discoveries)
      .innerJoin(schema.users, eq(schema.users.id, schema.discoveries.authorId))
      .innerJoin(schema.protocols, eq(schema.protocols.id, schema.discoveries.protocolId))
      .where(and(eq(schema.protocols.domain, domain), ...conditions))
      .orderBy(...orderBy)
      .limit(50);
  }

  return db
    .select({
      id: schema.discoveries.id,
      title: schema.discoveries.title,
      summary: schema.discoveries.summary,
      noveltyScore: schema.discoveries.noveltyScore,
      status: schema.discoveries.status,
      createdAt: schema.discoveries.createdAt,
      authorHandle: schema.users.handle,
      protocolTitle: schema.protocols.title,
    })
    .from(schema.discoveries)
    .innerJoin(schema.users, eq(schema.users.id, schema.discoveries.authorId))
    .innerJoin(schema.protocols, eq(schema.protocols.id, schema.discoveries.protocolId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(...orderBy)
    .limit(50);
}

export default async function DiscoveriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  let discoveries = [] as Awaited<ReturnType<typeof fetchDiscoveries>>;
  let domains = [] as string[];

  try {
    [discoveries, domains] = await Promise.all([fetchDiscoveries(params), fetchDomains()]);
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === 'ECONNREFUSED') {
      console.warn('[discoveries] Database unavailable — using fallback data for development UI');
      discoveries = FALLBACK_DISCOVERIES as any;
      domains = FALLBACK_DOMAINS;
    } else {
      throw error;
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-8">
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Discoveries</h1>
          <p className="text-muted-foreground">
            Auto-generated Discovery Cards from signals the community surfaced and the engine
            corroborated. Each is provisional until peer review confirms.
          </p>
        </header>

        <Suspense>
          <DiscoveryFilters domains={domains} />
        </Suspense>

        {discoveries.length === 0 && (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
            No discoveries found. Try adjusting your search or filters.
          </div>
        )}

        <div className="space-y-4">
          {discoveries.map((d) => (
            <Link key={d.id} href={`/discoveries/${d.id}`} className="block group">
              <Card className="hover:border-accent transition-colors">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant={STATUS_VARIANT[d.status] ?? 'muted'}>
                      {d.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs font-mono text-muted-foreground">
                      novelty {d.noveltyScore.toFixed(3)}
                    </span>
                  </div>
                  <CardTitle className="group-hover:text-accent transition-colors">
                    {d.title}
                  </CardTitle>
                  <CardDescription>{d.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>@{d.authorHandle}</span>
                    <span>via {d.protocolTitle}</span>
                    <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <aside className="space-y-4">
        <LiveDiscoveryFeed />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">How discoveries are promoted</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>1. Triage filters noise.</p>
            <p>2. Embedding clusters find independent corroborators.</p>
            <p>3. Opus 4.8 agent searches UniProt + Europe PMC live.</p>
            <p>4. Composite novelty ≥ 0.75 AND ≥ 2 disjoint corroborators.</p>
            <p>5. Sonnet 5 generates the Discovery Card.</p>
            <p>6. Canary replication confirms determinism.</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
