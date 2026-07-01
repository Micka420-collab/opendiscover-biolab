/**
 * Reproducibility harness — the guard that keeps the determinism promise honest.
 *
 * Two complementary checks:
 *
 *  1. **Intra-run determinism** (strict): re-running an engine's example on the
 *     same machine must reproduce the exact same canonical output hash. This is
 *     the guarantee canary replication relies on, and it is asserted bit-for-bit.
 *
 *  2. **Pinned outputs** (robust snapshot): each engine's example summary and
 *     scalar metrics are snapshotted, with metric values rounded to 6 significant
 *     figures. Rounding absorbs any last-ULP differences a transcendental math
 *     function might show across OS/Node builds, so CI (Linux) never falsely
 *     fails on a snapshot generated elsewhere — while any *meaningful* change to
 *     an engine's science still trips the snapshot. To accept an intended change,
 *     run `pnpm test -- -u` and review the diff.
 *
 * Runs in CI via the `engines` job (`pnpm test:sim`) — no database, no secrets.
 */

import { describe, expect, it } from 'vitest';
import { runExperiment } from '../lab/runner';
import { engines } from './index';

const sig6 = (v: number): number => (Number.isFinite(v) ? Number(v.toPrecision(6)) : v);

describe('engine reproducibility harness', () => {
  it('pins every engine example to a stable summary + metrics snapshot', async () => {
    const snapshot: Record<string, { summary: string; metrics: Record<string, number> }> = {};
    for (const e of engines) {
      const rec = await runExperiment(e.slug, e.example as Record<string, unknown>);
      snapshot[e.slug] = {
        summary: rec.summary,
        metrics: Object.fromEntries(rec.metrics.map((m) => [m.key, sig6(m.value)])),
      };
    }
    const sorted = Object.fromEntries(
      Object.entries(snapshot).sort(([a], [b]) => a.localeCompare(b)),
    );
    expect(sorted).toMatchSnapshot();
  });

  it('reproduces the exact same content hash on a re-run (intra-run determinism)', async () => {
    for (const e of engines) {
      const a = await runExperiment(e.slug, e.example as Record<string, unknown>);
      const b = await runExperiment(e.slug, e.example as Record<string, unknown>);
      expect(a.outputHash, e.slug).toBe(b.outputHash);
    }
  });

  it('every output hash is a 64-char SHA-256 hex string', async () => {
    for (const e of engines) {
      const rec = await runExperiment(e.slug, e.example as Record<string, unknown>);
      expect(rec.outputHash, e.slug).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
