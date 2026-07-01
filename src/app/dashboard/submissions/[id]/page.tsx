import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const PIPELINE_STEPS = [
  { label: 'Received', statuses: ['pending'] },
  { label: 'Triage', statuses: ['triaged_noise', 'triaged_interesting'] },
  { label: 'Embed', statuses: [] as string[] },
  { label: 'Cluster', statuses: [] as string[] },
  { label: 'Novelty Check', statuses: [] as string[] },
  { label: 'Promote / Reject', statuses: ['promoted', 'rejected'] },
] as const;

function currentStepIndex(status: string): number {
  if (status === 'pending') return 0;
  if (status === 'triaged_noise' || status === 'triaged_interesting') return 1;
  if (status === 'promoted' || status === 'rejected') return 5;
  return 0;
}

const STATUS_VARIANT: Record<
  string,
  'warning' | 'info' | 'success' | 'danger' | 'muted' | 'default'
> = {
  pending: 'warning',
  triaged_noise: 'muted',
  triaged_interesting: 'info',
  promoted: 'success',
  rejected: 'danger',
};

export default async function SubmissionTrackerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [submission] = await db
    .select({
      id: schema.submissions.id,
      sliceKey: schema.submissions.sliceKey,
      outputHash: schema.submissions.outputHash,
      noveltyScore: schema.submissions.noveltyScore,
      status: schema.submissions.status,
      rejectionReason: schema.submissions.rejectionReason,
      createdAt: schema.submissions.createdAt,
      processedAt: schema.submissions.processedAt,
      protocolTitle: schema.protocols.title,
    })
    .from(schema.submissions)
    .innerJoin(schema.protocols, eq(schema.protocols.id, schema.submissions.protocolId))
    .where(eq(schema.submissions.id, id))
    .limit(1);

  if (!submission) notFound();

  const pipelineRuns = await db
    .select()
    .from(schema.pipelineRuns)
    .where(eq(schema.pipelineRuns.submissionId, id))
    .orderBy(schema.pipelineRuns.createdAt);

  const linkedDiscovery = await db
    .select({
      discoveryId: schema.discoveryTriggers.discoveryId,
      discoveryTitle: schema.discoveries.title,
    })
    .from(schema.discoveryTriggers)
    .innerJoin(schema.discoveries, eq(schema.discoveries.id, schema.discoveryTriggers.discoveryId))
    .where(eq(schema.discoveryTriggers.submissionId, id))
    .limit(1);

  const activeStep = currentStepIndex(submission.status);

  return (
    <>
      <meta httpEquiv="refresh" content="10" />
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Dashboard
          </Link>
        </div>

        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{submission.protocolTitle}</h1>
            <Badge variant={STATUS_VARIANT[submission.status] ?? 'muted'}>
              {submission.status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Submitted {new Date(submission.createdAt).toLocaleString()}
            {submission.processedAt && (
              <> · Processed {new Date(submission.processedAt).toLocaleString()}</>
            )}
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Submission details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="w-28 shrink-0 text-muted-foreground">Slice key</span>
              <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{submission.sliceKey}</code>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-28 shrink-0 text-muted-foreground">Output hash</span>
              <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                {submission.outputHash.slice(0, 12)}…
              </code>
            </div>
            {submission.noveltyScore != null && (
              <div className="flex items-start gap-2">
                <span className="w-28 shrink-0 text-muted-foreground">Novelty score</span>
                <span className="tabular-nums">{submission.noveltyScore.toFixed(4)}</span>
              </div>
            )}
            {submission.rejectionReason && (
              <div className="flex items-start gap-2">
                <span className="w-28 shrink-0 text-muted-foreground">Rejected</span>
                <span className="text-red-400">{submission.rejectionReason}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline status</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative border-l border-border ml-3 space-y-0">
              {PIPELINE_STEPS.map((step, idx) => {
                const isDone = idx < activeStep;
                const isActive = idx === activeStep;
                const isPending = idx > activeStep;

                return (
                  <li key={step.label} className="ml-6 pb-6 last:pb-0">
                    <span
                      className={[
                        'absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-2',
                        isDone
                          ? 'bg-emerald-500 ring-emerald-500/30 text-white'
                          : isActive
                          ? 'bg-accent ring-accent/30 text-accent-foreground'
                          : 'bg-muted ring-border text-muted-foreground',
                      ].join(' ')}
                    >
                      {isDone ? (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-[10px] font-bold">{idx + 1}</span>
                      )}
                    </span>
                    <div className="ml-2 pt-0.5">
                      <p
                        className={[
                          'text-sm font-medium',
                          isPending ? 'text-muted-foreground' : 'text-foreground',
                        ].join(' ')}
                      >
                        {step.label}
                      </p>
                      {isActive && (
                        <p className="text-xs text-muted-foreground mt-0.5">In progress…</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        {pipelineRuns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pipeline run log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs font-mono">
              {pipelineRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-start gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0"
                >
                  <span className="tabular-nums text-muted-foreground shrink-0">
                    {new Date(run.createdAt).toLocaleTimeString()}
                  </span>
                  <span className={run.status === 'error' ? 'text-red-400' : 'text-foreground'}>
                    [{run.stage}] {run.status}
                    {run.durationMs != null && (
                      <span className="text-muted-foreground"> ({run.durationMs}ms)</span>
                    )}
                  </span>
                  {run.error && (
                    <span className="text-red-400 truncate max-w-xs">{run.error}</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {linkedDiscovery[0] && (
          <Card className="border-emerald-500/30">
            <CardContent className="pt-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Promoted to discovery
                </p>
                <p className="font-semibold">{linkedDiscovery[0].discoveryTitle}</p>
              </div>
              <Link
                href={`/discoveries/${linkedDiscovery[0].discoveryId}`}
                className="text-sm text-accent hover:underline"
              >
                View →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
