/**
 * Discovery pipeline — Inngest durable workflow.
 *
 * Each `step.run(name, fn)` is an atomic, retryable, individually-traced unit.
 * Inngest persists outputs so we can crash anywhere and resume from the last
 * successful step (including across deploys).
 *
 * Flow:
 *   1. loadSubmission
 *   2. triage                       (skip rest on noise)
 *   3. embedClaim
 *   4. clusterCorroborations
 *   5. retrieveCorpusNeighbors
 *   6. scoreNovelty                 (Opus agent with tool-use)
 *   7. persistScores
 *   8. promotionGate                (exit early if not enough)
 *   9. attachToExistingDiscovery    (or fall through)
 *  10. generateCard + generateVisualization (parallel)
 *  11. persistDiscovery
 *  12. emit "discovery/promoted" event
 */

import { runNoveltyAgent } from '@/lib/ai/agents/novelty-agent';
import { buildClaimSummary, embedClaim } from '@/lib/ai/embeddings';
import { findCorroborations } from '@/lib/ai/pattern-detect';
import { triageSubmission } from '@/lib/ai/triage';
import { generateDiscoveryCard, generateVisualizationSpec } from '@/lib/ai/vulgarize';
import { db, schema } from '@/lib/db';
import { nearestCorpus, nearestSubmissions, setSubmissionEmbedding } from '@/lib/db/queries';
import { eq, sql } from 'drizzle-orm';
import { inngest } from '../client';

const NOVELTY_THRESHOLD = Number(process.env.NOVELTY_THRESHOLD ?? '0.75');
const CORROBORATION_MIN = Number(process.env.CORROBORATION_MIN ?? '2');

export const processSubmissionFn = inngest.createFunction(
  {
    id: 'process-submission',
    name: 'Discovery pipeline — process submission',
    concurrency: { limit: 20, key: 'event.data.submissionId' },
    retries: 3,
    onFailure: async ({ event, error }) => {
      console.error('[pipeline failed]', event.data, error);
    },
  },
  { event: 'submission/received' },
  async ({ event, step, logger }) => {
    const { submissionId } = event.data;

    /* 1. Load */
    const submission = await step.run('load-submission', async () => {
      const [row] = await db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.id, submissionId))
        .limit(1);
      if (!row) throw new Error(`submission ${submissionId} not found`);
      const [proto] = await db
        .select()
        .from(schema.protocols)
        .where(eq(schema.protocols.id, row.protocolId))
        .limit(1);
      const [contributor] = await db
        .select({ id: schema.users.id, handle: schema.users.handle, email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, row.contributorId))
        .limit(1);
      return { sub: row, protocol: proto!, contributor: contributor! };
    });

    /* 2. Triage */
    const triage = await step.run('triage', () =>
      triageSubmission({
        protocolTitle: submission.protocol.title,
        protocolDescription: submission.protocol.description,
        rawOutput: submission.sub.rawOutput as Record<string, unknown>,
      }),
    );

    if (!triage.interesting) {
      await step.run('mark-noise', async () => {
        await db
          .update(schema.submissions)
          .set({
            status: 'triaged_noise',
            triageScore: triage.score,
            rejectionReason: triage.reason,
            processedAt: new Date(),
          })
          .where(eq(schema.submissions.id, submissionId));
      });
      return { status: 'noise' as const };
    }

    /* 3. Embed (or reuse if pre-computed at submission time) */
    const { embedding, claim } = await step.run('embed-claim', async () => {
      const claim = buildClaimSummary(
        submission.protocol.title,
        submission.sub.rawOutput as Record<string, unknown>,
        submission.sub.inputSlice as Record<string, unknown>,
      );
      const embedding = submission.sub.embedding ?? (await embedClaim(claim));
      if (!submission.sub.embedding) {
        await setSubmissionEmbedding(submissionId, embedding);
        await db
          .update(schema.submissions)
          .set({ claimSummary: claim })
          .where(eq(schema.submissions.id, submissionId));
      }
      return { embedding, claim };
    });

    /* 4. Cluster */
    const corroboration = await step.run('cluster-corroborations', async () => {
      const recent = await nearestSubmissions({
        embedding,
        protocolId: submission.protocol.id,
        excludeId: submissionId,
        limit: 100,
      });
      const cfg = submission.protocol.noveltyConfig as { clusterThreshold?: number };
      return findCorroborations(
        {
          id: submission.sub.id,
          contributorId: submission.sub.contributorId,
          embedding,
          inputSliceKey: submission.sub.sliceKey,
        },
        recent.map((r) => ({
          id: r.id,
          contributorId: r.contributorId,
          embedding: r.embedding as number[],
          inputSliceKey: r.sliceKey,
        })),
        { threshold: cfg?.clusterThreshold ?? 0.88 },
      );
    });

    /* 5. Corpus neighbors */
    const neighbors = await step.run('retrieve-corpus-neighbors', () =>
      nearestCorpus(embedding, 12),
    );

    /* 6. Novelty (agent with tool-use) */
    const { score, judgment } = await step.run('score-novelty', () =>
      runNoveltyAgent({
        claimSummary: claim,
        neighbors,
        corroborationCount: corroboration.distinctContributors - 1,
        rawOutput: submission.sub.rawOutput as Record<string, unknown>,
      }),
    );

    /* 7. Persist scores */
    await step.run('persist-scores', async () => {
      await db
        .update(schema.submissions)
        .set({
          status: 'triaged_interesting',
          triageScore: triage.score,
          noveltyScore: score,
          processedAt: new Date(),
        })
        .where(eq(schema.submissions.id, submissionId));
    });

    /* 8. Promotion gate */
    const enoughNovelty = score >= NOVELTY_THRESHOLD;
    const enoughCorroboration = corroboration.distinctContributors >= CORROBORATION_MIN;
    const disjoint = corroboration.disjointSlices;

    if (!enoughNovelty) {
      return { status: 'below_threshold' as const, score };
    }
    if (!enoughCorroboration || !disjoint) {
      // Schedule a recheck — maybe a corroborator will arrive within 7 days.
      await step.sendEvent('schedule-recheck', {
        name: 'submission/recheck-corroboration',
        data: { submissionId },
        ts: Date.now() + 24 * 60 * 60 * 1000,
      });
      return { status: 'corroboration_pending' as const, score };
    }

    /* 9. Maybe attach to existing discovery */
    const existingDiscoveryId = await step.run('check-existing-discovery', async () => {
      const triggerIds = corroboration.corroborators.map((c) => c.id);
      if (triggerIds.length === 0) return null;
      const [row] = await db
        .select({ id: schema.discoveries.id })
        .from(schema.discoveries)
        .innerJoin(
          schema.discoveryTriggers,
          eq(schema.discoveryTriggers.discoveryId, schema.discoveries.id),
        )
        .where(
          sql`${schema.discoveryTriggers.submissionId} IN (${sql.join(
            triggerIds.map((id) => sql`${id}`),
            sql`, `,
          )}) AND ${schema.discoveries.protocolId} = ${submission.protocol.id}`,
        )
        .limit(1);
      return row?.id ?? null;
    });

    if (existingDiscoveryId) {
      await step.run('attach-corroboration', async () => {
        await db
          .insert(schema.discoveryTriggers)
          .values({
            discoveryId: existingDiscoveryId,
            submissionId,
            role: 'corroboration',
          })
          .onConflictDoNothing();
        await db
          .update(schema.submissions)
          .set({ status: 'promoted' })
          .where(eq(schema.submissions.id, submissionId));
      });
      return { status: 'attached_existing' as const, discoveryId: existingDiscoveryId };
    }

    /* 10. Generate card + visualization in parallel */
    const [card, visualization] = await Promise.all([
      step.run('generate-card', () =>
        generateDiscoveryCard({
          protocolTitle: submission.protocol.title,
          protocolDescription: submission.protocol.description,
          claimSummary: claim,
          rawData: submission.sub.rawOutput as Record<string, unknown>,
          noveltyJudgment: judgment,
          noveltyScore: score,
          contributorHandle: submission.contributor.handle,
          corroborations: corroboration.distinctContributors - 1,
        }),
      ),
      step.run('generate-visualization', () =>
        generateVisualizationSpec({
          rawData: submission.sub.rawOutput as Record<string, unknown>,
          context: `${submission.protocol.title}: ${claim}`,
        }),
      ),
    ]);

    /* 11. Persist */
    const discoveryId = await step.run('persist-discovery', async () => {
      const [d] = await db
        .insert(schema.discoveries)
        .values({
          authorId: submission.contributor.id,
          protocolId: submission.protocol.id,
          title: card.title,
          summary: card.one_line_hook,
          cardMarkdown: renderCardMarkdown(card),
          visualizationSpec: visualization,
          rawData: submission.sub.rawOutput as object,
          noveltyScore: score,
          noveltyReasoning: judgment.reasoning,
          citations: judgment.overlapping_citations as object,
          status: 'provisional',
          promotedAt: new Date(),
        })
        .returning({ id: schema.discoveries.id });

      await db.insert(schema.discoveryTriggers).values([
        { discoveryId: d?.id, submissionId, role: 'trigger' },
        ...corroboration.corroborators.map((c) => ({
          discoveryId: d?.id,
          submissionId: c.id,
          role: 'corroboration' as const,
        })),
      ]);

      await db
        .update(schema.submissions)
        .set({ status: 'promoted' })
        .where(eq(schema.submissions.id, submissionId));

      return d?.id;
    });

    /* 12. Emit downstream event */
    await step.sendEvent('discovery-promoted', {
      name: 'discovery/promoted',
      data: {
        discoveryId,
        authorId: submission.contributor.id,
        corroboratorIds: corroboration.corroborators.map((c) => c.contributorId),
      },
    });

    // Schedule a canary replication to verify determinism.
    await step.sendEvent('schedule-canary', {
      name: 'protocol/canary-replicate',
      data: { submissionId },
      ts: Date.now() + 60 * 60 * 1000,
    });

    logger.info(`Discovery ${discoveryId} promoted from submission ${submissionId}`);
    return { status: 'promoted_new' as const, score, discoveryId };
  },
);

function renderCardMarkdown(c: {
  title: string;
  one_line_hook: string;
  what_was_observed: string;
  why_it_might_matter: string;
  what_it_does_not_prove: string;
  how_to_replicate: string;
  next_experiments: string[];
}): string {
  return `# ${c.title}

_${c.one_line_hook}_

## What was observed
${c.what_was_observed}

## Why it might matter
${c.why_it_might_matter}

## What it does NOT prove
${c.what_it_does_not_prove}

> This is a provisional in-silico signal, not a clinical or applied claim.

## How to replicate
${c.how_to_replicate}

## Suggested next experiments
${c.next_experiments.map((e) => `- ${e}`).join('\n')}
`;
}
