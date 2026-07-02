import { HelpCardBody, HelpTip } from '@/components/ui/help-tip';
import { challengeForDate } from '@/lib/lab/daily-challenge';
import { helpForChallenge } from '@/lib/lab/help-content';
import Link from 'next/link';
import { ChallengeClient } from './challenge-client';

// Date-dependent: the challenge is derived from today's (UTC) date.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Daily Challenge — OpenDiscover BioLab',
  description:
    'One deterministic puzzle a day, the same for everyone on Earth. Tune a parameter, beat the target, share your best run.',
};

export default function ChallengePage() {
  const today = new Date().toISOString().slice(0, 10);
  const challenge = challengeForDate(today);
  const help = helpForChallenge(challenge.id);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-accent font-mono">
          Daily challenge · {today}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">{challenge.title}</h1>
          {help && (
            <HelpTip title={challenge.title}>
              <HelpCardBody card={help} />
            </HelpTip>
          )}
        </div>
        <p className="text-muted-foreground max-w-2xl">{challenge.brief}</p>
        <p className="text-xs text-muted-foreground">
          Same puzzle for everyone, worldwide — it&apos;s derived purely from today&apos;s date, no
          server and no randomness. Powered by the deterministic{' '}
          <Link href={`/lab/${challenge.engine}`} className="text-accent hover:underline">
            {challenge.engine}
          </Link>{' '}
          engine. Your attempt is a normal share link — post your best and others reproduce it
          exactly.
        </p>
      </header>

      <ChallengeClient challenge={challenge} date={today} />
    </div>
  );
}
