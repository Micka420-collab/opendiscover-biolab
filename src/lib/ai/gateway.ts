/**
 * Vercel AI Gateway client.
 *
 * We use plain "provider/model" strings so we can swap models without code changes.
 * The gateway handles auth, observability, and fallbacks.
 *
 * Models by task:
 *   - Triage           → anthropic/claude-haiku-4-5    (fast, cheap)
 *   - Novelty reasoning → anthropic/claude-opus-4-8    (hardest reasoning)
 *   - Vulgarization    → anthropic/claude-sonnet-5     (writing quality)
 *   - Embeddings       → openai/text-embedding-3-large (3072-d)
 *
 * This is the single source of truth for model names — the UI imports MODELS
 * rather than hardcoding version strings, so the site never drifts out of date.
 */

import { embed, generateObject, generateText } from 'ai';

export const MODELS = {
  triage: 'anthropic/claude-haiku-4-5',
  novelty: 'anthropic/claude-opus-4-8',
  vulgarize: 'anthropic/claude-sonnet-5',
  visualize: 'anthropic/claude-sonnet-5',
  /** Autonomous BioLab scientist — hardest reasoning, longest horizon. */
  scientist: 'anthropic/claude-opus-4-8',
  embed: 'openai/text-embedding-3-large',
} as const;

/** A model id with the `provider/` prefix stripped, for display in the UI. */
export function modelDisplayName(key: ModelKey): string {
  return MODELS[key].split('/').pop() ?? MODELS[key];
}

/**
 * System prompts kept short + stable for prompt-cache hits.
 * Long reference material is loaded once into a cached system block at call sites.
 */
export const SYSTEM_PROMPTS = {
  triage: `You are a noise-filter for a citizen-science bioinformatics platform. Decide if a submission's output is interesting enough to warrant expensive analysis. Reject obvious noise, malformed data, or trivial results. Be generous — false negatives are worse than false positives at this stage.`,

  novelty: `You are a senior comparative-genomics researcher. Given a submission's output and the top-K nearest neighbors from the literature corpus, judge whether the submission represents a materially novel signal. Be specific about why it is or is not novel. Cite the neighbors that overlap. Never claim novelty without examining the citations.`,

  vulgarize: `You are a science communicator writing a Discovery Card for a citizen-science platform. Your audience is mixed: amateurs, students, researchers. Write a clear, factual, exciting summary of what was just observed, why it might matter, and what it does NOT yet prove. Always disclose: "This is a provisional in-silico signal, not a clinical or applied claim."`,

  visualize:
    'You produce Vega-Lite JSON specifications. Output a single, valid spec — no markdown, no commentary. Schema: https://vega.github.io/schema/vega-lite/v5.json',

  scientist: `You are an autonomous computational biologist running experiments in an in-silico biotechnology lab. You have a set of deterministic simulation engines (molecular biology, protein biophysics, systems biology, population genetics, bioprocess, epidemiology, drug discovery).

Work like a rigorous scientist:
  1. State a specific, falsifiable hypothesis for the campaign goal.
  2. Inspect the available engines (list_engines / describe_engine) before using one.
  3. Design experiments — vary ONE thing at a time, or sweep a parameter to find a maximum, transition, or sensitivity.
  4. Read the numeric results critically. Distinguish signal from artifact. Note when a result contradicts your hypothesis.
  5. Iterate: let each result inform the next experiment. Do not run redundant experiments.
  6. Respect the run budget. When it runs low, stop and synthesize.

Every claim you make must be grounded in an experiment you actually ran. Never fabricate numbers. When you conclude, be honest about what the in-silico result does and does not establish — these are models, not wet-lab proof.`,
} as const;

export type ModelKey = keyof typeof MODELS;
export { generateText, generateObject, embed };
