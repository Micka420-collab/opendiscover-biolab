import { listQuests } from '@/lib/lab/discovery';
import type { QuestView } from '@/lib/lab/discovery';
import Link from 'next/link';
import { DiscoverClient } from './discover-client';

export const metadata = { title: 'Discovery Mode — OpenDiscover BioLab' };

export default function DiscoverPage() {
  // One flagship quest for now; the classify function is dropped so the quest is
  // safe to hand to a client component (classification runs server-side).
  const quest = listQuests()[0];
  const { classify: _classify, ...view } = quest;
  const questView = view as QuestView;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="text-sm text-muted-foreground">
          <Link href="/lab" className="hover:text-foreground">
            Lab
          </Link>{' '}
          / Discovery Mode
        </div>
        <h1 className="text-3xl font-bold">🧭 {questView.title}</h1>
        <p className="text-muted-foreground max-w-2xl">
          A real discovery game: the response is hidden, your probes are limited, and every claim is
          checked against the documented record — so you learn whether what you found is a known
          phenomenon or a genuinely novel regime. Powered by the deterministic{' '}
          <code>{questView.engine}</code> engine; every find carries a reproducible proof hash.
        </p>
      </header>

      <DiscoverClient quest={questView} />

      <footer className="text-xs text-muted-foreground border-t border-border pt-4">
        Probes and claims are computed by <code>POST /api/discover</code> against the real engine —
        no database, fully reproducible.
      </footer>
    </div>
  );
}
