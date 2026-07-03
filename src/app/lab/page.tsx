import { EngineCatalog } from '@/components/lab/engine-catalog';
import { ExplorationProgress } from '@/components/lab/exploration-progress';
import { SurpriseMe } from '@/components/lab/surprise-me';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { listEngines } from '@/lib/sim';
import { DOMAIN_LABELS } from '@/lib/sim/domain-labels';
import Link from 'next/link';

export const metadata = { title: 'Lab — OpenDiscover BioLab' };

export default async function LabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialQuery = typeof params.domain === 'string' ? params.domain : '';
  return (
    <div className="space-y-10">
      <PageHeader
        title="Lab"
        intro={
          <>
            {listEngines().length} deterministic simulation engines. Pick one to set parameters and
            run it — no account, no database, no secrets. Every run is content-hashed and
            reproducible.
          </>
        }
        actions={<SurpriseMe slugs={listEngines().map((e) => e.slug)} />}
      />

      <ExplorationProgress
        catalog={listEngines().map((e) => ({ slug: e.slug, title: e.title, domain: e.domain }))}
      />

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

      <EngineCatalog
        engines={listEngines().map((e) => ({
          slug: e.slug,
          title: e.title,
          description: e.description,
          domain: e.domain,
          version: e.version,
          tags: e.tags ?? [],
        }))}
        domainLabels={DOMAIN_LABELS}
        initialQuery={initialQuery}
      />
    </div>
  );
}
