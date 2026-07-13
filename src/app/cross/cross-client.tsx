'use client';

/**
 * CrossLab — the playable loop.
 *
 * Each round shows two parents, you HYPOTHESISE which look the offspring will
 * mostly be (and optionally bet its exact share), then the deterministic
 * `breeding` engine reveals the truth: a Punnett square, the real distribution,
 * and a litter of actual babies. A date-seeded daily gauntlet is the same for
 * everyone; Endless is for practice. Everything is a pure function of the cross,
 * so it renders identically on the server and the client (no hydration drama).
 */

import { HelpTip } from '@/components/ui/help-tip';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from '../aurora/hooks/use-reduced-motion';
import { Litter } from './components/litter';
import { OutcomeBars } from './components/outcome-bars';
import { PunnettGrid } from './components/punnett-grid';
import { SpecimenCard } from './components/specimen-card';
import { paletteFor } from './lib/looks';
import { type Hypothesis, type Score, maxScore, scoreHypothesis, totalScore } from './lib/scoring';
import { LITTER_SIZE, solveCross } from './lib/solve';
import { type Cross, type Parent, dailyCrosses, endlessCross } from './lib/specimens';

type Mode = 'daily' | 'endless';
type Phase = 'predict' | 'reveal';

/** A parent's genotype rendered across the active loci, e.g. "Ss Cc". */
function genotypeString(cross: Cross, parent: Parent): string {
  return cross.genes
    .map((g) => (parent.genotype[g.symbol] ?? []).join(''))
    .filter(Boolean)
    .join(' ');
}

const DAILY_KEY = 'crosslab:daily-best';

function loadDailyBest(date: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DAILY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date?: string; best?: number };
    return parsed.date === date && typeof parsed.best === 'number' ? parsed.best : null;
  } catch {
    return null;
  }
}

/** Re-read before writing so a second tab can't clobber a better score. */
function saveDailyBest(date: string, total: number): number {
  if (typeof window === 'undefined') return total;
  try {
    const prev = loadDailyBest(date) ?? 0;
    const best = Math.max(prev, total);
    window.localStorage.setItem(DAILY_KEY, JSON.stringify({ date, best }));
    return best;
  } catch {
    return total;
  }
}

export function CrossClient({ mode, date }: { mode: Mode; date: string }) {
  const reduced = useReducedMotion();
  const dailies = useMemo(() => dailyCrosses(date), [date]);

  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('predict');
  const [pick, setPick] = useState<string | null>(null);
  const [betOpen, setBetOpen] = useState(false);
  const [pct, setPct] = useState(50);
  const [scores, setScores] = useState<Score[]>([]);
  const [copied, setCopied] = useState(false);
  const [dailyBest, setDailyBest] = useState<number | null>(null);

  useEffect(() => {
    setDailyBest(loadDailyBest(date));
  }, [date]);

  const dailyDone = mode === 'daily' && roundIndex >= dailies.length;
  const cross: Cross | null = dailyDone
    ? null
    : mode === 'daily'
      ? (dailies[roundIndex] as Cross)
      : endlessCross(roundIndex);

  const solved = useMemo(() => (cross ? solveCross(cross) : null), [cross]);
  const colorFor = useMemo(
    () => paletteFor(solved ? solved.options.map((o) => o.label) : []),
    [solved],
  );

  const currentScore =
    phase === 'reveal' && solved
      ? scoreHypothesis(solved, { pick: pick ?? '', pct: betOpen ? pct : null } as Hypothesis)
      : null;

  const runTotal = totalScore(scores);

  function reveal() {
    if (!solved || pick == null) return;
    const s = scoreHypothesis(solved, { pick, pct: betOpen ? pct : null });
    setScores((prev) => {
      const next = [...prev, s];
      if (mode === 'daily' && roundIndex === dailies.length - 1) {
        setDailyBest(saveDailyBest(date, totalScore(next)));
      }
      return next;
    });
    setPhase('reveal');
  }

  function nextRound() {
    setRoundIndex((i) => i + 1);
    setPhase('predict');
    setPick(null);
    setBetOpen(false);
    setPct(50);
  }

  async function share() {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const text = `🧬 CrossLab — ${date}\nI scored ${runTotal}/${maxScore(dailies.length)} predicting genetics crosses.\nCan you read the DNA? ${origin}/cross`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  // -- Daily summary ---------------------------------------------------------
  if (dailyDone) {
    const max = maxScore(dailies.length);
    const correct = scores.filter((s) => s.pickCorrect).length;
    return (
      <section className="space-y-6">
        <div className="rounded-2xl border border-accent/40 bg-accent/5 p-6 text-center">
          <div className="text-xs font-mono uppercase tracking-widest text-accent">
            Daily gauntlet complete
          </div>
          <div className="mt-2 text-5xl font-bold tabular-nums">
            {runTotal}
            <span className="text-2xl text-muted-foreground">/{max}</span>
          </div>
          <p className="mt-2 text-muted-foreground">
            {correct} of {dailies.length} crosses called correctly
            {dailyBest != null && dailyBest > runTotal ? (
              <> · today’s best {dailyBest}</>
            ) : (
              <> · a new personal best for today 🎉</>
            )}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={share}
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
            >
              {copied ? 'Copied!' : 'Share result'}
            </button>
            <Link
              href="/cross?mode=endless"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:border-accent"
            >
              Keep playing (Endless)
            </Link>
          </div>
        </div>

        <ol className="space-y-2">
          {dailies.map((c, i) => {
            const s = scores[i];
            return (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/10 px-4 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden="true">{c.emoji}</span>
                  <span className="text-muted-foreground">
                    Round {i + 1} · {c.world}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={s?.pickCorrect ? 'text-accent' : 'text-muted-foreground'}>
                    {s?.pickCorrect ? '✓ called it' : '✗ missed'}
                  </span>
                  <span className="font-mono tabular-nums">+{s?.total ?? 0}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="text-center text-xs text-muted-foreground">
          Come back tomorrow for a fresh set — everyone on Earth breeds the same specimens each day.
        </p>
      </section>
    );
  }

  if (!cross || !solved) return null;

  const totalRounds = mode === 'daily' ? dailies.length : null;
  const options = solved.options;

  // -- The round -------------------------------------------------------------
  return (
    <section className="space-y-6">
      {/* Status strip + mode toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-xs uppercase tracking-wide">
            {mode === 'daily'
              ? `Daily · round ${roundIndex + 1}/${totalRounds}`
              : `Endless · #${roundIndex + 1}`}
          </span>
          <span className="font-mono tabular-nums">score {runTotal}</span>
        </div>
        <div className="flex gap-1">
          <Link
            href="/cross"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === 'daily' ? 'bg-accent text-accent-foreground' : 'border border-border hover:border-accent'}`}
          >
            Daily
          </Link>
          <Link
            href="/cross?mode=endless"
            className={`rounded-full px-3 py-1 text-xs font-semibold ${mode === 'endless' ? 'bg-accent text-accent-foreground' : 'border border-border hover:border-accent'}`}
          >
            Endless
          </Link>
        </div>
      </div>

      {/* The cross */}
      <div className="rounded-2xl border border-border bg-muted/5 p-6">
        <div className="text-xs font-mono uppercase tracking-widest text-accent">{cross.world}</div>
        <p className="mt-1 max-w-2xl text-muted-foreground">{cross.blurb}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
          <SpecimenCard
            emoji={cross.emoji}
            label={cross.parentA.name}
            genotype={genotypeString(cross, cross.parentA)}
            caption={solved.parentAPhenotype}
            color={colorFor(solved.parentAPhenotype)}
          />
          <div className="text-3xl text-muted-foreground" aria-label="crossed with">
            ×
          </div>
          <SpecimenCard
            emoji={cross.emoji}
            label={cross.parentB.name}
            genotype={genotypeString(cross, cross.parentB)}
            caption={solved.parentBPhenotype}
            color={colorFor(solved.parentBPhenotype)}
          />
          <div className="text-3xl text-muted-foreground" aria-hidden="true">
            →
          </div>
          <SpecimenCard emoji="❓" label="the offspring" size="md" color="#64748b" />
        </div>
      </div>

      {/* Prediction */}
      {phase === 'predict' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Which look will be most common?</h2>
            <HelpTip title="Most common look">
              <div className="space-y-2 text-sm">
                <p>
                  Each baby inherits one gene copy from each parent. Some combinations are more
                  likely than others, so one look usually shows up more than the rest.
                </p>
                <p className="text-muted-foreground">
                  Pick the look you think most of the babies will have. Nail it for the points —
                  then optionally bet its exact share for a bonus.
                </p>
              </div>
            </HelpTip>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((o) => {
              const selected = pick === o.label;
              const color = colorFor(o.label);
              return (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setPick(o.label)}
                  aria-pressed={selected}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                    selected ? 'bg-accent/5' : 'border-border hover:border-accent/60'
                  }`}
                  style={selected ? { borderColor: color } : undefined}
                >
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="font-medium">{o.label}</span>
                </button>
              );
            })}
          </div>

          {/* Optional exact-share bet */}
          <div className="rounded-xl border border-dashed border-border p-4">
            {!betOpen ? (
              <button
                type="button"
                onClick={() => setBetOpen(true)}
                disabled={pick == null}
                className="text-sm font-semibold text-accent disabled:cursor-not-allowed disabled:text-muted-foreground"
              >
                ＋ Bet the exact share for a bonus (optional)
              </button>
            ) : (
              <div className="space-y-2">
                <label htmlFor="bet" className="flex items-center justify-between text-sm">
                  <span>
                    I bet <span className="font-semibold">{pick}</span> is…
                  </span>
                  <span className="font-mono tabular-nums text-accent">{pct}%</span>
                </label>
                <input
                  id="bet"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={pct}
                  onChange={(e) => setPct(Number(e.target.value))}
                  className="w-full accent-[#22c55e]"
                />
                <p className="text-xs text-muted-foreground">
                  …of the {LITTER_SIZE}-baby litter. Closer bets earn more of the bonus.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={reveal}
            disabled={pick == null}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pick == null ? 'Pick a look to reveal' : 'Reveal the offspring →'}
          </button>
        </div>
      )}

      {/* Reveal */}
      {phase === 'reveal' && currentScore && (
        <div className="space-y-6">
          <div
            className={`rounded-2xl border p-5 ${
              currentScore.pickCorrect
                ? 'border-accent/50 bg-accent/5'
                : 'border-border bg-muted/10'
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-lg font-semibold">
                {currentScore.pickCorrect
                  ? '✓ You called it!'
                  : `✗ Not quite — most were “${solved.mostCommon.join('” or “')}”`}
              </span>
              <span className="font-mono text-xl tabular-nums text-accent">
                +{currentScore.total}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {solved.ratio} phenotypic ratio.{' '}
              {betOpen && (
                <>
                  Your bet: {pct}% vs actual {(currentScore.actualProbability * 100).toFixed(0)}% →
                  +{currentScore.bonus} bonus.
                </>
              )}
            </p>
            {solved.hiddenLooks.length > 0 && (
              <p className="mt-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                🔬 <span className="font-semibold">Hidden trait surprise:</span> neither parent
                looked “{solved.hiddenLooks.join('” / “')}”, yet it appeared. Each parent secretly
                carries two versions of every gene (its alleles) — and some pairings only show up in
                the next generation.
              </p>
            )}
          </div>

          {solved.punnett && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">The Punnett square</h3>
                <HelpTip title="Punnett square">
                  <div className="space-y-2 text-sm">
                    <p>
                      A grid of every way one gene copy from each parent can combine. Each parent's
                      possible gene copies label a side; every inner box is one possible baby.
                    </p>
                    <p className="text-muted-foreground">
                      Count the boxes of each colour and you have the odds — this is the machine
                      behind the ratio.
                    </p>
                  </div>
                </HelpTip>
              </div>
              <PunnettGrid punnett={solved.punnett} colorFor={colorFor} />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Every possible look</h3>
              <HelpTip title="Phenotypic ratio">
                <p className="text-sm">
                  The share of babies expected to show each look, straight from the genetics. “≈N/
                  {LITTER_SIZE}” is roughly how many of this litter that means.
                </p>
              </HelpTip>
            </div>
            <OutcomeBars
              shares={solved.ranked}
              colorFor={colorFor}
              litterSize={LITTER_SIZE}
              pickedLabel={pick}
              reduced={reduced}
            />
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">The litter — {LITTER_SIZE} actual offspring</h3>
            <Litter
              litter={solved.litter}
              emoji={cross.emoji}
              colorFor={colorFor}
              reduced={reduced}
            />
          </div>

          <button
            type="button"
            onClick={nextRound}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-accent-foreground hover:opacity-90"
          >
            {mode === 'daily' && roundIndex === dailies.length - 1
              ? 'See your daily result →'
              : 'Next cross →'}
          </button>
        </div>
      )}
    </section>
  );
}
