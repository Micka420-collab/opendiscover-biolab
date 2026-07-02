import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { listDomains, listEngines } from '@/lib/sim';
import Link from 'next/link';

export const metadata = { title: 'Lab — OpenDiscover BioLab' };

const DOMAIN_LABELS: Record<string, string> = {
  'molecular-biology': '🧫 Molecular biology',
  protein: '🧬 Protein biophysics',
  'systems-biology': '⚙️ Systems biology',
  'population-genetics': '🌱 Population genetics',
  bioprocess: '🏭 Bioprocess',
  epidemiology: '🦠 Epidemiology',
  'drug-discovery': '💊 Drug discovery',
  structural: '🔬 Structural',
  neuroscience: '🧠 Neuroscience',
  ecology: '🐺 Ecology',
};

export default function LabPage() {
  const domains = listDomains();

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Lab</h1>
        <p className="text-muted-foreground max-w-2xl">
          {listEngines().length} deterministic simulation engines. Pick one to set parameters and
          run it — no account, no database, no secrets. Every run is content-hashed and
          reproducible.
        </p>
      </header>

      <Link href="/lab/breeding" className="block group">
        <Card className="border-fuchsia-500/40 bg-fuchsia-500/5 hover:border-fuchsia-500/70 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🧬 Breeding Lab
              <Badge variant="outline">game</Badge>
            </CardTitle>
            <CardDescription>
              Cross <em>Glowzoa</em> specimens, watch real Mendelian ratios play out, and hunt rare
              phenotypes to fill your dex. A playful way into genetics — powered by the
              deterministic <code>breeding</code> engine.
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>

      {domains.map((domain) => (
        <section key={domain} className="space-y-4">
          <h2 className="text-lg font-semibold">{DOMAIN_LABELS[domain] ?? domain}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listEngines(domain).map((e) => (
              <Link key={e.slug} href={`/lab/${e.slug}`} className="block group">
                <Card className="hover:border-accent transition-colors h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant="muted">{e.slug}</Badge>
                      <span className="text-xs font-mono text-muted-foreground">v{e.version}</span>
                    </div>
                    <CardTitle className="group-hover:text-accent transition-colors">
                      {e.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-3">{e.description}</CardDescription>
                  </CardHeader>
                  {e.tags && e.tags.length > 0 && (
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
      ))}
    </div>
  );
}
