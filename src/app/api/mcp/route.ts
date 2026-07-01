/**
 * Local fallback for the MCP endpoint.
 * The real streamable HTTP MCP transport requires a Node HTTP response object
 * that Next route handlers do not expose in the same way.
 */

import { type NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;
export const runtime = 'nodejs';

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'MCP endpoint unavailable in local environment' },
    { status: 501 },
  );
}

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { error: 'MCP endpoint unavailable in local environment' },
    { status: 501 },
  );
}
