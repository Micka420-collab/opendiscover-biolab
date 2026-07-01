import { getAppSession, isGuestSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminActions } from './admin-actions';

export const dynamic = 'force-dynamic';

export default async function ReviewQueuePage() {
  const session = await getAppSession({ headers: await headers() });
  if (!session || isGuestSession(session)) redirect('/auth/sign-in');

  const rows = await db
    .select({
      id: schema.submissions.id,
      sliceKey: schema.submissions.sliceKey,
      claimSummary: schema.submissions.claimSummary,
      createdAt: schema.submissions.createdAt,
      handle: schema.users.handle,
      protocolSlug: schema.protocols.slug,
    })
    .from(schema.submissions)
    .innerJoin(schema.users, eq(schema.users.id, schema.submissions.contributorId))
    .innerJoin(schema.protocols, eq(schema.protocols.id, schema.submissions.protocolId))
    .where(eq(schema.submissions.status, 'pending'))
    .orderBy(desc(schema.submissions.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Review Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pending submissions awaiting pipeline processing. {rows.length} item
            {rows.length !== 1 ? 's' : ''}.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending submissions.</p>
      ) : (
        <div className="rounded-md border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                <th className="px-4 py-3 text-left font-medium">Contributor</th>
                <th className="px-4 py-3 text-left font-medium">Protocol</th>
                <th className="px-4 py-3 text-left font-medium">Slice key</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Claim summary</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-3 font-medium">@{row.handle}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.protocolSlug}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {row.sliceKey}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                    {row.claimSummary
                      ? row.claimSummary.slice(0, 120) + (row.claimSummary.length > 120 ? '…' : '')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <AdminActions submissionId={row.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
