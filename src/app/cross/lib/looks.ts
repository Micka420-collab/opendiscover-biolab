/**
 * One stable colour per phenotype, so a chosen look is the SAME colour on the
 * choice button, the outcome bars, the Punnett square and the baby litter — the
 * visual through-line that makes a reveal read at a glance on a stream.
 *
 * Colours come from the app's shared category palette (the one the charts use),
 * assigned by the phenotype's alphabetical rank so the mapping is deterministic
 * regardless of the order labels arrive in. Pure module.
 */

/** The app-wide category palette (kept in step with the Vega-Lite chart theme). */
export const CROSS_PALETTE = [
  '#22c55e', // green
  '#38bdf8', // sky
  '#f59e0b', // amber
  '#a855f7', // violet
  '#ef4444', // red
  '#14b8a6', // teal
  '#ec4899', // pink
  '#eab308', // yellow
] as const;

/**
 * Assign each distinct label a palette colour by alphabetical rank. Returns a
 * lookup that is total (unknown labels fall back to the first colour), so a
 * caller never has to guard for a missing key.
 */
export function paletteFor(labels: readonly string[]): (label: string) => string {
  const distinct = [...new Set(labels)].sort((a, b) => a.localeCompare(b));
  const map = new Map<string, string>();
  distinct.forEach((label, i) => {
    map.set(label, CROSS_PALETTE[i % CROSS_PALETTE.length] as string);
  });
  return (label: string) => map.get(label) ?? (CROSS_PALETTE[0] as string);
}
