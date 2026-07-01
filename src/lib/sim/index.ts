/**
 * Engine registry — the single catalog of every simulation engine in the lab.
 *
 * The UI, the API routes, the AI scientist tools, and the MCP server all read
 * from here. Adding an engine is one import + one array entry.
 *
 * Param types are intentionally erased to a uniform `EngineSpec` view at this
 * boundary: the registry treats every engine identically, and `execute`
 * re-validates params against each engine's own Zod schema at run time.
 */

// biome-ignore lint/suspicious/noExplicitAny: registry erases per-engine param types by design
type AnyEngine = import('./core/types').EngineSpec<any, any>;

import { spec as bioreactor } from './bioprocess/bioreactor';
import { spec as admet } from './drug/admet';
import { spec as doseResponse } from './drug/dose-response';
import { spec as enzymeKinetics } from './dynamics/enzyme-kinetics';
import { spec as compartmental } from './epi/compartmental';
import { spec as breeding } from './genetics/breeding';
import { spec as alignment } from './molbio/alignment';
import { cloningSpec as cloning } from './molbio/cloning';
import { spec as crispr } from './molbio/crispr';
import { spec as pcr } from './molbio/pcr';
import { spec as sequence } from './molbio/sequence';
import { spec as phylogenetics } from './popgen/phylogenetics';
import { spec as wrightFisher } from './popgen/wright-fisher';
import { spec as hpFolding } from './protein/hp-folding';
import { spec as proteinProperties } from './protein/properties';
import { spec as secondaryStructure } from './protein/secondary-structure';
import { spec as rnaFold } from './structural/rna-fold';
import { spec as fba } from './systems/fba';
import { spec as gillespie } from './systems/gillespie';
import { spec as grn } from './systems/grn';

import type { SimResult } from './core/types';
import { execute } from './kernel';

/** Every engine in the lab, in catalog order. */
export const engines: AnyEngine[] = [
  sequence,
  pcr,
  cloning,
  crispr,
  alignment,
  proteinProperties,
  secondaryStructure,
  hpFolding,
  enzymeKinetics,
  grn,
  gillespie,
  fba,
  wrightFisher,
  phylogenetics,
  breeding,
  bioreactor,
  compartmental,
  admet,
  doseResponse,
  rnaFold,
];

const bySlug = new Map<string, AnyEngine>(engines.map((e) => [e.slug, e]));

/** Look up one engine by slug. */
export function getEngine(slug: string): AnyEngine | undefined {
  return bySlug.get(slug);
}

/** List engines, optionally filtered by domain. */
export function listEngines(domain?: string): AnyEngine[] {
  return domain ? engines.filter((e) => e.domain === domain) : engines;
}

/** The distinct domains present, in first-seen order. */
export function listDomains(): string[] {
  const seen = new Set<string>();
  for (const e of engines) seen.add(e.domain);
  return [...seen];
}

/** Validate params and run an engine by slug. Throws if the slug is unknown. */
export function runEngine(slug: string, params: unknown): SimResult {
  const spec = getEngine(slug);
  if (!spec) throw new Error(`Unknown engine: "${slug}"`);
  return execute(spec, params);
}

export { execute, describeEngine } from './kernel';
export { describeParamFields } from './core/param-fields';
export type { ParamField } from './core/param-fields';
export type { EngineSpec, SimResult, Metric, Series, SimDomain } from './core/types';
