import { getAppSession, isGuestSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { inngest } from '@/lib/inngest';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const maxDuration = 30;
export const runtime = 'nodejs';

const bodySchema = z.object({
  verdict: z.enum(['approved', 'disputed', 'rejected_low_quality']),
  comment: z.string().min(10).max(2000),
  confidence: z.number().min(0).max(1),
});

const VERDICT_TO_ACTION: Record<
  'approved' | 'disputed' | 'rejected_low_quality',
  'endorse' | 'challenge' | 'annotate'
> = {
  approved: 'endorse',
  disputed: 'challenge',
  rejected_low_quality: 'annotate',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession({ headers: req.headers });
  if (!session?.user || isGuestSession(session)) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { id: discoveryId } = await params;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', details: parsed.error.format() },
      { status: 400 },
    );
  }
  const { verdict, comment, confidence } = parsed.data;

  const [discovery] = await db
    .select({ id: schema.discoveries.id, authorId: schema.discoveries.authorId })
    .from(schema.discoveries)
    .where(eq(schema.discoveries.id, discoveryId))
    .limit(1);

  if (!discovery) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  if (discovery.authorId === session.user.id) {
    return NextResponse.json({ error: 'self_review_not_allowed' }, { status: 403 });
  }

  const [review] = await db
    .insert(schema.peerReviews)
    .values({
      discoveryId,
      reviewerId: session.user.id,
      action: VERDICT_TO_ACTION[verdict],
      payload: { verdict, comment, confidence },
    })
    .returning({ id: schema.peerReviews.id });

  await inngest.send({
    name: 'discovery/peer-review',
    data: { discoveryId, reviewId: review?.id },
  });

  return NextResponse.json({ id: review?.id }, { status: 201 });
}
