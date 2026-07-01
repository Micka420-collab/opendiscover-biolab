import { inngest } from '../client';

/**
 * Re-trigger pipeline for a submission stuck at "interesting but not enough
 * corroboration". Inngest schedules the redelivery with a fan-in mechanism so
 * a fresh corroborator landing within the window will satisfy multiple
 * pending submissions in one pass.
 */
export const recheckCorroborationFn = inngest.createFunction(
  { id: 'recheck-corroboration', name: 'Recheck corroboration', retries: 1 },
  { event: 'submission/recheck-corroboration' },
  async ({ event, step }) => {
    await step.sendEvent('reenqueue', {
      name: 'submission/received',
      data: { submissionId: event.data.submissionId },
    });
    return { reenqueued: true };
  },
);
