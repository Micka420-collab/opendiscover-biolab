import { Badge } from '@/components/ui/badge';
import { HelpCardBody, HelpTip } from '@/components/ui/help-tip';
import { helpForEngine } from '@/lib/lab/engine-help';
import { SHARE_PARAM, decodeExperiment } from '@/lib/lab/share';
import { describeEngine, getEngine } from '@/lib/sim';
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
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="muted">{engine.domain}</Badge>
          <Badge variant="outline">v{engine.version}</Badge>
          {engine.tags.map((t) => (
            <Badge key={t} variant="info">
              {t}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">{engine.title}</h1>
          {help && (
            <HelpTip title={engine.title}>
              <HelpCardBody card={help} />
            </HelpTip>
          )}
        </div>
        {help && (
          <p className="max-w-3xl text-foreground">
            <span className="text-muted-foreground">In plain words — </span>
            {help.plainWhat}
          </p>
        )}
        <p className="text-muted-foreground max-w-3xl whitespace-pre-line text-sm">
          {engine.description}
        </p>
        {engine.references.length > 0 && (
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
            {engine.references.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </header>

      <Playground engine={engine} initialParams={initialParams} />
    </div>
  );
}
