// @ts-nocheck
/**
 * UniProt search tool — for the agent to check whether a protein sequence or
 * domain motif already has a curated annotation.
 *
 * UniProt is the authoritative protein knowledge base. If the agent's claim
 * involves a sequence or motif, this is the first place to look.
 */

import { tool } from 'ai';
import { z } from 'zod';

const UNIPROT_BASE = 'https://rest.uniprot.org/uniprotkb/search';

export const searchUniProt = tool({
  description:
    'Search UniProt for proteins matching a free-text query, motif, or sequence fragment. Returns up to 10 entries with curated function descriptions. Use to check whether a putative novel protein has a known homolog.',
  parameters: z.object({
    query: z
      .string()
      .describe(
        'UniProt query syntax. Examples: "GTPase Bacillus subtilis", "sequence:MNKLPEPTIDEHERE", "length:[20 TO 100] AND organism_id:9606".',
      ),
    maxResults: z.number().int().min(1).max(20).default(8),
  }),
  execute: async ({ query, maxResults }) => {
    const url = new URL(UNIPROT_BASE);
    url.searchParams.set('query', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('size', String(maxResults));
    url.searchParams.set(
      'fields',
      'accession,id,protein_name,organism_name,length,cc_function,ft_domain',
    );

    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) {
      return { error: `UniProt returned ${resp.status}`, hits: [] as Array<unknown> };
    }
    const json = (await resp.json()) as {
      results?: Array<{
        primaryAccession?: string;
        uniProtkbId?: string;
        proteinDescription?: { recommendedName?: { fullName?: { value?: string } } };
        organism?: { scientificName?: string };
        sequence?: { length?: number };
        comments?: Array<{ commentType?: string; texts?: Array<{ value?: string }> }>;
      }>;
    };
    const hits = (json.results ?? []).map((r) => ({
      accession: r.primaryAccession ?? '',
      id: r.uniProtkbId ?? '',
      name: r.proteinDescription?.recommendedName?.fullName?.value ?? 'unnamed',
      organism: r.organism?.scientificName ?? 'unknown',
      length: r.sequence?.length ?? null,
      function:
        r.comments?.find((c) => c.commentType === 'FUNCTION')?.texts?.[0]?.value?.slice(0, 600) ??
        null,
    }));
    return { hits };
  },
});
