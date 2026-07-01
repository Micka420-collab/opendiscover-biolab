/**
 * Cron: every 15 minutes — re-queue interesting submissions for promotion.
 *
 * Picks up submissions that are still at "triaged_interesting" (not yet promoted)
 * but have a noveltyScore above the configured threshold. We fire
 * `submission/received` so the full discovery pipeline re-evaluates them —
 * this is the mechanism that turns late-arriving corroboration into a Discovery.
 *
 * Capped at 50 per run to avoid flooding Inngest.
 *
 * Auth: Vercel cron calls include "Authorization: Bearer <CRON_SECRET>".
 */

import { type NextRequest, NextResponse } from 'next/server';
import { and, eq, gt } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { inngest } from '@/lib/inngest';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET bearer token
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const threshold = parseFloat(process.env.NOVELTY_THRESHOLD ?? '0.75');

  // Submissions that are triaged_interesting (not yet promoted) and above the
  // novelty threshold — these are the candidates ready to be re-evaluated.
  const candidates = await db
    .select({ id: schema.submissions.id })
    .from(schema.submissions)
    .where(
      and(
        eq(schema.submissions.status, 'triaged_interesting'),
        gt(schema.submissions.noveltyScore, threshold),
      ),
    )
    .limit(50);

  if (candidates.length === 0) {
    return NextResponse.json({ requeued: 0 });
  }

  await inngest.send(
    candidates.map((c) => ({
      name: 'submission/received' as const,
      data: { submissionId: c.id },
    })),
  );

  return NextResponse.json({ requeued: candidates.length });
}
