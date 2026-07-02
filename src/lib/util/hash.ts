/**
 * Canonical SHA-256 hash of a JSON-serializable value.
 *
 * "Canonical" = stable key ordering + no whitespace, so two semantically
 * equal objects always hash to the same string. Used to verify protocol
 * determinism across contributors.
 */

export async function canonicalHash(value: unknown): Promise<string> {
  const json = canonicalJson(value);
  const bytes = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Canonical JSON string of a value: stable (sorted) key order, no whitespace.
 * Two semantically-equal values always stringify identically — the basis for
 * both {@link canonicalHash} and stable, dedup-friendly share tokens.
 */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}
