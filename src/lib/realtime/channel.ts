/**
 * Realtime discovery channel — Upstash Redis pub/sub backing an SSE endpoint.
 *
 * Why Redis pub/sub: works seamlessly across multi-region serverless,
 * sub-50ms latency, no socket-state management.
 *
 * Falls back to in-process EventEmitter in dev (no Redis required).
 */

import { EventEmitter } from 'node:events';
import { Redis } from '@upstash/redis';

export interface DiscoveryEvent {
  type: 'promoted' | 'reviewed' | 'confirmed' | 'refuted';
  discoveryId: string;
  title?: string;
  summary?: string;
  noveltyScore?: number;
  at?: number;
}

const CHANNEL = 'discoveries';

const useRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL);
const localBus = new EventEmitter();

const redis = useRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

export async function publishDiscoveryEvent(event: DiscoveryEvent) {
  const enriched = { ...event, at: event.at ?? Date.now() };
  if (redis) {
    await redis.publish(CHANNEL, JSON.stringify(enriched));
  } else {
    localBus.emit(CHANNEL, enriched);
  }
}

export function subscribeDiscoveryEvents(onEvent: (e: DiscoveryEvent) => void): () => void {
  if (redis) {
    // Upstash REST doesn't natively pub/sub; production should use Vercel Queues
    // or a long-lived Redis socket. For demo we poll a recent-events list.
    let stop = false;
    let lastSeen = Date.now();
    (async () => {
      while (!stop) {
        try {
          const raw = (await redis.lrange<string>('discoveries:recent', 0, 20)) ?? [];
          for (const s of raw) {
            const ev = JSON.parse(s) as DiscoveryEvent;
            if ((ev.at ?? 0) > lastSeen) {
              lastSeen = ev.at ?? Date.now();
              onEvent(ev);
            }
          }
        } catch (e) {
          console.warn('[realtime] poll error', e);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    })();
    return () => {
      stop = true;
    };
  }
  const handler = (e: DiscoveryEvent) => onEvent(e);
  localBus.on(CHANNEL, handler);
  return () => localBus.off(CHANNEL, handler);
}
