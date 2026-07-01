import { getAppSession, isGuestSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { inngest } from '@/lib/inngest';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession({ headers: await headers() });
  if (!session || isGuestSession(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [submission] = await db
    .select({ id: schema.submissions.id })
    .from(schema.submissions)
    .where(eq(schema.submissions.id, id))
    .limit(1);

  if (!submission) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await inngest.send({
    name: 'submission/received',
    data: { submissionId: id },
  });

  return NextResponse.json({ status: 'approved' });
}
