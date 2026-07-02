/**
 * Client-only persistence of the player's lit AURORA bands.
 *
 * A band is a confirmed pool challenge; we store its id → winning `?x=` permalink so
 * the Earth stays lit across sessions and the player can re-share any past discovery.
 * Guarded exactly like `challenge-streak.ts`: tolerates malformed storage and no-ops
 * outside the browser, so it is safe to import from server components too.
 */

export const AURORA_LS_KEY = 'odb:aurora-lit';

export interface AuroraProgress {
  /** challenge id → the winning experiment permalink that lit it. */
  lit: Record<string, string>;
}

const EMPTY: AuroraProgress = { lit: {} };

/** Read the stored progress, always returning a well-formed object. */
export function getProgress(): AuroraProgress {
  if (typeof window === 'undefined') return { lit: {} };
  try {
    const raw = window.localStorage.getItem(AURORA_LS_KEY);
    if (!raw) return { lit: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const litRaw = (parsed as Record<string, unknown>).lit;
      const clean: Record<string, string> = {};
      if (litRaw && typeof litRaw === 'object' && !Array.isArray(litRaw)) {
        for (const [k, v] of Object.entries(litRaw as Record<string, unknown>)) {
          if (typeof v === 'string') clean[k] = v;
        }
      }
      return { lit: clean };
    }
  } catch {
    /* malformed storage — fall through to empty */
  }
  return { lit: {} };
}

/** The set of lit challenge ids. */
export function litIds(): Set<string> {
  return new Set(Object.keys(getProgress().lit));
}

/**
 * Mark a band lit with its winning permalink (re-reads first so a concurrent tab's
 * writes aren't clobbered). Returns the merged progress.
 */
export function registerLit(id: string, permalink: string): AuroraProgress {
  const current = getProgress();
  const next: AuroraProgress = { lit: { ...current.lit, [id]: permalink } };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(AURORA_LS_KEY, JSON.stringify(next));
    } catch {
      /* storage full / unavailable — keep the in-memory value */
    }
  }
  return next;
}

export { EMPTY as EMPTY_PROGRESS };
