import { Badge } from '@/components/ui/badge';
import { describeEngine, getEngine } from '@/lib/sim';
import { notFound } from 'next/navigation';
import { Playground } from './playground';

export async function generateMetadata({ params }: { params: Promise<{ engine: string }> }) {
  const { engine } = await params;
  const spec = getEngine(engine);
  return { title: spec ? `${spec.title} — Lab` : 'Lab' };
}

export default async function EnginePage({ params }: { params: Promise<{ engine: string }> }) {
  const { engine: slug } = await params;
  const spec = getEngine(slug);
  if (!spec) notFound();

  const engine = describeEngine(spec);

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
        <h1 className="text-3xl font-bold">{engine.title}</h1>
        <p className="text-muted-foreground max-w-3xl whitespace-pre-line">{engine.description}</p>
        {engine.references.length > 0 && (
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
            {engine.references.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </header>

      <Playground engine={engine} />
    </div>
  );
}
