/**
 * Discovery Card generation — turns a promoted signal into a human-readable card.
 *
 * Two-pass: (1) narrative markdown via Sonnet, (2) Vega-Lite spec via Sonnet.
 *
 * Determinism: temperature 0.2, max output bounded. Cards are versioned and
 * re-runnable so we can regenerate after prompt updates.
 */

import { z } from 'zod';
import { MODELS, SYSTEM_PROMPTS, generateObject, generateText } from './gateway';
import type { NoveltyJudgment } from './novelty';

const cardSchema = z.object({
  title: z.string().max(120),
  one_line_hook: z.string().max(200),
  what_was_observed: z.string().max(800),
  why_it_might_matter: z.string().max(800),
  what_it_does_not_prove: z.string().max(600),
  how_to_replicate: z.string().max(600),
  next_experiments: z.array(z.string().max(280)).min(1).max(5),
});

export type DiscoveryCard = z.infer<typeof cardSchema>;

export async function generateDiscoveryCard(args: {
  protocolTitle: string;
  protocolDescription: string;
  claimSummary: string;
  rawData: Record<string, unknown>;
  noveltyJudgment: NoveltyJudgment;
  noveltyScore: number;
  contributorHandle: string;
  corroborations: number;
}): Promise<DiscoveryCard> {
  const { object } = await generateObject({
    model: MODELS.vulgarize,
    schema: cardSchema,
    system: SYSTEM_PROMPTS.vulgarize,
    prompt: `A community contributor (@${args.contributorHandle}) just produced a result that crossed our novelty threshold.

Protocol: ${args.protocolTitle}
Protocol goal: ${args.protocolDescription}

Their observation:
${args.claimSummary}

Underlying data:
${JSON.stringify(args.rawData, null, 2)}

Novelty assessment by our pipeline:
- Composite novelty score: ${args.noveltyScore.toFixed(3)} (threshold 0.75)
- Independent corroborations: ${args.corroborations}
- LLM judgment: novel=${args.noveltyJudgment.novel}, confidence=${args.noveltyJudgment.confidence.toFixed(2)}
- Reasoning: ${args.noveltyJudgment.reasoning}

Write a Discovery Card explaining what was just observed, in language a curious non-specialist can follow. Be honest about what this is and isn't. End with concrete next experiments anyone in the community could run.`,
    temperature: 0.2,
  });
  return object;
}

/**
 * Generate a Vega-Lite spec for the discovery. Sonnet-only, strict JSON output.
 */
export async function generateVisualizationSpec(args: {
  rawData: Record<string, unknown>;
  context: string;
}): Promise<Record<string, unknown>> {
  const { text } = await generateText({
    model: MODELS.visualize,
    system: SYSTEM_PROMPTS.visualize,
    prompt: `Context: ${args.context}

Data (JSON):
${JSON.stringify(args.rawData).slice(0, 8000)}

Produce a single Vega-Lite v5 spec that best communicates the signal. Inline the data if small. No commentary, just the JSON.`,
    temperature: 0,
  });

  const trimmed = text
    .trim()
    .replace(/^```(?:json)?/, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    // Fallback: minimal table-like spec so the card always renders something.
    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      description: 'Fallback visualization (model produced invalid spec).',
      data: { values: [{ note: 'spec generation failed; raw data attached' }] },
      mark: 'text',
      encoding: { text: { field: 'note', type: 'nominal' } },
    };
  }
}
