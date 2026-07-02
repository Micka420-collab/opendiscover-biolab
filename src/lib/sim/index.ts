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
import { spec as docking } from './drug/docking';
import { spec as doseResponse } from './drug/dose-response';
import { spec as pkTwoCompartment } from './drug/pk-two-compartment';
import { spec as enzymeKinetics } from './dynamics/enzyme-kinetics';
import { spec as chemostatCompetition } from './ecology/chemostat-competition';
import { spec as levinsMetapopulation } from './ecology/levins-metapopulation';
import { spec as logisticMap } from './ecology/logistic-map';
import { spec as lotkaVolterra } from './ecology/lotka-volterra';
import { spec as nicholsonBailey } from './ecology/nicholson-bailey';
import { spec as replicatorDynamics } from './ecology/replicator-dynamics';
import { spec as rockPaperScissors } from './ecology/rock-paper-scissors';
import { spec as rosenzweigMacArthur } from './ecology/rosenzweig-macarthur';
import { spec as compartmental } from './epi/compartmental';
import { spec as reedFrost } from './epi/reed-frost';
import { spec as sirEndemic } from './epi/sir-endemic';
import { spec as sis } from './epi/sis';
import { spec as breeding } from './genetics/breeding';
import { spec as alignment } from './molbio/alignment';
import { cloningSpec as cloning } from './molbio/cloning';
import { spec as crispr } from './molbio/crispr';
import { spec as pcr } from './molbio/pcr';
import { spec as sequence } from './molbio/sequence';
import { spec as fitzHughNagumo } from './neuro/fitzhugh-nagumo';
import { spec as hodgkinHuxley } from './neuro/hodgkin-huxley';
import { spec as izhikevich } from './neuro/izhikevich';
import { spec as wilsonCowan } from './neuro/wilson-cowan';
import { spec as coalescent } from './popgen/coalescent';
import { spec as ewensSampling } from './popgen/ewens-sampling';
import { spec as hardyWeinberg } from './popgen/hardy-weinberg';
import { spec as luriaDelbruck } from './popgen/luria-delbruck';
import { spec as moranProcess } from './popgen/moran-process';
import { spec as phylogenetics } from './popgen/phylogenetics';
import { spec as wrightFisher } from './popgen/wright-fisher';
import { spec as hpFolding } from './protein/hp-folding';
import { spec as massSpec } from './protein/mass-spec';
import { spec as proteinProperties } from './protein/properties';
import { spec as secondaryStructure } from './protein/secondary-structure';
import { spec as twoStateFolding } from './protein/two-state-folding';
import { spec as rnaFold } from './structural/rna-fold';
import { spec as wormLikeChain } from './structural/worm-like-chain';
import { spec as branchingGrowth } from './systems/branching-growth';
import { spec as fba } from './systems/fba';
import { spec as gillespie } from './systems/gillespie';
import { spec as grn } from './systems/grn';
import { spec as kuramoto } from './systems/kuramoto';
import { spec as metabolicPathway } from './systems/metabolic-pathway';

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
  massSpec,
  twoStateFolding,
  hodgkinHuxley,
  fitzHughNagumo,
  wilsonCowan,
  izhikevich,
  enzymeKinetics,
  grn,
  gillespie,
  kuramoto,
  branchingGrowth,
  fba,
  metabolicPathway,
  wrightFisher,
  phylogenetics,
  hardyWeinberg,
  moranProcess,
  luriaDelbruck,
  ewensSampling,
  coalescent,
  breeding,
  lotkaVolterra,
  logisticMap,
  rosenzweigMacArthur,
  rockPaperScissors,
  nicholsonBailey,
  chemostatCompetition,
  levinsMetapopulation,
  replicatorDynamics,
  bioreactor,
  compartmental,
  sis,
  sirEndemic,
  reedFrost,
  admet,
  docking,
  doseResponse,
  pkTwoCompartment,
  rnaFold,
  wormLikeChain,
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
