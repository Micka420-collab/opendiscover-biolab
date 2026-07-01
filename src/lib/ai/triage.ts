/**
 * Triage — fast Haiku pass to decide if a submission is worth the full pipeline.
 *
 * Returns 0–1. >= 0.5 → continue. < 0.5 → mark TRIAGED_NOISE and skip.
 */

import { z } from 'zod';
import { generateObject, MODELS, SYSTEM_PROMPTS } from './gateway';

const triageSchema = z.object({
  interesting: z.boolean(),
  score: z.number().min(0).max(1),
  reason: z.string().max(280),
});

export type TriageResult = z.infer<typeof triageSchema>;

export async function triageSubmission(args: {
  protocolTitle: string;
  protocolDescription: string;
  rawOutput: Record<string, unknown>;
}): Promise<TriageResult> {
  const { object } = await generateObject({
    model: MODELS.triage,
    schema: triageSchema,
    system: SYSTEM_PROMPTS.triage,
    prompt: `Protocol: ${args.protocolTitle}
Goal: ${args.protocolDescription}

Submission output:
${JSON.stringify(args.rawOutput, null, 2)}

Is this worth analyzing further?`,
    temperature: 0,
  });
  return object;
}
