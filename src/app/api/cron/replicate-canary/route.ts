/**
 * Cron: every 6 hours — schedule canary replication for recent confirmed discoveries.
 *
 * Picks the 5 most recent discoveries with status "confirmed" or "provisional",
 * finds their triggering submissions via discovery_triggers (role = "trigger"),
 * and fires `protocol/canary-replicate` for each. This keeps the determinism
 * invariant honest — if a protocol is non-deterministic, we catch it here.
 *
 * Auth: Vercel cron calls include "Authorization: Bearer <CRON_SECRET>".
 */

import { db, schema } from '@/lib/db';
import { inngest } from '@/lib/inngest';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET bearer token
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Load the 5 most recent confirmed or provisional discoveries.
  const recentDiscoveries = await db
    .select({ id: schema.discoveries.id })
    .from(schema.discoveries)
    .where(inArray(schema.discoveries.status, ['confirmed', 'provisional']))
    .orderBy(desc(schema.discoveries.createdAt))
    .limit(5);

  if (recentDiscoveries.length === 0) {
    return NextResponse.json({ scheduled: 0 });
  }

  const discoveryIds = recentDiscoveries.map((d) => d.id);

  // Find the trigger submissions for those discoveries.
  const triggers = await db
    .select({ submissionId: schema.discoveryTriggers.submissionId })
    .from(schema.discoveryTriggers)
    .where(
      and(
        inArray(schema.discoveryTriggers.discoveryId, discoveryIds),
        eq(schema.discoveryTriggers.role, 'trigger'),
      ),
    );

  if (triggers.length === 0) {
    return NextResponse.json({ scheduled: 0 });
  }

  await inngest.send(
    triggers.map((t) => ({
      name: 'protocol/canary-replicate' as const,
      data: { submissionId: t.submissionId },
    })),
  );

  return NextResponse.json({ scheduled: triggers.length });
}
