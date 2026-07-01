import { redirect } from 'next/navigation';
import Link from 'next/link';
import { headers } from 'next/headers';
import { eq, desc, count, avg } from 'drizzle-orm';
import { getAppSession, isGuestSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const SUBMISSION_STATUS_VARIANT: Record<
  string,
  'warning' | 'info' | 'success' | 'danger' | 'muted' | 'default'
> = {
  pending: 'warning',
  triaged_noise: 'muted',
  triaged_interesting: 'info',
  promoted: 'success',
  rejected: 'danger',
};

function reputationVariant(rep: number): 'success' | 'warning' | 'danger' {
  if (rep > 0.8) return 'success';
  if (rep > 0.5) return 'warning';
  return 'danger';
}

export default async function DashboardPage() {
  const session = await getAppSession({ headers: await headers() });
  if (!session) redirect('/auth/sign-in');

  const userId = session.user.id;

  let submissions = [] as Awaited<ReturnType<typeof db.select>>;
  let stats: { total?: number; avgNovelty?: number } | undefined;
  let discoveryRows: Array<{ id: string; title: string; noveltyScore: number; status: string }> = [];

  try {
    submissions = await db
      .select({
        id: schema.submissions.id,
        sliceKey: schema.submissions.sliceKey,
        outputHash: schema.submissions.outputHash,
        noveltyScore: schema.submissions.noveltyScore,
        status: schema.submissions.status,
        createdAt: schema.submissions.createdAt,
        protocolTitle: schema.protocols.title,
      })
      .from(schema.submissions)
      .innerJoin(schema.protocols, eq(schema.protocols.id, schema.submissions.protocolId))
      .where(eq(schema.submissions.contributorId, userId))
      .orderBy(desc(schema.submissions.createdAt))
      .limit(20);

    [stats] = await db
      .select({
        total: count(),
        avgNovelty: avg(schema.submissions.noveltyScore),
      })
      .from(schema.submissions)
      .where(eq(schema.submissions.contributorId, userId));

    discoveryRows = await db
      .selectDistinct({
        id: schema.discoveries.id,
        title: schema.discoveries.title,
        noveltyScore: schema.discoveries.noveltyScore,
        status: schema.discoveries.status,
      })
      .from(schema.discoveryTriggers)
      .innerJoin(
        schema.submissions,
        eq(schema.submissions.id, schema.discoveryTriggers.submissionId),
      )
      .innerJoin(
        schema.discoveries,
        eq(schema.discoveries.id, schema.discoveryTriggers.discoveryId),
      )
      .where(eq(schema.submissions.contributorId, userId));
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err?.code === 'ECONNREFUSED') {
      console.warn('[dashboard] Database unavailable — using empty fallbacks for UI');
      submissions = [] as any;
      stats = { total: 0, avgNovelty: undefined };
      discoveryRows = [];
    } else {
      throw error;
    }
  }

  const user = session.user as typeof session.user & {
    handle?: string;
    reputation?: number;
  };
  const handle =
    user.handle ??
    user.name ??
    ('email' in user ? user.email : undefined) ??
    'contributor';
  const reputation = typeof user.reputation === 'number' ? user.reputation : 1.0;
  const guest = isGuestSession(session);

  const totalSubmissions = Number(stats?.total ?? 0);
  const avgNovelty = stats?.avgNovelty ? Number(stats.avgNovelty).toFixed(3) : '—';

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">@{handle}</h1>
          <Badge variant={reputationVariant(reputation)}>
            rep {reputation.toFixed(2)}
          </Badge>
        </div>
        {!guest ? (
          <Link
            href="/admin/review-queue"
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Review queue →
          </Link>
        ) : null}
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Submissions</p>
            <p className="mt-1 text-3xl font-bold">{totalSubmissions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Discoveries</p>
            <p className="mt-1 text-3xl font-bold">{discoveryRows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg novelty</p>
            <p className="mt-1 text-3xl font-bold">{avgNovelty}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent submissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {submissions.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-5 py-3 text-left font-medium">Protocol</th>
                    <th className="px-5 py-3 text-left font-medium">Slice key</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
                    <th className="px-5 py-3 text-left font-medium">Novelty</th>
                    <th className="px-5 py-3 text-left font-medium">Date</th>
                    <th className="px-5 py-3 text-left font-medium">Tracker</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                      <td className="px-5 py-3 font-medium">{s.protocolTitle}</td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{s.sliceKey}</td>
                      <td className="px-5 py-3">
                        <Badge variant={SUBMISSION_STATUS_VARIANT[s.status] ?? 'muted'}>
                          {s.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 tabular-nums">
                        {s.noveltyScore != null ? s.noveltyScore.toFixed(3) : '—'}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/dashboard/submissions/${s.id}`}
                          className="text-accent hover:underline"
                        >
                          Track →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {discoveryRows.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Your discoveries</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {discoveryRows.map((d) => (
              <Link key={d.id} href={`/discoveries/${d.id}`}>
                <Card className="transition-colors hover:border-accent/50 h-full">
                  <CardContent className="pt-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          SUBMISSION_STATUS_VARIANT[d.status] === 'success'
                            ? 'success'
                            : (SUBMISSION_STATUS_VARIANT[d.status] ?? 'muted')
                        }
                      >
                        {d.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        novelty {d.noveltyScore.toFixed(3)}
                      </span>
                    </div>
                    <p className="font-medium line-clamp-2">{d.title}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
