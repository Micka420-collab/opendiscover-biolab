import { listQuests } from '@/lib/lab/discovery';
import type { QuestView } from '@/lib/lab/discovery';
import Link from 'next/link';
import { DiscoverClient } from './discover-client';

export const metadata = { title: 'Discovery Mode — OpenDiscover BioLab' };

export default function DiscoverPage() {
  // Strip each quest's classify function so the quests are safe to hand to a
  // client component (classification runs server-side, in the discovery API).
  const questViews: QuestView[] = listQuests().map(({ classify: _classify, ...view }) => view);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="text-sm text-muted-foreground">
          <Link href="/lab" className="hover:text-foreground">
            Lab
          </Link>{' '}
          / Discovery Mode
        </div>
        <h1 className="text-3xl font-bold">🧭 Discovery Mode</h1>
        <p className="text-muted-foreground max-w-2xl">
          A real discovery game across the deterministic engines: the response is hidden, your
          probes are limited, and every claim is checked against the documented record — so you
          learn whether what you found is a known phenomenon (with its citation) or a genuinely
          novel regime. Every find carries a reproducible proof hash.
        </p>
      </header>

      <DiscoverClient quests={questViews} />

      <footer className="text-xs text-muted-foreground border-t border-border pt-4">
        Probes and claims are computed by <code>POST /api/discover</code> against the real engines —
        no database, fully reproducible. Your logbook is saved in this browser.
      </footer>
    </div>
  );
}
