/**
 * Shared vocabulary for every simulation engine.
 *
 * An engine is a pure function `run(params) -> SimResult`. It never touches the
 * network, the clock, or unseeded randomness. This uniformity is what lets the
 * lab treat any engine interchangeably: the AI scientist agents, the canary
 * replicator, the content-hasher, and the UI all speak `SimResult`.
 */

import type { z } from 'zod';

/** A single named scalar output. */
export interface Metric {
  key: string;
  label: string;
  value: number;
  unit?: string;
  /** Optional human note explaining what the number means. */
  note?: string;
}

/** A time (or generation / iteration) series, column-oriented for charting. */
export interface Series {
  /** Independent variable samples (time, generation, concentration, ...). */
  x: number[];
  /** One or more dependent variables keyed by name. */
  y: Record<string, number[]>;
  xLabel?: string;
  yLabel?: string;
}

/** Category of biological problem an engine addresses — drives UI grouping. */
export type SimDomain =
  | 'molecular-biology'
  | 'protein'
  | 'systems-biology'
  | 'population-genetics'
  | 'bioprocess'
  | 'epidemiology'
  | 'drug-discovery'
  | 'structural'
  | 'neuroscience'
  | 'ecology';

/** The canonical result shape returned by every engine. */
export interface SimResult<TDetail = unknown> {
  /** Slug of the engine that produced this. */
  engine: string;
  /** Short headline finding, safe to show in a feed. */
  summary: string;
  /** Scalar outputs. */
  metrics: Metric[];
  /** Zero or more series for plotting. */
  series?: Series[];
  /** Arbitrary structured detail (sequences, trees, matrices, ...). */
  detail?: TDetail;
  /** Everything needed to reproduce the run byte-for-byte. */
  provenance: {
    engine: string;
    version: string;
    params: Record<string, unknown>;
    seed?: number | string;
  };
  /** Optional Vega-Lite spec the engine recommends for its own data. */
  vizSpec?: Record<string, unknown>;
}

/**
 * Metadata describing an engine, used by the registry, the UI catalog, and the
 * AI agent tool layer. `paramsSchema` is a Zod schema so params can be validated
 * before a run and surfaced as form controls / tool JSON schema.
 */
export interface EngineSpec<TParams = Record<string, unknown>, TDetail = unknown> {
  slug: string;
  title: string;
  domain: SimDomain;
  version: string;
  /** One-paragraph description of the model and its assumptions. */
  description: string;
  /** Key references (textbook / paper) grounding the model. */
  references?: string[];
  /**
   * Zod schema validating & documenting the parameters. Typed loosely so engines
   * whose schema uses `.default()` — where the parse *input* type legitimately
   * differs from the resolved *output* type — still satisfy the contract. Runtime
   * validation in `kernel.validateParams` is what actually enforces the shape.
   */
  paramsSchema: z.ZodTypeAny;
  /** Pure, deterministic entry point. */
  run(params: TParams): SimResult<TDetail>;
  /** A ready-to-run example parameter set for demos and tests. */
  example: TParams;
  /** Free-text tags for search. */
  tags?: string[];
}

/** Helper to assemble a well-formed provenance block. */
export function provenance(
  engine: string,
  version: string,
  params: Record<string, unknown>,
  seed?: number | string,
): SimResult['provenance'] {
  return { engine, version, params, seed };
}
