/**
 * Vercel AI Gateway client.
 *
 * We use plain "provider/model" strings so we can swap models without code changes.
 * The gateway handles auth, observability, and fallbacks.
 *
 * Models by task:
 *   - Triage           → anthropic/claude-haiku-4-5    (fast, cheap)
 *   - Novelty reasoning → anthropic/claude-opus-4-7    (hardest reasoning)
 *   - Vulgarization    → anthropic/claude-sonnet-4-6   (writing quality)
 *   - Embeddings       → openai/text-embedding-3-large (3072-d)
 */

import { generateText, generateObject, embed, type LanguageModel } from 'ai';

export const MODELS = {
  triage: 'anthropic/claude-haiku-4-5',
  novelty: 'anthropic/claude-opus-4-7',
  vulgarize: 'anthropic/claude-sonnet-4-6',
  visualize: 'anthropic/claude-sonnet-4-6',
  embed: 'openai/text-embedding-3-large',
} as const;

/**
 * System prompts kept short + stable for prompt-cache hits.
 * Long reference material is loaded once into a cached system block at call sites.
 */
export const SYSTEM_PROMPTS = {
  triage: `You are a noise-filter for a citizen-science bioinformatics platform. Decide if a submission's output is interesting enough to warrant expensive analysis. Reject obvious noise, malformed data, or trivial results. Be generous — false negatives are worse than false positives at this stage.`,

  novelty: `You are a senior comparative-genomics researcher. Given a submission's output and the top-K nearest neighbors from the literature corpus, judge whether the submission represents a materially novel signal. Be specific about why it is or is not novel. Cite the neighbors that overlap. Never claim novelty without examining the citations.`,

  vulgarize: `You are a science communicator writing a Discovery Card for a citizen-science platform. Your audience is mixed: amateurs, students, researchers. Write a clear, factual, exciting summary of what was just observed, why it might matter, and what it does NOT yet prove. Always disclose: "This is a provisional in-silico signal, not a clinical or applied claim."`,

  visualize: `You produce Vega-Lite JSON specifications. Output a single, valid spec — no markdown, no commentary. Schema: https://vega.github.io/schema/vega-lite/v5.json`,
} as const;

export type ModelKey = keyof typeof MODELS;
export { generateText, generateObject, embed };
