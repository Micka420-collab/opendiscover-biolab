/**
 * Novelty scoring — the hardest step in the pipeline.
 *
 * Composite score = w1 * (1 - max_corpus_similarity)
 *                 + w2 * corroboration_score
 *                 + w3 * llm_confidence
 *
 * Default weights: (0.4, 0.3, 0.3). Tunable per Protocol.
 *
 * The LLM step uses Opus 4.7 with structured output. It receives:
 *   - the claim summary
 *   - the top-K nearest neighbors from the reference corpus
 *   - the number of independent corroborating submissions
 * and must produce { novel, reasoning, citations[], confidence }.
 *
 * Critically: the LLM is asked to REJECT novelty if the neighbors substantively
 * cover the claim. We do not anchor toward "looks new" — we anchor toward
 * "prove it's new given the evidence in your hand."
 */

import { z } from 'zod';
import { generateObject, MODELS, SYSTEM_PROMPTS } from './gateway';

const noveltyJudgment = z.object({
  novel: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(1500),
  overlapping_citations: z.array(
    z.object({
      external_id: z.string(),
      overlap_summary: z.string().max(280),
    }),
  ),
  suggested_followup_experiments: z.array(z.string().max(280)).max(5),
});

export type NoveltyJudgment = z.infer<typeof noveltyJudgment>;

export interface CorpusNeighbor {
  externalId: string;
  source: string;
  title: string;
  summary: string;
  similarity: number;
}

export interface NoveltyInput {
  claimSummary: string;
  neighbors: CorpusNeighbor[];           // already top-K by similarity, sorted desc
  corroborationCount: number;            // independent submissions with matching signal
  weights?: { similarity: number; corroboration: number; llm: number };
}

const DEFAULT_WEIGHTS = { similarity: 0.4, corroboration: 0.3, llm: 0.3 };

export async function scoreNovelty(input: NoveltyInput): Promise<{
  score: number;
  judgment: NoveltyJudgment;
}> {
  const weights = input.weights ?? DEFAULT_WEIGHTS;

  const maxSim = input.neighbors[0]?.similarity ?? 0;
  const distance = Math.max(0, Math.min(1, 1 - maxSim));

  // Corroboration: 0 = none, 1 = 4+ independent corroborations (diminishing returns)
  const corroboration = Math.min(1, input.corroborationCount / 4);

  const judgment = await askLLMForNoveltyJudgment(input);
  const llm = judgment.novel ? judgment.confidence : 1 - judgment.confidence;

  const score =
    weights.similarity * distance +
    weights.corroboration * corroboration +
    weights.llm * llm;

  return { score, judgment };
}

async function askLLMForNoveltyJudgment(input: NoveltyInput): Promise<NoveltyJudgment> {
  const neighborsBlock = input.neighbors
    .slice(0, 8)
    .map(
      (n, i) =>
        `[${i + 1}] (${n.source}:${n.externalId}, similarity ${n.similarity.toFixed(3)})
title: ${n.title}
summary: ${n.summary}`,
    )
    .join('\n\n');

  const { object } = await generateObject({
    model: MODELS.novelty,
    schema: noveltyJudgment,
    system: SYSTEM_PROMPTS.novelty,
    prompt: `Claim summary:
${input.claimSummary}

Independent corroborations on disjoint input slices: ${input.corroborationCount}

Top nearest neighbors from the reference corpus:
${neighborsBlock || '(none — corpus returned no neighbors above similarity threshold)'}

Judge: is this materially novel? If a neighbor substantively covers the claim, mark novel=false and explain. If novel=true, cite which neighbors are closest and why they fall short. Be specific. Suggest 1–3 follow-up experiments that would strengthen or refute the claim.`,
    temperature: 0,
  });
  return object;
}
