'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { recordEngineRun } from '@/lib/lab/achievements';
import {
  EMPTY_STREAK,
  type StreakState,
  getStreak,
  registerClear,
} from '@/lib/lab/challenge-streak';
import {
  type Challenge,
  TARGET_TOLERANCE,
  challengeParams,
  challengeScore,
  meetsBar,
} from '@/lib/lab/daily-challenge';
import { experimentSharePath } from '@/lib/lab/share';
import { useEffect, useState } from 'react';

interface Attempt {
  knob: number;
  value: number;
  score: number;
  met: boolean;
}

interface Best {
  knob: number;
  value: number;
  score: number;
}

function formatValue(value: number, unit?: string): string {
  const a = Math.abs(value);
  let num: string;
  if (!Number.isFinite(value)) num = String(value);
  else if (a !== 0 && (a >= 1e12 || a < 1e-4)) num = value.toExponential(3);
  else if (Number.isInteger(value)) num = value.toLocaleString('en-US');
  else num = String(Number(value.toPrecision(4)));
  return unit ? `${num} ${unit}` : num;
}

/** How close an attempt sits to the bar, phrased per goal — the play feedback. */
function gapText(challenge: Challenge, value: number): string {
  if (challenge.goal === 'target') {
    const t = challenge.target ?? 0;
    return Math.abs(t) > 1e-9
      ? `${(Math.abs((value - t) / t) * 100).toFixed(1)}% off the target`
      : `${formatValue(Math.abs(value - t), challenge.unit)} off the target`;
  }
  const par = challenge.par ?? 0;
  const gap = challenge.goal === 'maximize' ? value - par : par - value;
  return gap >= 0
    ? `clearing the bar by ${formatValue(Math.abs(gap), challenge.unit)}`
    : `${formatValue(Math.abs(gap), challenge.unit)} to go`;
}

export function ChallengeClient({ challenge, date }: { challenge: Challenge; date: string }) {
  const storageKey = `odb:challenge:${challenge.id}:${date}`;
  const [knob, setKnob] = useState(challenge.knob.default);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [best, setBest] = useState<Best | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);

  // Load the saved streak once on mount (localStorage is browser-only).
  useEffect(() => {
    setStreak(getStreak());
  }, []);

  // Load today's personal best from localStorage, and keep it in sync when
  // another tab writes a better score for the same challenge/day.
  useEffect(() => {
    const read = (): Best | null => {
      try {
        const raw = localStorage.getItem(storageKey);
        return raw ? (JSON.parse(raw) as Best) : null;
      } catch {
        return null;
      }
    };
    setBest(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setBest(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  async function run() {
    setRunning(true);
    setError(null);
    setShareMsg(null);
    try {
      const params = challengeParams(challenge, knob);
      const resp = await fetch('/api/lab/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine: challenge.engine, params }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      const metric = (json.metrics as { key: string; value: number }[]).find(
        (m) => m.key === challenge.metricKey,
      );
      if (!metric) throw new Error(`Engine did not return metric "${challenge.metricKey}"`);
      const value = metric.value;
      const score = challengeScore(challenge, value);
      const met = meetsBar(challenge, value);
      setAttempt({ knob, value, score, met });
      recordEngineRun(challenge.engine); // count toward the lab dex
      if (met) setStreak(registerClear(date)); // extend the daily streak (idempotent per day)

      // Re-read the stored best so a concurrent tab's better score isn't clobbered.
      let stored: Best | null = best;
      try {
        const raw = localStorage.getItem(storageKey);
        stored = raw ? (JSON.parse(raw) as Best) : null;
      } catch {
        /* fall back to in-memory best */
      }
      if (!stored || score > stored.score) {
        const next: Best = { knob, value, score };
        setBest(next);
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      } else if (stored.score !== best?.score) {
        setBest(stored); // adopt a better score written by another tab
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function share(knobToShare: number) {
    const params = challengeParams(challenge, knobToShare);
    const path = experimentSharePath({ engine: challenge.engine, params });
    const url =
      typeof window !== 'undefined' ? new URL(path, window.location.origin).toString() : path;
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg('Link copied — whoever opens it reproduces this exact attempt.');
    } catch {
      setShareMsg(url);
    }
  }

  // For a target goal, meetsBar accepts within TARGET_TOLERANCE of the target,
  // but relative to |target| (falling back to an absolute window when target≈0).
  // Show the window that actually applies, so target=0 reads "±0.05", not "±5%".
  const target = challenge.target ?? 0;
  const toleranceText =
    Math.abs(target) > 1e-9 ? `±${Math.round(TARGET_TOLERANCE * 100)}%` : `±${TARGET_TOLERANCE}`;
  const goalText =
    challenge.goal === 'target'
      ? `hit ${formatValue(target, challenge.unit)} (${toleranceText})`
      : challenge.goal === 'maximize'
        ? `beat ${formatValue(challenge.par ?? 0, challenge.unit)}`
        : `get under ${formatValue(challenge.par ?? 0, challenge.unit)}`;

  return (
    <div className="space-y-6">
      {streak.current > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="muted">🔥 {streak.current}-day streak</Badge>
          <span className="text-xs text-muted-foreground">best {streak.best}</span>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span>Tune {challenge.knob.label}</span>
            <Badge variant="muted">
              Goal: {challenge.metricLabel} — {goalText}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="knob" className="text-muted-foreground">
                {challenge.knob.label}
              </label>
              <span className="font-mono">
                {knob}
                {challenge.knob.unit ? ` ${challenge.knob.unit}` : ''}
              </span>
            </div>
            <input
              id="knob"
              type="range"
              min={challenge.knob.min}
              max={challenge.knob.max}
              step={challenge.knob.step}
              value={knob}
              onChange={(e) => setKnob(Number(e.target.value))}
              className="w-full accent-[hsl(var(--accent))]"
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>
                {challenge.knob.min}
                {challenge.knob.unit ? ` ${challenge.knob.unit}` : ''}
              </span>
              <span>
                {challenge.knob.max}
                {challenge.knob.unit ? ` ${challenge.knob.unit}` : ''}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={run} disabled={running} aria-busy={running}>
              {running ? 'Running…' : 'Run attempt'}
            </Button>
            <Button variant="outline" onClick={() => share(knob)} disabled={running}>
              🔗 Share this attempt
            </Button>
          </div>
          {shareMsg && <p className="text-sm text-accent break-all">{shareMsg}</p>}
          {error && (
            <p className="text-sm text-red-400" role="alert">
              Error: {error}
            </p>
          )}
        </CardContent>
      </Card>

      {attempt && (
        <Card className={attempt.met ? 'border-accent/60 bg-accent/5' : undefined}>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">{challenge.metricLabel}</div>
              <span className="font-mono text-xs text-muted-foreground">
                {gapText(challenge, attempt.value)}
              </span>
            </div>
            <div className="text-3xl font-mono font-semibold tabular-nums">
              {formatValue(attempt.value, challenge.unit)}
            </div>
            <div className="text-sm">
              {attempt.met ? (
                <span className="text-accent">
                  🎉 Cleared — nice one. Share it, or nudge the dial to beat your own best.
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Not there yet — {goalText}. Nudge the {challenge.knob.label.toLowerCase()} and run
                  again.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Your best today</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {best ? (
              <>
                <div className="font-mono text-lg">{formatValue(best.value, challenge.unit)}</div>
                <div className="text-xs text-muted-foreground">
                  at {challenge.knob.label} = {best.knob}
                  {challenge.knob.unit ? ` ${challenge.knob.unit}` : ''}
                </div>
                <Button
                  variant="outline"
                  className="h-7 text-xs mt-2"
                  onClick={() => share(best.knob)}
                >
                  🔗 Share my best
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">
                No attempt yet. Run one to set a personal best.
              </p>
            )}
            <p className="text-[10px] text-muted-foreground pt-2">
              Stored locally in your browser — personal best, not a global ranking.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Hint</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{challenge.hint}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
