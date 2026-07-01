/**
 * POST /api/submissions
 *
 * Validate, rate-limit, persist, then hand off to the Inngest pipeline.
 * Returns 202 with the submission id so clients can poll status.
 */

import { buildClaimSummary, embedClaim } from '@/lib/ai/embeddings';
import { track } from '@/lib/analytics/posthog';
import { getAppSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { setSubmissionEmbedding } from '@/lib/db/queries';
import { inngest } from '@/lib/inngest';
import { screenClaimSummary } from '@/lib/safety/dual-use-screen';
import { limitSubmission } from '@/lib/security/rate-limit';
import { canonicalHash } from '@/lib/util/hash';
import { desc, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const maxDuration = 60;
export const runtime = 'nodejs';

const submissionInput = z.object({
  protocolSlug: z.string(),
  protocolVersion: z.number().int().positive(),
  inputSlice: z.record(z.unknown()),
  sliceKey: z.string().min(1).max(256),
  rawOutput: z.record(z.unknown()),
  clientOutputHash: z.string().length(64),
  runnerVersion: z.string().optional(),
});

export async function POST(req: NextRequest) {
  /* Auth */
  const session = await getAppSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  /* Rate limit */
  const rl = await limitSubmission(session.user.id);
  if (!rl.success) {
    return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
  }

  /* Parse */
  const parsed = submissionInput.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', details: parsed.error.format() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  /* Resolve protocol */
  const [protocol] = await db
    .select()
    .from(schema.protocols)
    .where(eq(schema.protocols.slug, body.protocolSlug))
    .orderBy(desc(schema.protocols.version))
    .limit(1);
  if (!protocol || !protocol.enabled || protocol.version !== body.protocolVersion) {
    return NextResponse.json({ error: 'protocol_unavailable' }, { status: 404 });
  }

  /* Determinism gate */
  const serverHash = await canonicalHash(body.rawOutput);
  if (serverHash !== body.clientOutputHash) {
    return NextResponse.json({ error: 'hash_mismatch', expected: serverHash }, { status: 400 });
  }

  /* Dual-use safety screen */
  const claim = buildClaimSummary(protocol.title, body.rawOutput, body.inputSlice);
  const screen = await screenClaimSummary(claim);
  if (screen.level === 'block') {
    track(session.user.id, 'submission_blocked_dual_use', {
      protocolSlug: protocol.slug,
      reason: screen.reason,
    });
    return NextResponse.json({ error: 'dual_use_concern', reason: screen.reason }, { status: 451 });
  }

  /* Persist */
  const [submission] = await db
    .insert(schema.submissions)
    .values({
      contributorId: session.user.id,
      protocolId: protocol.id,
      protocolVersion: protocol.version,
      inputSlice: body.inputSlice,
      sliceKey: body.sliceKey,
      rawOutput: body.rawOutput,
      outputHash: serverHash,
      claimSummary: claim,
      runnerVersion: body.runnerVersion,
    })
    .returning({ id: schema.submissions.id });

  /* Embed (fast — keep inline so cluster queries work for this submission too) */
  try {
    const embedding = await embedClaim(claim);
    await setSubmissionEmbedding(submission?.id, embedding);
  } catch (e) {
    console.warn('[submissions] embedding failed, pipeline will retry', e);
  }

  /* Hand off — skip pipeline if flagged for human review */
  if (screen.level === 'review') {
    track(session.user.id, 'submission_flagged_dual_use', {
      protocolSlug: protocol.slug,
      submissionId: submission?.id,
      reason: screen.reason,
    });
    return NextResponse.json(
      {
        id: submission?.id,
        status: 'pending_review',
        message: 'Submission held for biosafety review before pipeline proceeds.',
        track: `/api/submissions/${submission?.id}`,
      },
      { status: 202 },
    );
  }

  await inngest.send({
    name: 'submission/received',
    data: { submissionId: submission?.id },
  });

  track(session.user.id, 'submission_received', {
    protocolSlug: protocol.slug,
    submissionId: submission?.id,
  });

  return NextResponse.json(
    {
      id: submission?.id,
      status: 'accepted',
      track: `/api/submissions/${submission?.id}`,
    },
    { status: 202 },
  );
}
