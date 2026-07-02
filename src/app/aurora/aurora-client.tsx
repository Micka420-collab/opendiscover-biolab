'use client';

/**
 * AURORA — the spectator discovery game.
 *
 * Tune one luminous dial to find the hidden answer on a fully-visible fitness landscape,
 * LOCK it with a live engine re-run (the pool's own `meetsBar` is the judge), and light a
 * beacon on a living Earth. Five date-seeded rounds are the daily gauntlet everyone on
 * Earth shares; Endless cycles the whole pool; Watch auto-solves hands-free for a stream.
 * 100% client-deterministic — no network, no server writes; the shared goal is the honest
 * lit/total AURORA index, relayed cosmetically through a `?lit=` link.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { recordEngineRun } from '@/lib/lab/achievements';
import {
  EMPTY_STREAK,
  type StreakState,
  getStreak,
  registerClear,
} from '@/lib/lab/challenge-streak';
import {
  CHALLENGE_POOL,
  type Challenge,
  TARGET_TOLERANCE,
  challengeParams,
  meetsBar,
} from '@/lib/lab/daily-challenge';
import { experimentOverlayPath, experimentSharePath } from '@/lib/lab/share';
import { runEngine } from '@/lib/sim';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuroraEarth } from './components/aurora-earth';
import { SignalScope } from './components/signal-scope';
import { VerdictGauge } from './components/verdict-gauge';
import { useReducedMotion } from './hooks/use-reduced-motion';
import { scoreRound } from './lib/gauntlet';
import { autoTune, sampleLandscape, signalAtKnob, valueAtKnob } from './lib/landscape';
import { scoreToColor } from './lib/palette';
import { auroraIndex, decodeLit, encodeLit, nextMilestone, planetFor } from './lib/planet';
import { registerLit, litIds as storedLitIds } from './lib/progress';

type Phase = 'scan' | 'tune' | 'locked' | 'complete';
type Mode = 'play' | 'watch' | 'endless';

interface LockInfo {
  value: number;
  perfect: boolean;
  permalink: string;
  overlay: string;
  knob: number;
  why: string;
  region: string;
}

function fmt(value: number, unit?: string): string {
  if (!Number.isFinite(value)) return '—';
  const num = Number.isInteger(value) ? String(value) : value.toPrecision(4);
  return unit ? `${num} ${unit}` : num;
}

function goalText(c: Challenge): string {
  if (c.goal === 'target') return `hit ${fmt(c.target ?? 0, c.unit)}`;
  if (c.goal === 'maximize') return `beat ${fmt(c.par ?? 0, c.unit)}`;
  return `get under ${fmt(c.par ?? 0, c.unit)}`;
}

function judgePerfect(c: Challenge, value: number, signal: number): boolean {
  if (c.goal === 'target') {
    const t = c.target ?? 0;
    const denom = Math.abs(t) > 1e-9 ? Math.abs(t) : 1;
    return Math.abs(value - t) / denom <= TARGET_TOLERANCE / 2;
  }
  return signal >= 0.92;
}

export function AuroraClient({
  gauntlet,
  date,
  litParam,
  mode: initialMode,
}: {
  gauntlet: Challenge[];
  date: string;
  litParam?: string;
  mode: Mode;
}) {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('scan');
  const [knob, setKnob] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [lock, setLock] = useState<LockInfo | null>(null);
  const [pulseKey, setPulseKey] = useState(0);
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [litSet, setLitSet] = useState<Set<string>>(new Set());
  const [narration, setNarration] = useState<string>('');
  const [relayMsg, setRelayMsg] = useState<string | null>(null);

  // The active round: gauntlet play/watch walk the 5; endless cycles the whole pool.
  const rounds = mode === 'endless' ? CHALLENGE_POOL : gauntlet;
  const complete = mode !== 'endless' && roundIndex >= rounds.length;
  const challenge = complete ? null : (rounds[roundIndex % rounds.length] as Challenge);

  const landscape = useMemo(
    () => (challenge ? sampleLandscape(challenge, runEngine, 72) : null),
    [challenge],
  );

  // Seed streak + lit-set (stored truths ∪ cosmetic ?lit= relay) once on mount.
  useEffect(() => {
    setStreak(getStreak());
    const merged = new Set<string>(storedLitIds());
    for (const id of decodeLit(litParam)) merged.add(id);
    setLitSet(merged);
  }, [litParam]);

  // New round → reset dial to the default and run the scan reveal.
  useEffect(() => {
    if (!challenge || !landscape) return;
    setKnob(challenge.knob.default);
    setLock(null);
    setNarration(
      `Scanning the spectrum — ${challenge.metricLabel}. Find where it ${goalText(challenge)}.`,
    );
    if (reduced) {
      setScanProgress(1);
      setPhase('tune');
      return;
    }
    setScanProgress(0);
    setPhase('scan');
    let raf = 0;
    let start = -1;
    const step = (t: number) => {
      if (start < 0) start = t;
      const p = Math.min(1, (t - start) / 850);
      setScanProgress(p);
      if (p < 1) raf = requestAnimationFrame(step);
      else setPhase('tune');
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [challenge, landscape, reduced]);

  const liveValue = landscape ? valueAtKnob(landscape, knob) : Number.NaN;
  const liveSignal = landscape ? signalAtKnob(landscape, knob) : 0;

  const advance = useCallback(() => {
    setRoundIndex((i) => {
      const next = i + 1;
      if (mode !== 'endless' && next >= rounds.length) {
        setStreak(registerClear(date)); // bank the 🔥 streak on a full gauntlet clear
        setPhase('complete');
      }
      return next;
    });
  }, [mode, rounds.length, date]);

  const doLock = useCallback(
    (atKnob: number) => {
      if (!challenge || !landscape) return false;
      let value: number;
      try {
        const r = runEngine(challenge.engine, challengeParams(challenge, atKnob));
        const m = r.metrics.find((mm) => mm.key === challenge.metricKey);
        value = typeof m?.value === 'number' ? m.value : Number.NaN;
      } catch {
        return false;
      }
      if (!Number.isFinite(value) || !meetsBar(challenge, value)) return false;

      const perfect = judgePerfect(challenge, value, signalAtKnob(landscape, atKnob));
      const params = challengeParams(challenge, atKnob);
      const permalink = experimentSharePath({ engine: challenge.engine, params });
      const overlay = experimentOverlayPath({ engine: challenge.engine, params });
      const spot = planetFor(challenge.id);

      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setScore((s) => s + scoreRound({ combo: nextCombo, perfect }).total);
      recordEngineRun(challenge.engine);
      setLitSet((prev) => {
        const n = new Set(prev);
        n.add(challenge.id);
        return n;
      });
      registerLit(challenge.id, permalink);
      setPulseKey((k) => k + 1);
      setKnob(atKnob);
      setLock({
        value,
        perfect,
        permalink,
        overlay,
        knob: atKnob,
        why: spot.whyEarthNeedsIt,
        region: spot.region,
      });
      setNarration(`${perfect ? 'PERFECT — ' : 'Confirmed — '}${spot.whyEarthNeedsIt}`);
      setPhase('locked');
      return true;
    },
    [challenge, landscape, combo],
  );

  // Dragging the dial: show live interpolated value; auto-lock once an authoritative
  // re-run near the band actually passes (never trusting interpolation for the win).
  const onKnob = useCallback(
    (v: number) => {
      if (phase !== 'tune') return;
      setKnob(v);
      if (landscape && signalAtKnob(landscape, v) >= 0.5) doLock(v);
    },
    [phase, landscape, doLock],
  );

  // Watch mode: the deterministic auto-tuner drives the dial to the answer, hands-free.
  useEffect(() => {
    if (mode !== 'watch' || phase !== 'tune' || !challenge || !landscape) return;
    const sol = autoTune(challenge, runEngine);
    if (reduced) {
      doLock(sol.knob);
      return;
    }
    let raf = 0;
    let start = -1;
    const from = challenge.knob.default;
    const step = (t: number) => {
      if (start < 0) start = t;
      const p = Math.min(1, (t - start) / 1600);
      const eased = 1 - (1 - p) ** 3;
      const v = from + (sol.knob - from) * eased;
      setKnob(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else doLock(sol.knob);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [mode, phase, challenge, landscape, reduced, doLock]);

  // Auto-advance after a lock in Watch / Endless so a stream never idles.
  useEffect(() => {
    if (phase !== 'locked') return;
    if (mode === 'play') return;
    const id = setTimeout(advance, reduced ? 900 : 2400);
    return () => clearTimeout(id);
  }, [phase, mode, advance, reduced]);

  const index = auroraIndex(litSet.size);
  const milestone = nextMilestone(index);

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text);
      setRelayMsg(msg);
    } catch {
      setRelayMsg(text);
    }
  }

  function shareRelay() {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${base}/aurora?lit=${encodeLit(litSet)}`;
    copy(
      url,
      `Relay link copied — hands over your Earth at ${Math.round(index * 100)}%. Pass it on.`,
    );
  }

  const accent = scoreToColor(complete ? 1 : liveSignal);

  return (
    <div
      className="aurora-scene min-h-[80vh] -mx-6 -my-10 px-6 py-8 text-[hsl(0_0%_98%)]"
      style={{
        background:
          'radial-gradient(1200px 700px at 70% -10%, hsl(240 40% 12%), hsl(240 10% 4%) 60%)',
      }}
    >
      <style>{auroraCss}</style>

      <div className="mx-auto max-w-6xl grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* ── Left column: banner, scope, gauge, dial ───────────────────── */}
        <section className="flex flex-col gap-4 min-w-0">
          <Hud
            roundIds={mode === 'endless' ? [] : gauntlet.map((c) => c.id)}
            roundIndex={roundIndex}
            mode={mode}
            combo={combo}
            score={score}
            streak={streak.current}
            onMode={(m) => {
              setMode(m);
              setRoundIndex(0);
              setCombo(0);
              setScore(0);
              setPhase('scan');
            }}
          />

          {challenge && landscape ? (
            <>
              <RoundBanner challenge={challenge} />

              <div className="relative rounded-xl border border-[hsl(240_6%_16%)] bg-[hsl(240_8%_8%/0.6)] backdrop-blur overflow-hidden">
                <div className="h-[46vh] min-h-[280px] w-full">
                  <SignalScope
                    landscape={landscape}
                    knob={knob}
                    progress={scanProgress}
                    reducedMotion={reduced}
                    className="w-full h-full block"
                  />
                </div>

                <div className="pointer-events-none absolute right-3 top-3 w-[min(38%,220px)]">
                  <VerdictGauge
                    signal={complete ? 1 : liveSignal}
                    locked={phase === 'locked'}
                    perfect={lock?.perfect ?? false}
                  >
                    <div
                      className="font-mono tabular-nums font-bold leading-none"
                      style={{ fontSize: 'clamp(1.4rem,3vw,2.2rem)', color: accent }}
                    >
                      {fmt(phase === 'locked' && lock ? lock.value : liveValue)}
                    </div>
                    <div className="text-[10px] text-[hsl(240_5%_65%)] mt-1">
                      {challenge.metricLabel}
                    </div>
                  </VerdictGauge>
                </div>

                {phase === 'scan' && (
                  <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none">
                    <span className="text-xs uppercase tracking-widest text-[hsl(240_5%_65%)] animate-pulse">
                      scanning the spectrum…
                    </span>
                  </div>
                )}
              </div>

              <TuningDial
                challenge={challenge}
                knob={knob}
                signal={liveSignal}
                disabled={phase !== 'tune' || mode === 'watch'}
                onChange={onKnob}
                onCommit={() => phase === 'tune' && mode !== 'watch' && doLock(knob)}
              />

              <NarrationTicker text={narration} />

              {phase === 'locked' && lock && (
                <RoundSummary
                  challenge={challenge}
                  lock={lock}
                  mode={mode}
                  onNext={advance}
                  onCopy={copy}
                />
              )}
            </>
          ) : (
            <CompleteCard
              score={score}
              streak={streak.current}
              index={index}
              onEndless={() => {
                setMode('endless');
                setRoundIndex(0);
                setPhase('scan');
              }}
              onShareRelay={shareRelay}
            />
          )}
        </section>

        {/* ── Right rail: living Earth + planetary meter ────────────────── */}
        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border border-[hsl(240_6%_16%)] bg-[hsl(240_8%_8%/0.6)] backdrop-blur p-4 flex items-center justify-center">
            <div className="w-full max-w-[300px] aspect-square">
              <AuroraEarth
                litIds={litSet}
                index={index}
                reducedMotion={reduced}
                pulseKey={pulseKey}
                className="w-full h-full block"
              />
            </div>
          </div>

          <PlanetMeter
            litCount={litSet.size}
            index={index}
            milestone={milestone?.label ?? 'Planetary dawn'}
            onRelay={shareRelay}
            relayMsg={relayMsg}
          />
        </aside>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Hud({
  roundIds,
  roundIndex,
  mode,
  combo,
  score,
  streak,
  onMode,
}: {
  roundIds: string[];
  roundIndex: number;
  mode: Mode;
  combo: number;
  score: number;
  streak: number;
  onMode: (m: Mode) => void;
}) {
  const modes: Mode[] = ['play', 'endless', 'watch'];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-lg font-bold tabular-nums" aria-label="score">
          {score.toLocaleString()}
        </span>
        {combo > 1 && (
          <span className="aurora-pop text-sm font-mono text-[hsl(96_80%_60%)]">×{combo}</span>
        )}
        {streak > 0 && <Badge variant="muted">🔥 {streak}</Badge>}
      </div>
      <div className="flex items-center gap-2">
        {mode !== 'endless' && (
          <div className="flex gap-1" aria-label="round progress">
            {roundIds.map((id, i) => (
              <span
                key={id}
                className={`h-1.5 w-5 rounded-full ${
                  i < roundIndex
                    ? 'bg-[hsl(142_71%_45%)]'
                    : i === roundIndex
                      ? 'bg-[hsl(0_0%_98%)]'
                      : 'bg-[hsl(240_6%_20%)]'
                }`}
              />
            ))}
          </div>
        )}
        <div className="flex rounded-md border border-[hsl(240_6%_16%)] overflow-hidden text-xs">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMode(m)}
              className={`px-2.5 py-1 capitalize ${
                mode === m
                  ? 'bg-[hsl(142_71%_45%)] text-[hsl(240_10%_4%)] font-medium'
                  : 'text-[hsl(240_5%_65%)] hover:text-[hsl(0_0%_98%)]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoundBanner({ challenge }: { challenge: Challenge }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-lg font-semibold">{challenge.title}</span>
      <Badge variant="outline">{challenge.engine}</Badge>
      <Badge variant="muted">Goal: {goalText(challenge)}</Badge>
    </div>
  );
}

function TuningDial({
  challenge,
  knob,
  signal,
  disabled,
  onChange,
  onCommit,
}: {
  challenge: Challenge;
  knob: number;
  signal: number;
  disabled: boolean;
  onChange: (v: number) => void;
  onCommit: () => void;
}) {
  const color = scoreToColor(signal);
  return (
    <div className="rounded-xl border border-[hsl(240_6%_16%)] bg-[hsl(240_8%_8%/0.6)] backdrop-blur p-4 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <label htmlFor="aurora-dial" className="text-[hsl(240_5%_65%)]">
          {challenge.knob.label}
        </label>
        <span className="font-mono tabular-nums" style={{ color }}>
          {Number.isInteger(knob) ? knob : knob.toPrecision(4)}
          {challenge.knob.unit ? ` ${challenge.knob.unit}` : ''}
        </span>
      </div>
      <input
        id="aurora-dial"
        type="range"
        min={challenge.knob.min}
        max={challenge.knob.max}
        step={challenge.knob.step}
        value={knob}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        aria-label={`${challenge.knob.label} — drag to find where the metric ${goalText(challenge)}`}
        aria-valuetext={`${knob}${challenge.knob.unit ? ` ${challenge.knob.unit}` : ''}, ${Math.round(
          signal * 100,
        )} percent signal`}
        className="w-full disabled:opacity-40"
        style={{ accentColor: color }}
      />
      <div className="flex justify-between text-[10px] font-mono text-[hsl(240_5%_50%)]">
        <span>{challenge.knob.min}</span>
        <span>{challenge.knob.max}</span>
      </div>
    </div>
  );
}

function NarrationTicker({ text }: { text: string }) {
  return (
    <p
      className="text-sm text-[hsl(240_5%_75%)] min-h-[1.25rem] border-l-2 border-[hsl(142_71%_45%/0.5)] pl-3"
      aria-live="polite"
    >
      {text}
    </p>
  );
}

function RoundSummary({
  challenge,
  lock,
  mode,
  onNext,
  onCopy,
}: {
  challenge: Challenge;
  lock: LockInfo;
  mode: Mode;
  onNext: () => void;
  onCopy: (text: string, msg: string) => void;
}) {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return (
    <div className="rounded-xl border border-[hsl(142_71%_45%/0.5)] bg-[hsl(142_71%_45%/0.08)] p-4 space-y-3 aurora-bloom">
      <div className="flex items-center gap-2">
        <Badge variant="muted">{lock.perfect ? '✦ PERFECT' : '✓ LOCKED'}</Badge>
        <span className="text-sm text-[hsl(240_5%_75%)]">
          {challenge.metricLabel} = {fmt(lock.value, challenge.unit)} — beacon lit over{' '}
          {lock.region}
        </span>
      </div>
      <p className="text-sm text-[hsl(0_0%_92%)]">{lock.why}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            onCopy(
              `${base}${lock.permalink}`,
              'Run link copied — anyone can reproduce this exact lock.',
            )
          }
        >
          🔗 Share this lock
        </Button>
        <Button
          variant="outline"
          onClick={() => onCopy(`${base}${lock.overlay}`, 'OBS overlay link copied.')}
        >
          📺 Overlay link
        </Button>
        {mode === 'play' && <Button onClick={onNext}>Next round →</Button>}
      </div>
    </div>
  );
}

function PlanetMeter({
  litCount,
  index,
  milestone,
  onRelay,
  relayMsg,
}: {
  litCount: number;
  index: number;
  milestone: string;
  onRelay: () => void;
  relayMsg: string | null;
}) {
  return (
    <div className="rounded-xl border border-[hsl(240_6%_16%)] bg-[hsl(240_8%_8%/0.6)] backdrop-blur p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-widest text-[hsl(240_5%_65%)]">
          AURORA index
        </span>
        <span className="font-mono tabular-nums text-lg" style={{ color: scoreToColor(index) }}>
          {Math.round(index * 100)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-[hsl(240_6%_16%)] overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${index * 100}%`,
            background: `linear-gradient(90deg, hsl(190 75% 45%), ${scoreToColor(index)})`,
            transition: 'width 500ms ease-out',
          }}
        />
      </div>
      <p className="text-xs text-[hsl(240_5%_65%)]">
        {litCount} technique{litCount === 1 ? '' : 's'} confirmed — next:{' '}
        <span className="text-[hsl(0_0%_92%)]">{milestone}</span>. These are your verified
        discoveries, not a live population.
      </p>
      <Button variant="outline" className="h-7 text-xs" onClick={onRelay}>
        🌍 Pass on your Earth
      </Button>
      {relayMsg && <p className="text-xs text-[hsl(142_71%_60%)] break-all">{relayMsg}</p>}
    </div>
  );
}

function CompleteCard({
  score,
  streak,
  index,
  onEndless,
  onShareRelay,
}: {
  score: number;
  streak: number;
  index: number;
  onEndless: () => void;
  onShareRelay: () => void;
}) {
  return (
    <div className="rounded-xl border border-[hsl(142_71%_45%/0.5)] bg-[hsl(142_71%_45%/0.08)] p-6 space-y-4 text-center aurora-bloom">
      <div className="text-2xl font-semibold">Gauntlet cleared ✦</div>
      <div className="font-mono tabular-nums text-4xl" style={{ color: scoreToColor(1) }}>
        {score.toLocaleString()}
      </div>
      <p className="text-sm text-[hsl(240_5%_75%)]">
        {streak > 0 && `🔥 ${streak}-day streak banked. `}
        Your Earth is {Math.round(index * 100)}% aglow. Keep lighting beacons in Endless.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onEndless}>Play endless →</Button>
        <Button variant="outline" onClick={onShareRelay}>
          🌍 Pass on your Earth
        </Button>
      </div>
    </div>
  );
}

const auroraCss = `
.aurora-pop { animation: aurora-pop 320ms ease-out; }
@keyframes aurora-pop { 0% { transform: scale(1.6); opacity: 0.4; } 100% { transform: scale(1); opacity: 1; } }
.aurora-bloom { animation: aurora-bloom 500ms ease-out; }
@keyframes aurora-bloom { 0% { transform: translateY(6px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
`;
