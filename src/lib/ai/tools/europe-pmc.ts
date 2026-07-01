// @ts-nocheck
/**
 * Europe PMC search tool — lets the novelty agent ground claims against
 * open-access biomedical literature in real time, not just our cached corpus.
 *
 * Why this matters: the cached corpus has a daily refresh cadence; a claim
 * about a hot topic could be "novel vs corpus" but actually well-published
 * last week. The agent calls this tool to widen the search before judging.
 */

import { z } from 'zod';
import { tool } from 'ai';

const EUROPE_PMC_BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

export const searchEuropePMC = tool({
  description:
    'Search Europe PMC (open-access biomedical literature, 40M+ articles). Returns up to 10 hits with abstract snippets. Use to verify whether a claim is already in the recent literature.',
  parameters: z.object({
    query: z
      .string()
      .describe(
        'Full-text search query, e.g. "small ORF Mycobacterium codon bias", "horizontal gene transfer beta-lactamase Acinetobacter". Quote multi-word phrases.',
      ),
    maxResults: z.number().int().min(1).max(20).default(8),
  }),
  execute: async ({ query, maxResults }) => {
    const url = new URL(EUROPE_PMC_BASE);
    url.searchParams.set('query', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('pageSize', String(maxResults));
    url.searchParams.set('resultType', 'lite');

    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) {
      return { error: `Europe PMC returned ${resp.status}`, hits: [] as Array<unknown> };
    }
    const json = (await resp.json()) as {
      resultList?: {
        result?: Array<{
          id?: string;
          source?: string;
          pmid?: string;
          doi?: string;
          title?: string;
          authorString?: string;
          journalTitle?: string;
          pubYear?: string;
          abstractText?: string;
        }>;
      };
    };
    const hits = (json.resultList?.result ?? []).map((r) => ({
      id: r.pmid ?? r.id ?? r.doi ?? 'unknown',
      doi: r.doi,
      title: r.title ?? '',
      authors: r.authorString ?? '',
      journal: r.journalTitle ?? '',
      year: r.pubYear ?? '',
      abstract: (r.abstractText ?? '').slice(0, 800),
    }));
    return { hits };
  },
});
