import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listDomains, listEngines } from '@/lib/sim';
import Link from 'next/link';

function domainLabel(domain: string): string {
  return domain.replace(/-/g, ' ');
}

export default async function LabPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain } = await searchParams;
  const domains = listDomains();
  const engines = listEngines(domain);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Lab</h1>
        <p className="text-muted-foreground max-w-2xl">
          {listEngines().length} deterministic in-silico biology engines across {domains.length}{' '}
          domains. Every run is a pure function of its parameters — same input, same output, same
          hash, reproducible anywhere.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href="/lab">
          <Badge variant={domain ? 'outline' : 'default'} className="cursor-pointer">
            all
          </Badge>
        </Link>
        {domains.map((d) => (
          <Link key={d} href={`/lab?domain=${d}`}>
            <Badge variant={domain === d ? 'default' : 'outline'} className="cursor-pointer">
              {domainLabel(d)}
            </Badge>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {engines.map((e) => (
          <Link key={e.slug} href={`/lab/${e.slug}`} className="block group">
            <Card className="hover:border-accent transition-colors h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="muted">{domainLabel(e.domain)}</Badge>
                  <span className="text-xs font-mono text-muted-foreground">v{e.version}</span>
                </div>
                <CardTitle className="group-hover:text-accent transition-colors">
                  {e.title}
                </CardTitle>
                <CardDescription className="line-clamp-3">{e.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {(e.tags ?? []).slice(0, 4).map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-muted font-mono">
                      {t}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
