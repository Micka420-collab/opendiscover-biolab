import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getAppSession, isGuestSession } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DiscoveryVisualization } from './visualization';
import { ProvenanceGraph } from './provenance';
import { PeerReviewPanel } from '@/components/discovery/peer-review-panel';

export const dynamic = 'force-dynamic';

const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'muted'> = {
  provisional: 'warning',
  under_review: 'info',
  confirmed: 'success',
  disputed: 'warning',
  refuted: 'danger',
  retracted: 'muted',
};

export default async function DiscoveryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [d] = await db
    .select()
    .from(schema.discoveries)
    .where(eq(schema.discoveries.id, id))
    .limit(1);
  if (!d) notFound();

  const [author] = await db
    .select({ handle: schema.users.handle, reputation: schema.users.reputation })
    .from(schema.users)
    .where(eq(schema.users.id, d.authorId))
    .limit(1);

  const [protocol] = await db
    .select()
    .from(schema.protocols)
    .where(eq(schema.protocols.id, d.protocolId))
    .limit(1);

  const triggers = await db
    .select({
      submissionId: schema.discoveryTriggers.submissionId,
      role: schema.discoveryTriggers.role,
      contributorId: schema.submissions.contributorId,
      contributorHandle: schema.users.handle,
    })
    .from(schema.discoveryTriggers)
    .innerJoin(
      schema.submissions,
      eq(schema.submissions.id, schema.discoveryTriggers.submissionId),
    )
    .innerJoin(schema.users, eq(schema.users.id, schema.submissions.contributorId))
    .where(eq(schema.discoveryTriggers.discoveryId, d.id));

  const reviewRows = await db
    .select({
      id: schema.peerReviews.id,
      reviewerId: schema.peerReviews.reviewerId,
      handle: schema.users.handle,
      action: schema.peerReviews.action,
      payload: schema.peerReviews.payload,
      createdAt: schema.peerReviews.createdAt,
    })
    .from(schema.peerReviews)
    .innerJoin(schema.users, eq(schema.users.id, schema.peerReviews.reviewerId))
    .where(eq(schema.peerReviews.discoveryId, d.id))
    .orderBy(desc(schema.peerReviews.createdAt));

  const ACTION_TO_VERDICT: Record<string, string> = {
    endorse: 'approved',
    replicate: 'approved',
    challenge: 'disputed',
    retract: 'rejected_low_quality',
    annotate: 'approved',
  };

  const reviews = reviewRows.map((r) => {
    const payload = (r.payload as { comment?: string; confidence?: number } | null) ?? {};
    return {
      id: r.id,
      reviewer: r.handle,
      verdict: ACTION_TO_VERDICT[r.action] ?? 'approved',
      comment: payload.comment ?? '',
      confidence: payload.confidence ?? 0.5,
      createdAt: r.createdAt.toISOString(),
    };
  });

  const session = await getAppSession({ headers: await headers() });
  const viewerId = session?.user?.id;
  const guest = isGuestSession(session);
  const isAuthor = viewerId !== undefined && viewerId === d.authorId;
  const alreadyReviewed = viewerId !== undefined && reviewRows.some((r) => r.reviewerId === viewerId);
  const canReview = !guest && viewerId !== undefined && !isAuthor && !alreadyReviewed;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[d.status] ?? 'muted'}>{d.status.replace('_', ' ')}</Badge>
          <Badge variant="outline">novelty {d.noveltyScore.toFixed(3)}</Badge>
          {d.canaryReplicated && <Badge variant="success">canary replicated</Badge>}
          {d.doi && (
            <Badge variant="info">
              <a href={`https://doi.org/${d.doi}`} target="_blank" rel="noreferrer">
                {d.doi}
              </a>
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-bold">{d.title}</h1>
        <p className="text-lg text-muted-foreground">{d.summary}</p>
        <p className="text-sm text-muted-foreground">
          by <strong>@{author?.handle}</strong> · via {protocol?.title}
        </p>
      </header>

      <Card>
        <CardContent className="pt-6">
          <DiscoveryVisualization spec={d.visualizationSpec as object} />
        </CardContent>
      </Card>

      <article className="prose prose-invert max-w-none">
        <pre className="whitespace-pre-wrap font-sans text-base bg-transparent p-0">
          {d.cardMarkdown}
        </pre>
      </article>

      <Card>
        <CardHeader>
          <CardTitle>Novelty reasoning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground whitespace-pre-wrap">{d.noveltyReasoning}</p>
          {Array.isArray(d.citations) && (d.citations as unknown[]).length > 0 && (
            <div>
              <div className="font-medium mb-2">Closest existing literature</div>
              <ul className="space-y-1">
                {(d.citations as Array<{ external_id: string; overlap_summary: string }>).map((c) => (
                  <li key={c.external_id} className="text-xs">
                    <code className="font-mono text-muted-foreground mr-2">{c.external_id}</code>
                    {c.overlap_summary}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provenance</CardTitle>
        </CardHeader>
        <CardContent>
          <ProvenanceGraph triggers={triggers} discoveryTitle={d.title} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Peer review</CardTitle>
        </CardHeader>
        <CardContent>
          <PeerReviewPanel discoveryId={d.id} reviews={reviews} canReview={canReview} />
        </CardContent>
      </Card>

      <div className="flex gap-2 text-xs">
        <span className="text-muted-foreground">Export:</span>
        <a href={`/api/discoveries/${d.id}/export?format=json-ld`} className="hover:text-accent underline">JSON-LD</a>
        <a href={`/api/discoveries/${d.id}/export?format=bibtex`} className="hover:text-accent underline">BibTeX</a>
        <a href={`/api/discoveries/${d.id}/export?format=ro-crate`} className="hover:text-accent underline">RO-Crate</a>
      </div>
    </div>
  );
}
