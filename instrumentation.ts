/**
 * Next.js instrumentation hook — runs once per server cold start.
 *
 * - @vercel/otel wires distributed tracing into AI SDK calls, Drizzle queries,
 *   and Inngest steps automatically.
 * - Sentry captures unhandled errors with rich context.
 */

import { registerOTel } from '@vercel/otel';

export async function register() {
  registerOTel({
    serviceName: 'opendiscover',
    instrumentationConfig: {
      fetch: { propagateContextUrls: ['*'] },
    },
  });

  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.05,
    });
  }
}

export const onRequestError = async (
  err: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
) => {
  if (process.env.SENTRY_DSN) {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(err, { extra: { request } });
  }
  console.error('[onRequestError]', request.path, err);
};
