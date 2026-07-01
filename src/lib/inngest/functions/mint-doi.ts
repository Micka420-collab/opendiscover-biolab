import { db, schema } from '@/lib/db';
import { createZenodoDeposit } from '@/lib/integrations/zenodo';
import { eq, inArray } from 'drizzle-orm';
import { inngest } from '../client';

export const mintDoiFn = inngest.createFunction(
  { id: 'mint-doi', name: 'Mint DOI for promoted discovery', retries: 3 },
  { event: 'discovery/promoted' },
  async ({ event, step }) => {
    const { discoveryId } = event.data;

    const discovery = await step.run('load-discovery', async () => {
      const [row] = await db
        .select({
          id: schema.discoveries.id,
          title: schema.discoveries.title,
          summary: schema.discoveries.summary,
          cardMarkdown: schema.discoveries.cardMarkdown,
          noveltyScore: schema.discoveries.noveltyScore,
          doi: schema.discoveries.doi,
          createdAt: schema.discoveries.createdAt,
          promotedAt: schema.discoveries.promotedAt,
        })
        .from(schema.discoveries)
        .where(eq(schema.discoveries.id, discoveryId))
        .limit(1);

      if (!row) throw new Error(`Discovery not found: ${discoveryId}`);
      if (row.doi)
        return { ...row, contributors: [] as Array<{ handle: string; orcid: string | null }> };

      const triggers = await db
        .select({
          submissionId: schema.discoveryTriggers.submissionId,
        })
        .from(schema.discoveryTriggers)
        .where(eq(schema.discoveryTriggers.discoveryId, discoveryId));

      const submissionIds = triggers.map((t) => t.submissionId);

      let contributors: Array<{ handle: string; orcid: string | null }> = [];

      if (submissionIds.length > 0) {
        const rows = await db
          .selectDistinct({
            handle: schema.users.handle,
            orcid: schema.users.orcid,
          })
          .from(schema.submissions)
          .innerJoin(schema.users, eq(schema.submissions.contributorId, schema.users.id))
          .where(inArray(schema.submissions.id, submissionIds));

        contributors = rows;
      }

      return { ...row, contributors };
    });

    if (discovery.doi) {
      return { skipped: true, reason: 'DOI already minted', doi: discovery.doi };
    }

    const result = await step.run('mint-doi', async () => {
      if (!process.env.ZENODO_ACCESS_TOKEN) {
        console.log('[mint-doi] ZENODO_ACCESS_TOKEN not set — skipping DOI minting');
        return null;
      }

      const creators =
        discovery.contributors.length > 0
          ? discovery.contributors.map((c) =>
              c.orcid ? { name: c.handle, orcid: c.orcid } : { name: c.handle },
            )
          : [{ name: 'OpenDiscover Contributors' }];

      const metadata = {
        title: discovery.title,
        description: discovery.summary,
        creators,
        keywords: ['citizen-science', 'opendiscover'],
        license: 'cc-by-4.0' as const,
        upload_type: 'dataset' as const,
        communities: [{ identifier: 'opendiscover' }],
      };

      const fileContent = JSON.stringify(
        {
          id: discovery.id,
          title: discovery.title,
          summary: discovery.summary,
          cardMarkdown: discovery.cardMarkdown,
          noveltyScore: discovery.noveltyScore,
          contributors: discovery.contributors,
          createdAt: discovery.createdAt,
          promotedAt: discovery.promotedAt,
        },
        null,
        2,
      );

      return createZenodoDeposit(metadata, [{ name: 'discovery.json', content: fileContent }]);
    });

    if (!result) {
      return { skipped: true, reason: 'ZENODO_ACCESS_TOKEN not configured' };
    }

    await step.run('persist-doi', async () => {
      await db
        .update(schema.discoveries)
        .set({ doi: result.doi })
        .where(eq(schema.discoveries.id, discoveryId));
    });

    return { doi: result.doi, doiUrl: result.doiUrl, recordUrl: result.recordUrl };
  },
);
