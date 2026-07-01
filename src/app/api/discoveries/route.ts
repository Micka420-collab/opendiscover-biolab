import { recentDiscoveries } from '@/lib/db/queries';
import { NextResponse } from 'next/server';

// Dynamic (not statically generated): this reads live data on every request,
// so it must never be executed at build time (when the database may not yet
// be reachable). Edge caching is still achieved via the Cache-Control header.
export const dynamic = 'force-dynamic';

export async function GET() {
  const discoveries = await recentDiscoveries(50);
  return NextResponse.json(
    { discoveries },
    { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
  );
}
