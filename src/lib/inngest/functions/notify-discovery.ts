/**
 * On every promoted discovery: notify the author, corroborators, and stream
 * the event to the live SSE channel that powers the public feed.
 */

import { db, schema } from '@/lib/db';
import { sendDiscoveryNotification } from '@/lib/email/send';
import { publishDiscoveryEvent } from '@/lib/realtime/channel';
import { inArray } from 'drizzle-orm';
import { inngest } from '../client';

export const notifyDiscoveryFn = inngest.createFunction(
  { id: 'notify-discovery', name: 'Notify on promoted discovery', retries: 5 },
  { event: 'discovery/promoted' },
  async ({ event, step }) => {
    const { discoveryId, authorId, corroboratorIds } = event.data;

    const [discovery] = await db
      .select()
      .from(schema.discoveries)
      .where(inArray(schema.discoveries.id, [discoveryId]))
      .limit(1);
    if (!discovery) return { skipped: true };

    const userIds = [authorId, ...corroboratorIds];
    const recipients = await db
      .select({ id: schema.users.id, handle: schema.users.handle, email: schema.users.email })
      .from(schema.users)
      .where(inArray(schema.users.id, userIds));

    const url = `${process.env.APP_URL ?? 'http://localhost:3000'}/discoveries/${discoveryId}`;

    await step.run('publish-realtime', () =>
      publishDiscoveryEvent({
        type: 'promoted',
        discoveryId,
        title: discovery.title,
        summary: discovery.summary,
        noveltyScore: discovery.noveltyScore,
      }),
    );

    await Promise.all(
      recipients
        .filter((r) => r.email)
        .map((r) =>
          step.run(`email-${r.id}`, () =>
            sendDiscoveryNotification({
              to: r.email!,
              contributorHandle: r.handle,
              discoveryTitle: discovery.title,
              discoveryUrl: url,
              role: r.id === authorId ? 'author' : 'corroborator',
            }),
          ),
        ),
    );

    return { notified: recipients.length };
  },
);
