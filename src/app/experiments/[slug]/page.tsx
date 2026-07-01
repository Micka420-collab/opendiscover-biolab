import { Badge } from '@/components/ui/badge';
import { db, schema } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ProtocolRunner } from './runner';

export const dynamic = 'force-dynamic';

export default async function ExperimentDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [protocol] = await db
    .select()
    .from(schema.protocols)
    .where(eq(schema.protocols.slug, slug))
    .orderBy(desc(schema.protocols.version))
    .limit(1);
  if (!protocol) notFound();

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="muted">{protocol.domain}</Badge>
          <Badge variant="outline">v{protocol.version}</Badge>
          <Badge variant="info">{protocol.runnerKind}</Badge>
        </div>
        <h1 className="text-3xl font-bold">{protocol.title}</h1>
        <p className="text-muted-foreground max-w-3xl">{protocol.description}</p>
      </header>

      <ProtocolRunner
        slug={protocol.slug}
        version={protocol.version}
        runnerKind={protocol.runnerKind as 'js' | 'pyodide' | 'sandbox'}
      />
    </div>
  );
}
