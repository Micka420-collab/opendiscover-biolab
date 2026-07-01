import { NextResponse } from 'next/server';
import { recentDiscoveries } from '@/lib/db/queries';

export const revalidate = 30;

export async function GET() {
  const discoveries = await recentDiscoveries(50);
  return NextResponse.json({ discoveries });
}
