// @ts-nocheck
/**
 * Novelty Agent — AI SDK v6 agentic loop with tool use.
 *
 * Replaces the single-shot `scoreNovelty` LLM call with a real reasoning loop:
 *   1. Agent sees the claim + initial corpus neighbors.
 *   2. Decides whether to search internal corpus more deeply, or escalate to
 *      live UniProt / Europe PMC searches, or trust what it already has.
 *   3. Produces a structured novelty judgment.
 *
 * This is materially better than single-shot scoring because the agent can:
 *  - rephrase queries when initial searches return weak matches
 *  - cross-check across multiple data sources
 *  - cite specific homologs / papers it actually retrieved during the run
 *
 * Cost containment:
 *  - max 6 reasoning steps (stopWhen)
 *  - prompt caching on the static system message
 *  - the agent is *advised* to prefer cheap internal-corpus calls first
 */

import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import { z } from 'zod';
import { MODELS, SYSTEM_PROMPTS } from '../gateway';
import { searchInternalCorpus } from '../tools/internal-corpus';
import { searchEuropePMC } from '../tools/europe-pmc';
import { searchUniProt } from '../tools/uniprot-search';
import type { CorpusNeighbor, NoveltyJudgment } from '../novelty';

const judgmentSchema = z.object({
  novel: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(2000),
  overlapping_citations: z.array(
    z.object({
      external_id: z.string(),
      source: z.string().optional(),
      overlap_summary: z.string().max(280),
    }),
  ),
  suggested_followup_experiments: z.array(z.string().max(280)).max(5),
  searches_performed: z.array(z.string()).max(20),
});

const noveltyAgent = new Agent({
  model: MODELS.novelty,
  system: `${SYSTEM_PROMPTS.novelty}

You have three search tools:
  - search_internal_corpus  (cheap, fast, pre-embedded UniProt/SmProt/sORFs/PMC subset)
  - search_uniprot          (authoritative protein knowledge base, live)
  - search_europe_pmc       (40M+ open biomedical papers, live)

Strategy: start with internal corpus. If the top hits look weak, broaden with one or two live searches. Do not exceed 6 tool calls. When you have enough evidence, return the structured judgment.

Be ruthless about citing specific overlap. If you can name a UniProt accession, SmProt ID, or PMID/DOI that materially covers the claim — novel=false. If you searched and found nothing relevant after broadening — novel=true, confidence proportional to how thoroughly you searched.`,
  tools: {
    search_internal_corpus: searchInternalCorpus,
    search_uniprot: searchUniProt,
    search_europe_pmc: searchEuropePMC,
  },
  stopWhen: stepCountIs(6),
});

const DEFAULT_WEIGHTS = { similarity: 0.4, corroboration: 0.3, llm: 0.3 };

export interface NoveltyAgentInput {
  claimSummary: string;
  neighbors: CorpusNeighbor[];
  corroborationCount: number;
  rawOutput: Record<string, unknown>;
  weights?: { similarity: number; corroboration: number; llm: number };
}

export async function runNoveltyAgent(input: NoveltyAgentInput): Promise<{
  score: number;
  judgment: NoveltyJudgment;
}> {
  const weights = input.weights ?? DEFAULT_WEIGHTS;
  const maxSim = input.neighbors[0]?.similarity ?? 0;

  const neighborsBlock = input.neighbors
    .slice(0, 5)
    .map(
      (n, i) =>
        `[${i + 1}] ${n.source}:${n.externalId} (sim ${n.similarity.toFixed(3)}) — ${n.title}\n    ${n.summary.slice(0, 300)}`,
    )
    .join('\n\n');

  const prompt = `# Candidate claim
${input.claimSummary}

# Initial corpus neighbors (already retrieved)
${neighborsBlock || '(no neighbors above similarity threshold — corpus is sparse here)'}

# Independent corroborating submissions on disjoint slices
${input.corroborationCount}

Judge whether this claim is materially novel. Use your tools to widen the search if needed.`;

  const result = await noveltyAgent.generate({
    prompt,
    experimental_output: { schema: judgmentSchema },
  });

  const judgment = result.experimental_output as NoveltyJudgment & {
    searches_performed: string[];
  };

  const distance = Math.max(0, Math.min(1, 1 - maxSim));
  const corroboration = Math.min(1, input.corroborationCount / 4);
  const llm = judgment.novel ? judgment.confidence : 1 - judgment.confidence;

  const score =
    weights.similarity * distance +
    weights.corroboration * corroboration +
    weights.llm * llm;

  return { score, judgment };
}
