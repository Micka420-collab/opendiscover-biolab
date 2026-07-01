import {
  canaryReplicateFn,
  inngest,
  mintDoiFn,
  notifyDiscoveryFn,
  peerReviewFunction,
  processSubmissionFn,
  recheckCorroborationFn,
} from '@/lib/inngest';
import { serve } from 'inngest/next';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    processSubmissionFn,
    notifyDiscoveryFn,
    canaryReplicateFn,
    recheckCorroborationFn,
    mintDoiFn,
    peerReviewFunction,
  ],
});

export const maxDuration = 300;
