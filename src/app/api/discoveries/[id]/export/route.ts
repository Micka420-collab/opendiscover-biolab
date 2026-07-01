import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = req.nextUrl.searchParams.get('format') ?? 'json-ld';

  const [discovery] = await db
    .select()
    .from(schema.discoveries)
    .where(eq(schema.discoveries.id, id))
    .limit(1);

  if (!discovery) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const triggers = await db
    .select({
      submissionId: schema.discoveryTriggers.submissionId,
      role: schema.discoveryTriggers.role,
      contributorHandle: schema.users.handle,
    })
    .from(schema.discoveryTriggers)
    .innerJoin(schema.submissions, eq(schema.submissions.id, schema.discoveryTriggers.submissionId))
    .innerJoin(schema.users, eq(schema.users.id, schema.submissions.contributorId))
    .where(eq(schema.discoveryTriggers.discoveryId, id));

  const contributors = Array.from(
    new Map(triggers.map((t) => [t.contributorHandle, t.contributorHandle])).values(),
  );

  const year = new Date(discovery.createdAt).getFullYear().toString();
  const identifier = discovery.doi ?? discovery.id;
  const url = `https://opendiscover.science/discoveries/${id}`;

  if (format === 'json-ld') {
    const body = {
      '@context': 'https://schema.org/',
      '@type': 'Dataset',
      name: discovery.title,
      description: discovery.summary,
      datePublished: discovery.createdAt,
      creator: contributors.map((handle) => ({ '@type': 'Person', name: handle })),
      identifier,
      license: 'https://creativecommons.org/licenses/by/4.0/',
    };
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        'Content-Type': 'application/ld+json',
        'Content-Disposition': `attachment; filename="discovery-${id}.jsonld"`,
      },
    });
  }

  if (format === 'bibtex') {
    const authorStr = contributors.join(' and ');
    const safeTitle = discovery.title.replace(/[{}]/g, '');
    const body = `@misc{opendiscover_${id},\n  title = {${safeTitle}},\n  author = {${authorStr}},\n  year = {${year}},\n  howpublished = {\\url{${url}}},\n  note = {OpenDiscover citizen science discovery}\n}\n`;
    return new Response(body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="discovery-${id}.bib"`,
      },
    });
  }

  if (format === 'ro-crate') {
    const creators = contributors.map((handle) => ({ '@type': 'Person', name: handle }));
    const body = {
      '@context': 'https://w3id.org/ro/crate/1.1/context',
      '@graph': [
        {
          '@id': 'ro-crate-metadata.json',
          '@type': 'CreativeWork',
          about: { '@id': './' },
          conformsTo: { '@id': 'https://w3id.org/ro/crate/1.1' },
        },
        {
          '@id': './',
          '@type': ['Dataset'],
          name: discovery.title,
          description: discovery.summary,
          datePublished: discovery.createdAt,
          creator: creators,
          identifier,
          license: 'https://creativecommons.org/licenses/by/4.0/',
          url,
          hasPart: [],
        },
      ],
    };
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        'Content-Type': 'application/ld+json',
        'Content-Disposition': 'attachment; filename="ro-crate-metadata.json"',
      },
    });
  }

  return NextResponse.json(
    { error: 'unsupported_format', supported: ['json-ld', 'bibtex', 'ro-crate'] },
    { status: 400 },
  );
}
