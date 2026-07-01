/**
 * POST /api/lab/campaigns
 *
 * Launch one bounded autonomous research campaign: an AI scientist forms a
 * hypothesis, runs experiments through the deterministic engines, and returns a
 * report + full lab notebook. This is the only lab endpoint that needs the AI
 * Gateway configured (the experiments it runs are themselves deterministic).
 *
 * Body: { "goal": "...", "engineScope": ["bioreactor"], "runBudget": 20 }
 *
 * Note: runs synchronously and is bounded by `runBudget`/`maxSteps`. The durable,
 * streamed version (Inngest + SSE notebook) is a later roadmap item.
 */

import { runCampaign } from '@/lib/lab/scientist';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 300;

const bodySchema = z.object({
  goal: z.string().min(10).max(2000),
  engineScope: z.array(z.string()).max(20).optional(),
  runBudget: z.number().int().min(1).max(60).optional(),
  maxSteps: z.number().int().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body must be valid JSON.' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const outcome = await runCampaign(parsed.data);
    return NextResponse.json({
      report: outcome.report,
      runsUsed: outcome.runsUsed,
      experimentCount: outcome.experiments.length,
      notebook: outcome.notebook,
      notebookMarkdown: outcome.notebookMarkdown,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Campaign failed';
    // A missing AI Gateway key is the most common failure — surface it clearly.
    const isConfig = /gateway|api key|unauthorized|AI_GATEWAY|credential/i.test(message);
    return NextResponse.json(
      {
        error: message,
        hint: isConfig ? 'The AI Gateway must be configured to run campaigns.' : undefined,
      },
      { status: isConfig ? 503 : 500 },
    );
  }
}
