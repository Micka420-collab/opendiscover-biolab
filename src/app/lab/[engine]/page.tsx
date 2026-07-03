import { Badge } from '@/components/ui/badge';
import { HelpCardBody, HelpTip } from '@/components/ui/help-tip';
import { helpForEngine } from '@/lib/lab/engine-help';
import { SHARE_PARAM, decodeExperiment } from '@/lib/lab/share';
import { describeEngine, getEngine } from '@/lib/sim';
import { domainLabel } from '@/lib/sim/domain-labels';
import { notFound } from 'next/navigation';
import { Playground } from './playground';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ engine: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { engine } = await params;
  const spec = getEngine(engine);
  if (!spec) return { title: 'Lab' };

  const title = `${spec.title} — Lab`;
  // A shared run (`?x=`) unfurls into a card showing its headline metric + hash.
  const sp = await searchParams;
  const token = typeof sp[SHARE_PARAM] === 'string' ? sp[SHARE_PARAM] : undefined;
  const decoded = decodeExperiment(token);
  if (decoded && decoded.engine === engine && token) {
    const ogUrl = `/api/lab/og?e=${encodeURIComponent(engine)}&x=${token}`;
    return {
      title,
      openGraph: { title, images: [ogUrl] },
      twitter: { card: 'summary_large_image' as const, title, images: [ogUrl] },
    };
  }
  return { title };
}

export default async function EnginePage({
  params,
  searchParams,
}: {
  params: Promise<{ engine: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { engine: slug } = await params;
  const spec = getEngine(slug);
  if (!spec) notFound();

  const engine = describeEngine(spec);
  const help = helpForEngine(slug);

  // A shared/remixed experiment permalink (`?x=<token>`) seeds the form with the
  // exact params someone else ran — but only if the token targets this engine.
  const sp = await searchParams;
  const token = typeof sp[SHARE_PARAM] === 'string' ? sp[SHARE_PARAM] : undefined;
  const shared = decodeExperiment(token);
  const initialParams = shared && shared.engine === slug ? shared.params : undefined;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">{domainLabel(engine.domain)}</Badge>
          <Badge variant="outline">v{engine.version}</Badge>
          {engine.tags.slice(0, 6).map((t) => (
            <Badge key={t} variant="info">
              {t}
            </Badge>
          ))}
          {engine.tags.length > 6 && <Badge variant="outline">+{engine.tags.length - 6}</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-4xl font-bold tracking-tight">{engine.title}</h1>
          {help && (
            <HelpTip title={engine.title}>
              <HelpCardBody card={help} />
            </HelpTip>
          )}
        </div>
        {help && (
          <div className="max-w-3xl rounded-lg border border-accent/30 bg-accent/5 p-4">
            <div className="mb-1 text-xs uppercase tracking-widest text-accent font-mono">
              In plain words
            </div>
            <p className="text-foreground leading-relaxed">{help.plainWhat}</p>
          </div>
        )}
        <p className="text-muted-foreground max-w-3xl whitespace-pre-line text-sm leading-relaxed">
          {engine.description}
        </p>
        {engine.references.length > 0 && (
          <details className="max-w-3xl text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground transition-colors">
              References ({engine.references.length})
            </summary>
            <ul className="mt-2 list-disc list-inside space-y-0.5">
              {engine.references.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </details>
        )}
      </header>

      <Playground engine={engine} initialParams={initialParams} />
    </div>
  );
}
