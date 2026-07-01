import { eq, sql, count, and } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { inngest } from '../client';

// Maps the reviewActionEnum values to reputation deltas
const ACTION_DELTA: Record<string, number> = {
  replicate: 0.05,
  endorse: 0.03,
  annotate: 0.01,
  challenge: -0.01,
  retract: -0.02,
};

export const peerReviewFunction = inngest.createFunction(
  { id: 'peer-review', name: 'Process peer review', retries: 3 },
  { event: 'discovery/peer-review' },
  async ({ event, step }) => {
    const { discoveryId, reviewId } = event.data;

    const { review, discovery } = await step.run('load-review', async () => {
      const [r] = await db
        .select()
        .from(schema.peerReviews)
        .where(eq(schema.peerReviews.id, reviewId))
        .limit(1);
      if (!r) throw new Error(`peer review ${reviewId} not found`);

      const [d] = await db
        .select()
        .from(schema.discoveries)
        .where(eq(schema.discoveries.id, discoveryId))
        .limit(1);
      if (!d) throw new Error(`discovery ${discoveryId} not found`);

      return { review: r, discovery: d };
    });

    await step.run('update-reputation', async () => {
      const delta = ACTION_DELTA[review.action] ?? 0;
      if (delta === 0) return;

      await db
        .update(schema.users)
        .set({
          reputation: sql`LEAST(10, GREATEST(0, reputation + ${delta}))`,
        })
        .where(eq(schema.users.id, review.reviewerId));
    });

    await step.run('update-discovery-status', async () => {
      const rows = await db
        .select({ action: schema.peerReviews.action, total: count() })
        .from(schema.peerReviews)
        .where(eq(schema.peerReviews.discoveryId, discoveryId))
        .groupBy(schema.peerReviews.action);

      const tally: Record<string, number> = {};
      for (const row of rows) {
        tally[row.action] = Number(row.total);
      }

      const approvals = (tally['endorse'] ?? 0) + (tally['replicate'] ?? 0);
      const disputes = (tally['challenge'] ?? 0) + (tally['retract'] ?? 0);

      let newStatus: (typeof schema.discoveries.$inferSelect)['status'] | null = null;
      if (approvals >= 3) {
        newStatus = 'confirmed';
      } else if (disputes >= 2) {
        newStatus = 'disputed';
      }

      if (newStatus) {
        await db
          .update(schema.discoveries)
          .set({ status: newStatus })
          .where(eq(schema.discoveries.id, discoveryId));
      }
    });

    await step.run('emit-notification', async () => {
      const [trigger] = await db
        .select({ submissionId: schema.discoveryTriggers.submissionId })
        .from(schema.discoveryTriggers)
        .where(
          and(
            eq(schema.discoveryTriggers.discoveryId, discovery.id),
            eq(schema.discoveryTriggers.role, 'trigger'),
          ),
        )
        .limit(1);

      if (trigger) {
        await inngest.send({
          name: 'submission/recheck-corroboration',
          data: { submissionId: trigger.submissionId },
        });
      }
    });

    return { reviewId, discoveryId };
  },
);
