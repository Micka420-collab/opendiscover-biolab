// @ts-nocheck
/**
 * Internal corpus search — pgvector kNN over our pre-embedded reference
 * literature. Lets the agent inspect what's "nearby" in our curated index
 * before reaching for live web tools.
 */

import { nearestCorpus } from '@/lib/db/queries';
import { tool } from 'ai';
import { z } from 'zod';
import { embedClaim } from '../embeddings';

export const searchInternalCorpus = tool({
  description:
    'Search the platform’s pre-embedded reference corpus (UniProt, SmProt, sORFs.org, Europe PMC) by semantic similarity. Cheaper and faster than live tools. Use as the first search step.',
  parameters: z.object({
    queryText: z.string().describe('Natural-language description of what to look for.'),
    limit: z.number().int().min(1).max(20).default(10),
  }),
  execute: async ({ queryText, limit }) => {
    const embedding = await embedClaim(queryText);
    const neighbors = await nearestCorpus(embedding, limit);
    return {
      hits: neighbors.map((n) => ({
        source: n.source,
        externalId: n.externalId,
        title: n.title,
        summary: n.summary,
        similarity: Number(n.similarity.toFixed(3)),
      })),
    };
  },
});
