import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { db, schema } from '@/lib/db';
import { desc, eq, sql } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const FALLBACK_PROTOCOLS = [
  {
    id: 'proto-1',
    slug: 'small-orf-mining-v1',
    version: 1,
    title: 'Small ORF Mining v1',
    description: 'Discover small open reading frames in understudied bacterial genomes.',
    domain: 'Genomics',
    runnerKind: 'js',
    submissions: 0,
    discoveries: 0,
  },
];

export default async function ExperimentsPage() {
  let protocols: typeof FALLBACK_PROTOCOLS = [];

  try {
    protocols = await db
      .select({
        id: schema.protocols.id,
        slug: schema.protocols.slug,
        version: schema.protocols.version,
        title: schema.protocols.title,
        description: schema.protocols.description,
        domain: schema.protocols.domain,
        runnerKind: schema.protocols.runnerKind,
        submissions: sql<number>`(SELECT COUNT(*) FROM ${schema.submissions} WHERE ${schema.submissions.protocolId} = ${schema.protocols.id})`,
        discoveries: sql<number>`(SELECT COUNT(*) FROM ${schema.discoveries} WHERE ${schema.discoveries.protocolId} = ${schema.protocols.id})`,
      })
      .from(schema.protocols)
      .where(eq(schema.protocols.enabled, true))
      .orderBy(desc(schema.protocols.createdAt));
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === 'ECONNREFUSED') {
      console.warn(
        '[experiments] Database unavailable — using fallback protocols for development UI',
      );
      protocols = FALLBACK_PROTOCOLS as any;
    } else {
      throw error;
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Run a protocol"
        title="Experiments"
        intro={
          <>
            Pick a protocol. Each one runs in your browser (or in Vercel Sandbox) on a public
            dataset slice. Results are deterministic — same input, same output, same hash, verified
            server-side.
          </>
        }
      />

      {protocols.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
          No protocols yet. Run{' '}
          <code className="font-mono text-foreground">pnpm tsx scripts/seed-protocols.ts</code>.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {protocols.map((p) => (
          <Link key={p.id} href={`/experiments/${p.slug}`} className="block group">
            <Card className="hover:border-accent transition-colors h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="muted">{p.domain}</Badge>
                  <span className="text-xs font-mono text-muted-foreground">
                    {p.runnerKind} · v{p.version}
                  </span>
                </div>
                <CardTitle className="group-hover:text-accent transition-colors">
                  {p.title}
                </CardTitle>
                <CardDescription className="line-clamp-3">{p.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{Number(p.submissions)} submissions</span>
                  <span>{Number(p.discoveries)} discoveries</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
