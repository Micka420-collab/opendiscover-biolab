import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [d] = await db
    .select()
    .from(schema.discoveries)
    .where(eq(schema.discoveries.id, id))
    .limit(1);
  if (!d) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ discovery: d });
}
