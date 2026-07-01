import { Badge } from '@/components/ui/badge';
import { describeParamsForForm } from '@/lib/lab/params-form';
import { getEngine } from '@/lib/sim';
import { notFound } from 'next/navigation';
import { EnginePlayground } from './playground';

export default async function EnginePage({ params }: { params: Promise<{ engine: string }> }) {
  const { engine: slug } = await params;
  const spec = getEngine(slug);
  if (!spec) notFound();

  const fields = describeParamsForForm(spec.paramsSchema);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="muted">{spec.domain.replace(/-/g, ' ')}</Badge>
          <Badge variant="outline">v{spec.version}</Badge>
          {(spec.tags ?? []).map((t) => (
            <span key={t} className="text-xs font-mono text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
        <h1 className="text-3xl font-bold">{spec.title}</h1>
        <p className="text-muted-foreground max-w-3xl">{spec.description}</p>
        {spec.references && spec.references.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {spec.references.map((ref) => (
              <li key={ref}>· {ref}</li>
            ))}
          </ul>
        )}
      </header>

      <EnginePlayground slug={spec.slug} fields={fields} example={spec.example} />
    </div>
  );
}
