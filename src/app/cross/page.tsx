import { HelpTip } from '@/components/ui/help-tip';
import { PageHeader } from '@/components/ui/page-header';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CrossClient } from './cross-client';
import { DAILY_ROUNDS } from './lib/specimens';

// The daily gauntlet is derived from today's (UTC) date — render per request.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'CrossLab — predict what the genes will do',
  description:
    'A beginner-friendly genetics game: cross two organisms, predict what the offspring will look like, then watch the real Punnett-square truth reveal — Mendel’s laws, made playable and watchable. Built on OpenDiscover BioLab’s deterministic breeding engine.',
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function CrossPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const mode = sp.mode === 'endless' ? 'endless' : 'daily';
  const date = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Genetics game"
        title="CrossLab"
        help={
          <HelpTip title="What is CrossLab?">
            <div className="space-y-2 text-sm">
              <p>
                Real genetics you can play. You’re handed two parent organisms and you predict what
                their offspring will look like — then the actual answer is revealed.
              </p>
              <p className="text-muted-foreground">
                No biology background needed: every term has a “?” you can tap, and the reveal shows
                you exactly why. It’s the same maths Gregor Mendel used on pea plants in 1865.
              </p>
            </div>
          </HelpTip>
        }
        intro={
          <>
            Cross two organisms, form a <span className="text-foreground">hypothesis</span> about
            their offspring, then watch the deterministic truth reveal — a Punnett square, the real
            odds, and a litter of actual babies. {DAILY_ROUNDS} fresh crosses a day, the same for
            everyone on Earth.
          </>
        }
        meta={
          <>
            Powered by the reproducible{' '}
            <Link href="/lab/breeding" className="text-accent hover:underline">
              breeding
            </Link>{' '}
            engine — the genetics is computed, never scripted, so a streamer’s round replays exactly
            for every viewer.
          </>
        }
      />

      <CrossClient mode={mode} date={date} />
    </div>
  );
}
