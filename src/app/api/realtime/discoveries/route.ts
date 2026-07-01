/**
 * Server-Sent Events endpoint for the live discovery feed.
 * Fluid Compute keeps the stream open up to maxDuration; the client reconnects
 * automatically on close.
 */

import { NextRequest } from 'next/server';
import { subscribeDiscoveryEvents } from '@/lib/realtime/channel';

export const runtime = 'nodejs';
export const maxDuration = 600;

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('retry: 5000\n\n'));
      unsubscribe = subscribeDiscoveryEvents((event) => {
        controller.enqueue(encoder.encode(`event: discovery\ndata: ${JSON.stringify(event)}\n\n`));
      });

      // Keepalive every 25s so middleboxes don't close the stream.
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepalive);
        }
      }, 25_000);

      req.signal.addEventListener('abort', () => {
        clearInterval(keepalive);
        unsubscribe?.();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
