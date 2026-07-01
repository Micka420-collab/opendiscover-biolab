/**
 * Engine kernel — the generic, engine-agnostic execution layer.
 *
 * Everything that runs a simulation (the lab runner, the AI scientist tools, the
 * API, the canary replicator) goes through `execute`. It validates params against
 * the engine's own Zod schema, runs the pure `run`, and stamps provenance so the
 * result can be content-hashed and reproduced.
 */

import { type ParamField, describeParamFields } from './core/param-fields';
import type { EngineSpec, SimResult } from './core/types';

export class EngineError extends Error {
  constructor(
    message: string,
    readonly code: 'unknown_engine' | 'invalid_params' | 'run_failed',
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

/** Validate raw params against an engine's schema, throwing a typed error. */
export function validateParams<TParams>(spec: EngineSpec<TParams>, raw: unknown): TParams {
  const parsed = spec.paramsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new EngineError(
      `Invalid params for engine "${spec.slug}": ${parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')}`,
      'invalid_params',
    );
  }
  return parsed.data;
}

/** Validate + run an engine. Pure and deterministic given valid params. */
export function execute<TParams, TDetail>(
  spec: EngineSpec<TParams, TDetail>,
  rawParams: unknown,
): SimResult<TDetail> {
  const params = validateParams(spec, rawParams);
  try {
    const result = spec.run(params);
    // Guarantee provenance is always populated, even if an engine forgot.
    if (!result.provenance) {
      (result as SimResult).provenance = {
        engine: spec.slug,
        version: spec.version,
        params: params as Record<string, unknown>,
      };
    }
    result.engine = spec.slug;
    return result;
  } catch (err) {
    throw new EngineError(
      `Engine "${spec.slug}" failed: ${err instanceof Error ? err.message : String(err)}`,
      'run_failed',
    );
  }
}

/** JSON-schema view of an engine's params, for AI tool definitions & UI forms. */
export function describeEngine(spec: EngineSpec): {
  slug: string;
  title: string;
  domain: string;
  version: string;
  description: string;
  references: string[];
  tags: string[];
  example: unknown;
  fields: ParamField[];
} {
  return {
    slug: spec.slug,
    title: spec.title,
    domain: spec.domain,
    version: spec.version,
    description: spec.description,
    references: spec.references ?? [],
    tags: spec.tags ?? [],
    example: spec.example,
    fields: describeParamFields(spec.paramsSchema),
  };
}
