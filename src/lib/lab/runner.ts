/**
 * Experiment runner — the single entry point for running a named engine with
 * params and getting back a reproducible, content-hashed experiment record.
 *
 * The two hashes are the reproducibility contract:
 *   inputHash  = canonical hash of {engine, version, params}
 *   outputHash = canonical hash of the SimResult
 * Re-running the same engine+params anywhere must reproduce outputHash. That is
 * what lets the platform canary-replicate an AI-run experiment and trust it.
 */

import { getEngine } from '../sim';
import type { SimResult } from '../sim/core/types';
import { EngineError, execute } from '../sim/kernel';
import { canonicalHash } from '../util/hash';

export interface ExperimentRecord {
  engine: string;
  engineVersion: string;
  params: Record<string, unknown>;
  inputHash: string;
  outputHash: string;
  summary: string;
  metrics: SimResult['metrics'];
  result: SimResult;
}

/** Run an engine by slug with raw params; returns a fully-hashed record. */
export async function runExperiment(
  slug: string,
  params: Record<string, unknown>,
): Promise<ExperimentRecord> {
  const spec = getEngine(slug);
  if (!spec) {
    throw new EngineError(`No such engine: "${slug}"`, 'unknown_engine');
  }
  const result = execute(spec, params);
  const [inputHash, outputHash] = await Promise.all([
    canonicalHash({ engine: slug, version: spec.version, params: result.provenance.params }),
    canonicalHash(result),
  ]);
  return {
    engine: slug,
    engineVersion: spec.version,
    params: result.provenance.params as Record<string, unknown>,
    inputHash,
    outputHash,
    summary: result.summary,
    metrics: result.metrics,
    result,
  };
}

/**
 * Replicate an experiment: run it again and confirm the output hash matches.
 * This is the determinism guarantee the whole lab rests on.
 */
export async function replicateExperiment(
  slug: string,
  params: Record<string, unknown>,
  expectedOutputHash: string,
): Promise<{ reproduced: boolean; outputHash: string }> {
  const record = await runExperiment(slug, params);
  return {
    reproduced: record.outputHash === expectedOutputHash,
    outputHash: record.outputHash,
  };
}

/** Pull a single metric value out of a result by key. */
export function metricValue(result: SimResult, key: string): number | undefined {
  return result.metrics.find((m) => m.key === key)?.value;
}
