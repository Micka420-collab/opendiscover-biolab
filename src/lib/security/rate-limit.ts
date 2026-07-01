/**
 * Rate limiting via Upstash Redis. Two distinct buckets:
 *   - per-IP: prevents anonymous bot floods on /api/submissions
 *   - per-contributor: prevents authenticated abuse / runaway scripts
 *
 * Falls back to in-memory limit in dev (no Redis required).
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const useRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL);

const redis = useRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

class MemoryStore {
  private map = new Map<string, { count: number; reset: number }>();
  async get(key: string) {
    return this.map.get(key);
  }
  async set(key: string, count: number, reset: number) {
    this.map.set(key, { count, reset });
  }
}

const memory = new MemoryStore();

async function memoryCheck(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const entry = await memory.get(key);
  if (!entry || entry.reset < now) {
    await memory.set(key, 1, now + windowMs);
    return { success: true, remaining: limit - 1 };
  }
  if (entry.count >= limit) return { success: false, remaining: 0 };
  await memory.set(key, entry.count + 1, entry.reset);
  return { success: true, remaining: limit - entry.count - 1 };
}

export const submissionRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
      prefix: 'rl:submission',
    })
  : null;

export async function limitSubmission(identifier: string) {
  if (submissionRateLimit) return submissionRateLimit.limit(identifier);
  return memoryCheck(`submission:${identifier}`, 30, 60_000);
}

export const authRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'rl:auth',
    })
  : null;

export async function limitAuth(identifier: string) {
  if (authRateLimit) return authRateLimit.limit(identifier);
  return memoryCheck(`auth:${identifier}`, 10, 60_000);
}
