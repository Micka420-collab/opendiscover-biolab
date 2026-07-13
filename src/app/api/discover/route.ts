/**
 * Discovery-mode API: run a probe (limited feedback) or a claim (full verdict +
 * proof hash + novelty). Server-side so the 80-engine registry isn't shipped to
 * the browser. Deterministic and DB-free — no secrets required.
 */
import { claim, getQuest, probe } from '@/lib/lab/discovery';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Body {
  quest?: string;
  action?: 'probe' | 'claim';
  axisValues?: Record<string, number>;
  probesUsed?: number;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const quest = body.quest ? getQuest(body.quest) : undefined;
  if (!quest) {
    return NextResponse.json({ error: `Unknown quest "${body.quest}"` }, { status: 404 });
  }

  const axisValues = body.axisValues ?? {};
  // Guard: every tuned axis must be a finite number inside its declared range.
  for (const axis of quest.axes) {
    const v = axisValues[axis.key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < axis.min || v > axis.max) {
      return NextResponse.json(
        { error: `"${axis.label}" must be a number in [${axis.min}, ${axis.max}]` },
        { status: 400 },
      );
    }
  }

  try {
    if (body.action === 'claim') {
      const verdict = await claim(quest, axisValues, body.probesUsed ?? 0);
      return NextResponse.json({ verdict }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const result = probe(quest, axisValues);
    return NextResponse.json({ probe: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
