// @ts-nocheck
import { type VercelConfig, routes } from '@vercel/config/v1';

/**
 * Vercel project configuration.
 *
 * Highlights:
 * - Fluid Compute everywhere (default since Sonnet-class workloads benefit
 *   from instance reuse on the AI pipeline).
 * - Multi-region: deploy to fra1 (EU) + iad1 (US East) for low-latency
 *   submissions; cron jobs pinned to iad1 to avoid duplicate fires.
 * - Rolling Releases for the discovery-pipeline endpoints — a regression in
 *   the novelty scorer should not flush all of production.
 * - BotID on the submission endpoint to keep adversarial bots out of the
 *   pipeline before they cost us LLM dollars.
 * - Aggressive caching on static + dataset proxies.
 */
// NOTE: Rolling Releases and BotID (bot protection) are configured in the
// Vercel dashboard / project settings, not in this file — the deploy-time
// config schema rejects them as top-level keys. Keep the intent here for
// reference: stage the discovery-pipeline endpoints (/api/submissions,
// /api/inngest) at 5% → 25% → 100%, and enforce BotID on /api/submissions
// and /api/auth/*.
export const config: VercelConfig = {
  framework: 'nextjs',
  buildCommand: 'pnpm run build',
  regions: ['fra1', 'iad1'],

  headers: [
    routes.cacheControl('/static/(.*)', {
      public: true,
      maxAge: '1 week',
      immutable: true,
    }),
    routes.cacheControl('/api/datasets/(.*)', {
      public: true,
      maxAge: '1 day',
      sMaxAge: '7 days',
      staleWhileRevalidate: '30 days',
    }),
  ],

  crons: [
    { path: '/api/cron/refresh-corpus', schedule: '0 3 * * *' },
    { path: '/api/cron/promote-candidates', schedule: '*/15 * * * *' },
    { path: '/api/cron/replicate-canary', schedule: '0 */6 * * *' },
  ],
};
