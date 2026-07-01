/**
 * Inngest client + event registry.
 *
 * Each step of the discovery pipeline becomes an Inngest function:
 *  - automatic retries with exponential backoff
 *  - replay-from-step
 *  - durable state (we can crash mid-pipeline and resume)
 *  - per-step traces in the Inngest dashboard
 *
 * Events:
 *  - submission/received        → triage, embed, cluster, score, maybe promote
 *  - discovery/promoted         → notify, write SSE, mint provenance
 *  - submission/recheck-corroboration → daily/15min for late corroborators
 *  - protocol/canary-replicate  → re-runs the protocol to confirm determinism
 */

import { EventSchemas, Inngest } from 'inngest';
import { z } from 'zod';

const events = {
  'submission/received': {
    data: z.object({ submissionId: z.string() }),
  },
  'submission/recheck-corroboration': {
    data: z.object({ submissionId: z.string() }),
  },
  'discovery/promoted': {
    data: z.object({
      discoveryId: z.string(),
      authorId: z.string(),
      corroboratorIds: z.array(z.string()),
    }),
  },
  'protocol/canary-replicate': {
    data: z.object({ submissionId: z.string() }),
  },
  'discovery/peer-review': {
    data: z.object({
      discoveryId: z.string(),
      reviewId: z.string(),
    }),
  },
};

export const inngest = new Inngest({
  id: 'opendiscover',
  schemas: new EventSchemas().fromZod(events),
});

export type InngestEvents = typeof inngest;
