/**
 * PostHog product analytics (server-side capture for pipeline events).
 *
 * We track:
 *  - submission_received
 *  - submission_triaged           (noise / interesting / promoted)
 *  - discovery_promoted
 *  - discovery_reviewed
 *
 * Client-side capture (page views, runner usage) is wired up in app/providers.tsx.
 */

import { PostHog } from 'posthog-node';

let _posthog: PostHog | null = null;

function client(): PostHog | null {
  if (!process.env.POSTHOG_API_KEY) return null;
  if (_posthog) return _posthog;
  _posthog = new PostHog(process.env.POSTHOG_API_KEY, {
    host: process.env.POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });
  return _posthog;
}

export async function track(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  const c = client();
  if (!c) return;
  c.capture({ distinctId, event, properties });
  await c.shutdown();
}
