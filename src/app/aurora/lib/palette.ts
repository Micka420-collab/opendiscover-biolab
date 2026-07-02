/**
 * The single AURORA colour language.
 *
 * A run's proximity to the answer (a 0..1 "signal") is mapped to one shared 5-stop
 * ramp used by the scope fill, the verdict gauge, the tuning dial, the mote trails,
 * the Earth's aurora bands and card glows — so the whole game speaks one colour.
 *
 * cold abyss → teal → accent green (the bar) → lime bloom → white-hot (cleared).
 * A separate coral flag marks a target *overshoot* only; it never competes with green.
 *
 * Pure and deterministic; no DOM, safe in Node and the browser.
 */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** The ramp, low→high signal. Hand-tuned to read on a stream at low bitrate. */
const RAMP: { at: number; hsl: Hsl }[] = [
  { at: 0.0, hsl: { h: 222, s: 55, l: 16 } }, // abyss indigo
  { at: 0.45, hsl: { h: 190, s: 75, l: 45 } }, // teal
  { at: 0.75, hsl: { h: 142, s: 71, l: 45 } }, // accent green — THE BAR
  { at: 0.92, hsl: { h: 96, s: 80, l: 55 } }, // lime bloom
  { at: 1.0, hsl: { h: 140, s: 55, l: 92 } }, // white-hot cleared
];

/** Coral, used only to flag a target overshoot. */
export const OVERSHOOT: Hsl = { h: 15, s: 85, l: 60 };

export function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolate the ramp at a 0..1 signal, returning an {h,s,l}. */
export function scoreToHsl(signal: number): Hsl {
  const x = clamp01(signal);
  for (let i = 1; i < RAMP.length; i++) {
    const lo = RAMP[i - 1];
    const hi = RAMP[i];
    if (x <= hi.at) {
      const span = hi.at - lo.at || 1;
      const t = (x - lo.at) / span;
      // Hue interpolation stays on the short arc here (all hues within one turn).
      return {
        h: lerp(lo.hsl.h, hi.hsl.h, t),
        s: lerp(lo.hsl.s, hi.hsl.s, t),
        l: lerp(lo.hsl.l, hi.hsl.l, t),
      };
    }
  }
  return RAMP[RAMP.length - 1].hsl;
}

/** `hsl(...)` / `hsl(... / a)` CSS string for a 0..1 signal. */
export function scoreToColor(signal: number, alpha = 1): string {
  const { h, s, l } = scoreToHsl(signal);
  const hh = h.toFixed(1);
  const ss = s.toFixed(1);
  const ll = l.toFixed(1);
  return alpha >= 1 ? `hsl(${hh} ${ss}% ${ll}%)` : `hsl(${hh} ${ss}% ${ll}% / ${clamp01(alpha)})`;
}

export function hslString({ h, s, l }: Hsl, alpha = 1): string {
  const base = `${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%`;
  return alpha >= 1 ? `hsl(${base})` : `hsl(${base} / ${clamp01(alpha)})`;
}

/**
 * A text-safe version of the ramp: keeps the hue but floors lightness so a low
 * signal never renders dark-indigo-on-dark (unreadable on the abyss background /
 * on a stream). Use for coloured numbers and labels; the gauge arc keeps the full
 * ramp because it is a thick, glowing stroke.
 */
export function readableScoreColor(signal: number, minL = 62): string {
  const { h, s, l } = scoreToHsl(signal);
  return `hsl(${h.toFixed(1)} ${Math.max(s, 55).toFixed(1)}% ${Math.max(l, minL).toFixed(1)}%)`;
}
