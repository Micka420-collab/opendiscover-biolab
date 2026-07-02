/**
 * Daily-challenge streak tracking — the "🔥 day N" retention hook.
 *
 * A streak counts consecutive UTC days on which you clear the daily challenge. The
 * reducer is a pure total function of the previous state and today's date, so it is
 * fully unit-tested; the browser helpers (localStorage) are guarded so the module
 * imports cleanly in Node too (mirrors `achievements.ts`).
 */

export interface StreakState {
  /** ISO `YYYY-MM-DD` of the most recent cleared day, or null if never. */
  lastClearedDate: string | null;
  /** Consecutive-day streak ending on `lastClearedDate`. */
  current: number;
  /** Best streak ever reached. */
  best: number;
}

export const CHALLENGE_STREAK_KEY = 'odb:challenge-streak';
export const EMPTY_STREAK: StreakState = { lastClearedDate: null, current: 0, best: 0 };

/**
 * The calendar day before an ISO date, in UTC — correct across month and year
 * boundaries (and leap years). Only the `YYYY-MM-DD` prefix is used.
 */
export function previousDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * Fold today's clear into the streak. Idempotent per day (clearing twice on the same
 * day doesn't double-count); a consecutive day increments; any gap resets to 1. Best
 * is monotonic. Pure.
 */
export function recordClear(prev: StreakState, todayISO: string): StreakState {
  const today = todayISO.slice(0, 10);
  if (prev.lastClearedDate === today) return prev; // already counted today
  const current = prev.lastClearedDate === previousDay(today) ? prev.current + 1 : 1;
  return { lastClearedDate: today, current, best: Math.max(prev.best, current) };
}

// --- browser-only helpers (guarded so the module imports cleanly in Node) ---

/** Read the persisted streak, tolerating missing/malformed storage. */
export function getStreak(): StreakState {
  if (typeof window === 'undefined') return EMPTY_STREAK;
  try {
    const raw = window.localStorage.getItem(CHALLENGE_STREAK_KEY);
    if (!raw) return EMPTY_STREAK;
    const parsed = JSON.parse(raw) as Partial<StreakState>;
    return {
      lastClearedDate: typeof parsed.lastClearedDate === 'string' ? parsed.lastClearedDate : null,
      current: typeof parsed.current === 'number' ? parsed.current : 0,
      best: typeof parsed.best === 'number' ? parsed.best : 0,
    };
  } catch {
    return EMPTY_STREAK;
  }
}

/** Persist a streak state (no-op off the browser). */
export function saveStreak(state: StreakState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHALLENGE_STREAK_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota/private-mode errors */
  }
}

/** Record a clear for `todayISO`, persist it, and return the new state. */
export function registerClear(todayISO: string): StreakState {
  const next = recordClear(getStreak(), todayISO);
  saveStreak(next);
  return next;
}
