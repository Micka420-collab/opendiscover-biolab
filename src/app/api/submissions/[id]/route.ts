import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s] = await db
    .select({
      id: schema.submissions.id,
      status: schema.submissions.status,
      triageScore: schema.submissions.triageScore,
      noveltyScore: schema.submissions.noveltyScore,
      processedAt: schema.submissions.processedAt,
      rejectionReason: schema.submissions.rejectionReason,
    })
    .from(schema.submissions)
    .where(eq(schema.submissions.id, id))
    .limit(1);
  if (!s) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ submission: s });
}
