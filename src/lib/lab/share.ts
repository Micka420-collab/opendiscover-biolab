/**
 * Shareable / remixable experiment permalinks.
 *
 * Because every lab engine is a pure, deterministic function
 * (`(engine, params) -> outputHash`), an experiment is fully described by its
 * engine slug + parameters. This module encodes that state into one compact,
 * URL-safe token so a run can be shared as a link — a streamer drops the link
 * in chat, a viewer opens it and reproduces the *exact* run byte-for-byte, then
 * tweaks a parameter and re-shares their remix. No account, no database, no
 * server round-trip to resolve the link.
 *
 * The token is deterministic and canonical: the same experiment always yields
 * the same token regardless of parameter key order, so identical runs share an
 * identical, dedup-friendly link.
 *
 * Pure and isomorphic — runs identically in the browser and in Node.
 */

import { canonicalJson } from '@/lib/util/hash';

export interface ExperimentState {
  engine: string;
  params: Record<string, unknown>;
}

/** Query-string key that carries an encoded experiment on `/lab/[engine]`. */
export const SHARE_PARAM = 'x';

/** Refuse to decode absurdly long tokens (defensive cap, ~8 KB of base64url). */
const MAX_TOKEN_LENGTH = 8192;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 =
    typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(token: string): Uint8Array {
  const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
  const binary =
    typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Encode an experiment into a compact, URL-safe token. Deterministic: params
 * are canonicalised (sorted keys) so the same experiment always encodes the
 * same string. Output contains only `[A-Za-z0-9_-]` — safe in a URL as-is.
 */
export function encodeExperiment(state: ExperimentState): string {
  const payload = { e: state.engine, p: state.params ?? {} };
  const json = canonicalJson(payload);
  return bytesToBase64Url(new TextEncoder().encode(json));
}

/**
 * Decode a token back into an experiment. Returns `null` — never throws — for
 * anything malformed, oversized, or wrongly shaped, so a bad link degrades to
 * the engine's default form instead of crashing the page.
 */
export function decodeExperiment(token: string | null | undefined): ExperimentState | null {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(token));
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const { e: engine, p: params } = parsed as Record<string, unknown>;
    if (typeof engine !== 'string' || engine.length === 0) return null;
    if (params === null || typeof params !== 'object' || Array.isArray(params)) return null;
    return { engine, params: params as Record<string, unknown> };
  } catch {
    return null;
  }
}

/**
 * Build the relative permalink for an experiment:
 * `/lab/<engine>?x=<token>`. The token is already URL-safe.
 */
export function experimentSharePath(state: ExperimentState): string {
  return `/lab/${encodeURIComponent(state.engine)}?${SHARE_PARAM}=${encodeExperiment(state)}`;
}

/**
 * Build the OBS browser-source overlay permalink for an experiment:
 * `/lab/<engine>/overlay?x=<token>` — a chrome-less, transparent, auto-running
 * result card for a stream.
 */
export function experimentOverlayPath(state: ExperimentState): string {
  return `/lab/${encodeURIComponent(state.engine)}/overlay?${SHARE_PARAM}=${encodeExperiment(state)}`;
}
