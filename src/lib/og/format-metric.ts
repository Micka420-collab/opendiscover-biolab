/**
 * Legibility-first number formatting for Open Graph share cards.
 *
 * The headline metric is the single most-seen element of every `?x=` share link,
 * so it must read cleanly at a glance — never `1.235e+4` for 12345.6, never padded
 * zeros like `0.5000`. Rules by magnitude:
 *   - non-finite (NaN/±∞) → '—'
 *   - 0 → '0'
 *   - |v| ≥ 1000            → grouped, ≤2 decimals ('12,345.6', '1,500,000')
 *   - integer, |v| < 1000   → as-is ('5', '-3')
 *   - 1e-3 ≤ |v| < 1000     → 4 significant figures, trailing zeros stripped ('0.0421', '0.5')
 *   - 0 < |v| < 1e-3        → compact exponential, trimmed mantissa ('1e-9', '1.23e-5')
 *
 * Pure and dependency-free (uses Intl.NumberFormat) so it is unit-testable and
 * shared by every OG surface.
 */

const GROUPED = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** Format a single numeric metric value for display. */
export function formatMetricValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';

  const abs = Math.abs(value);
  if (abs >= 1000) return GROUPED.format(value);
  if (Number.isInteger(value)) return String(value);
  if (abs >= 1e-3) {
    // 4 significant figures, then drop trailing zeros — Number()'s toString never
    // uses scientific notation in this magnitude range.
    return String(Number(value.toPrecision(4)));
  }

  // Very small: compact exponential with a trimmed mantissa.
  const parts = value.toExponential(3).split('e');
  const mantissa = parts[0] ?? '';
  const exp = parts[1] ?? '';
  const trimmed = mantissa.includes('.') ? mantissa.replace(/\.?0+$/, '') : mantissa;
  return `${trimmed}e${exp}`;
}

/** Format a metric's value with its optional unit suffix, e.g. `0.42 g/L/h`. */
export function formatMetric(m: { value: number; unit?: string }): string {
  const num = formatMetricValue(m.value);
  return m.unit ? `${num} ${m.unit}` : num;
}
