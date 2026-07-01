/**
 * Canary replication — re-runs a triggering submission's protocol on the same
 * input slice. If the output hash doesn't match, we mark the protocol as
 * non-deterministic and demote any discoveries derived from it.
 *
 * The actual re-run happens in Vercel Sandbox for isolation.
 */

import { db, schema } from '@/lib/db';
import { runProtocolInSandbox } from '@/lib/sandbox/protocol-runner';
import { canonicalHash } from '@/lib/util/hash';
import { eq } from 'drizzle-orm';
import { inngest } from '../client';

export const canaryReplicateFn = inngest.createFunction(
  { id: 'canary-replicate', name: 'Canary replication check', retries: 2 },
  { event: 'protocol/canary-replicate' },
  async ({ event, step }) => {
    const { submissionId } = event.data;

    const [submission] = await db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.id, submissionId))
      .limit(1);
    if (!submission) return { skipped: 'not_found' };

    const [protocol] = await db
      .select()
      .from(schema.protocols)
      .where(eq(schema.protocols.id, submission.protocolId))
      .limit(1);

    const result = await step.run('run-in-sandbox', () =>
      runProtocolInSandbox({
        protocolSlug: protocol?.slug,
        protocolVersion: protocol?.version,
        runnerKind: protocol?.runnerKind as 'js' | 'pyodide' | 'sandbox',
        input: submission.inputSlice as Record<string, unknown>,
      }),
    );

    const replicatedHash = await canonicalHash(result.output);
    const matches = replicatedHash === submission.outputHash;

    await step.run('record-result', async () => {
      await db.insert(schema.pipelineRuns).values({
        submissionId,
        runId: event.id ?? crypto.randomUUID(),
        stage: 'canary-replicate',
        status: matches ? 'replicated' : 'mismatch',
        durationMs: result.durationMs,
        payload: { replicatedHash, originalHash: submission.outputHash },
      });
    });

    if (matches) {
      await step.run('flag-replicated', async () => {
        // Mark any discoveries triggered by this submission as canary-passed.
        await db.execute(
          /* sql */ `UPDATE discoveries SET canary_replicated = true
                     WHERE id IN (SELECT discovery_id FROM discovery_triggers WHERE submission_id = ${submissionId})`,
        );
      });
    } else {
      await step.run('flag-mismatch', async () => {
        // Demote: a non-deterministic protocol can't yield trustworthy discoveries.
        await db
          .update(schema.protocols)
          .set({ status: 'restricted' })
          .where(eq(schema.protocols.id, protocol?.id));
      });
    }

    return { matches, replicatedHash };
  },
);
