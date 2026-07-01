/**
 * GET /api/lab/engines
 *
 * The simulation-engine catalog. No auth, no database, no secrets — the engines
 * are pure functions, so this is a cheap, cacheable listing.
 *
 *   /api/lab/engines                 → all engines (compact)
 *   /api/lab/engines?domain=protein  → filter by domain
 *   /api/lab/engines?slug=sequence   → full spec of one engine (params example, refs)
 */

import { describeEngine, getEngine, listDomains, listEngines } from '@/lib/sim';
import { NextResponse } from 'next/server';

export const revalidate = 3600;

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const domain = searchParams.get('domain') ?? undefined;

  if (slug) {
    const spec = getEngine(slug);
    if (!spec) {
      return NextResponse.json({ error: `Unknown engine: "${slug}"` }, { status: 404 });
    }
    return NextResponse.json({ engine: describeEngine(spec) });
  }

  const engines = listEngines(domain).map((e) => ({
    slug: e.slug,
    title: e.title,
    domain: e.domain,
    version: e.version,
    description: e.description,
    tags: e.tags ?? [],
  }));

  return NextResponse.json({ count: engines.length, domains: listDomains(), engines });
}
