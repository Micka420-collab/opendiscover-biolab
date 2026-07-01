import { describe, expect, it } from 'vitest';
import { getEngine, listEngines, runEngine } from '../sim';
import { metricValue, replicateExperiment, runExperiment } from './runner';

describe('registry', () => {
  it('exposes the full catalog with unique slugs', () => {
    const engines = listEngines();
    expect(engines.length).toBeGreaterThanOrEqual(19);
    const slugs = new Set(engines.map((e) => e.slug));
    expect(slugs.size).toBe(engines.length); // every slug is unique
  });

  it('every engine runs its own documented example', () => {
    for (const e of listEngines()) {
      const result = runEngine(e.slug, e.example);
      expect(result.engine).toBe(e.slug);
      expect(result.summary.length).toBeGreaterThan(0);
      expect(Array.isArray(result.metrics)).toBe(true);
      expect(result.provenance.version).toBe(e.version);
    }
  });

  it('getEngine returns undefined for an unknown slug', () => {
    expect(getEngine('does-not-exist')).toBeUndefined();
  });
});

describe('experiment runner', () => {
  it('produces a stable 64-char output hash for the same params', async () => {
    const params = getEngine('enzyme-kinetics')?.example as Record<string, unknown>;
    const a = await runExperiment('enzyme-kinetics', params);
    const b = await runExperiment('enzyme-kinetics', params);
    expect(a.outputHash).toBe(b.outputHash);
    expect(a.inputHash).toBe(b.inputHash);
    expect(a.outputHash).toHaveLength(64); // sha-256 hex
  });

  it('different params give different output hashes', async () => {
    const a = await runExperiment('enzyme-kinetics', { vmax: 10, km: 5 });
    const b = await runExperiment('enzyme-kinetics', { vmax: 20, km: 5 });
    expect(a.outputHash).not.toBe(b.outputHash);
  });

  it('every engine example replicates to the same hash', async () => {
    for (const e of listEngines()) {
      const params = e.example as Record<string, unknown>;
      const rec = await runExperiment(e.slug, params);
      const check = await replicateExperiment(e.slug, rec.params, rec.outputHash);
      expect(check.reproduced, `${e.slug} should replicate`).toBe(true);
    }
  });

  it('rejects an unknown engine', async () => {
    await expect(runExperiment('not-a-real-engine', {})).rejects.toThrow();
  });

  it('rejects invalid params with a thrown error', async () => {
    await expect(runExperiment('enzyme-kinetics', { vmax: -1, km: 5 })).rejects.toThrow();
  });

  it('metricValue pulls a named metric out of a result', async () => {
    const rec = await runExperiment('enzyme-kinetics', { vmax: 10, km: 5 });
    expect(metricValue(rec.result, 'vmax')).toBe(10);
  });
});
