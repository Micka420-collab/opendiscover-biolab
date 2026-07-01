import { serve } from 'inngest/next';
import {
  inngest,
  processSubmissionFn,
  notifyDiscoveryFn,
  canaryReplicateFn,
  recheckCorroborationFn,
  mintDoiFn,
  peerReviewFunction,
} from '@/lib/inngest';

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
