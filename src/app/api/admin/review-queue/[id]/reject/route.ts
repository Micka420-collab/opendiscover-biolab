import { getAppSession, isGuestSession } from '@/lib/auth';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSession({ headers: await headers() });
  if (!session || isGuestSession(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const result = await db
    .update(schema.submissions)
    .set({ status: 'rejected' })
    .where(eq(schema.submissions.id, id))
    .returning({ id: schema.submissions.id });

  if (result.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ status: 'rejected' });
}
