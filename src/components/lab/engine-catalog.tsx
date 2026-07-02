'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface EngineCard {
  slug: string;
  title: string;
  description: string;
  domain: string;
  version: string;
  tags: string[];
}

/**
 * Filter engines by a free-text query against slug, title, description, domain
 * (raw + humanized label), and tags — case-insensitive. Empty query returns all.
 * Pure and exported so it can be unit-tested without a browser.
 */
export function filterEngines(
  engines: EngineCard[],
  query: string,
  domainLabels: Record<string, string> = {},
): EngineCard[] {
  const q = query.trim().toLowerCase();
  if (!q) return engines;
  return engines.filter((e) => {
    const haystack = [
      e.slug,
      e.title,
      e.description,
      e.domain,
      domainLabels[e.domain] ?? '',
      ...e.tags,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function EngineCatalog({
  engines,
  domainLabels,
}: {
  engines: EngineCard[];
  domainLabels: Record<string, string>;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => filterEngines(engines, query, domainLabels),
    [engines, query, domainLabels],
  );

  // Domain order = first-seen in the catalog.
  const domainOrder = useMemo(() => {
    const seen: string[] = [];
    for (const e of engines) if (!seen.includes(e.domain)) seen.push(e.domain);
    return seen;
  }, [engines]);

  const byDomain = useMemo(() => {
    const m = new Map<string, EngineCard[]>();
    for (const e of filtered) {
      const list = m.get(e.domain) ?? [];
      list.push(e);
      m.set(e.domain, list);
    }
    return m;
  }, [filtered]);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search engines — name, domain, or tag (try 'chaos', 'protein', 'ode')"
          aria-label="Search simulation engines"
          className="w-full bg-muted/30 border border-border rounded px-3 py-2 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {engines.length} engines
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No engines match “{query}”.</p>
      ) : (
        domainOrder
          .filter((d) => byDomain.has(d))
          .map((domain) => (
            <section key={domain} className="space-y-4">
              <h2 className="text-lg font-semibold">{domainLabels[domain] ?? domain}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(byDomain.get(domain) ?? []).map((e) => (
                  <Link key={e.slug} href={`/lab/${e.slug}`} className="block group">
                    <Card className="hover:border-accent transition-colors h-full">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <Badge variant="muted">{e.slug}</Badge>
                          <span className="text-xs font-mono text-muted-foreground">
                            v{e.version}
                          </span>
                        </div>
                        <CardTitle className="group-hover:text-accent transition-colors">
                          {e.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-3">{e.description}</CardDescription>
                      </CardHeader>
                      {e.tags.length > 0 && (
                        <CardContent className="flex flex-wrap gap-1">
                          {e.tags.slice(0, 4).map((t) => (
                            <Badge key={t} variant="outline" className="text-[10px]">
                              {t}
                            </Badge>
                          ))}
                        </CardContent>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))
      )}
    </div>
  );
}
