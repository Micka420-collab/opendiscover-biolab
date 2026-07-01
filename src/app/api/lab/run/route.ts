/**
 * POST /api/lab/run
 *
 * Run one simulation engine with concrete parameters and get back a hashed,
 * reproducible experiment record. Deterministic and secret-free — the same body
 * always yields the same outputHash.
 *
 * Body: { "engine": "bioreactor", "params": { "mode": "chemostat", "d": 0.2 } }
 */

import { runExperiment } from '@/lib/lab/runner';
import { EngineError } from '@/lib/sim/kernel';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const bodySchema = z.object({
  engine: z.string().min(1),
  params: z.record(z.unknown()).default({}),
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
    const record = await runExperiment(parsed.data.engine, parsed.data.params);
    return NextResponse.json({
      engine: record.engine,
      version: record.engineVersion,
      inputHash: record.inputHash,
      outputHash: record.outputHash,
      summary: record.summary,
      metrics: record.metrics,
      result: record.result,
    });
  } catch (err) {
    if (err instanceof EngineError) {
      const status =
        err.code === 'unknown_engine' ? 404 : err.code === 'invalid_params' ? 422 : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Engine run failed' },
      { status: 500 },
    );
  }
}
