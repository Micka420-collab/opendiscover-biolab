/**
 * Embedding service — uses Vercel AI Gateway → text-embedding-3-large (3072-d).
 *
 * Embeddings power:
 *   1. Submission → submission clustering (find corroboration)
 *   2. Submission → corpus similarity (novelty grounding)
 *
 * We compose a "claim summary" for each submission rather than embedding raw
 * numeric output — the claim summary captures *what was observed*, which is
 * what we want to match against literature.
 */

import { embed, MODELS } from './gateway';

export const EMBEDDING_DIM = 3072;

export async function embedClaim(claim: string): Promise<number[]> {
  const { embedding } = await embed({
    model: MODELS.embed,
    value: claim,
  });
  if (embedding.length !== EMBEDDING_DIM) {
    throw new Error(`Unexpected embedding dimension: ${embedding.length}`);
  }
  return embedding;
}

/**
 * Convert a submission's raw output + protocol context into a natural-language
 * "claim summary". Example:
 *   "In the genome NC_009925.1, found a 47-aa small ORF at coordinates
 *    123456–123599 on the + strand with strong codon-usage divergence
 *    (z-score 4.2) from the genome's bulk gene set."
 *
 * The summary is what we embed and what gets compared to literature.
 */
export function buildClaimSummary(
  protocolTitle: string,
  rawOutput: Record<string, unknown>,
  context: Record<string, unknown> = {},
): string {
  const parts = [
    `Protocol: ${protocolTitle}.`,
    `Context: ${JSON.stringify(context)}.`,
    `Result: ${JSON.stringify(rawOutput)}.`,
  ];
  return parts.join(' ');
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('dimension mismatch');
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-12);
}
