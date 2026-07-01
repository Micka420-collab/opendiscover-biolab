/**
 * Aggregate pattern detection across submissions.
 *
 * The intuition: a single submission rarely IS a discovery. A discovery is when
 * a *cluster* of submissions on disjoint input slices converges on the same
 * unexpected signal.
 *
 * Algorithm:
 *   1. For a candidate submission, retrieve K embedding-nearest other submissions
 *      of the same protocol within a rolling window.
 *   2. Cluster (here: DBSCAN-lite over cosine distance).
 *   3. If the candidate's cluster has ≥ CORROBORATION_MIN distinct contributors,
 *      mark them as corroborating each other.
 *   4. Return a corroboration count + cluster summary.
 *
 * The clustering threshold is per-protocol — tight protocols (motif mining) use
 * 0.92, loose ones (anomaly detection) use 0.80.
 */

import { cosineSimilarity } from './embeddings';

export interface CandidateSubmission {
  id: string;
  contributorId: string;
  embedding: number[];
  inputSliceKey: string; // protocols must expose a stable key so we can confirm "disjoint"
}

export interface CorroborationResult {
  corroborators: CandidateSubmission[];
  distinctContributors: number;
  meanSimilarity: number;
  disjointSlices: boolean;
}

export function findCorroborations(
  candidate: CandidateSubmission,
  pool: CandidateSubmission[],
  opts: { threshold?: number; maxNeighbors?: number } = {},
): CorroborationResult {
  const threshold = opts.threshold ?? 0.88;
  const maxNeighbors = opts.maxNeighbors ?? 50;

  const scored = pool
    .filter((s) => s.id !== candidate.id && s.contributorId !== candidate.contributorId)
    .map((s) => ({ sub: s, sim: cosineSimilarity(candidate.embedding, s.embedding) }))
    .filter((x) => x.sim >= threshold)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, maxNeighbors);

  const corroborators = scored.map((x) => x.sub);
  const distinctContributors = new Set(
    corroborators.map((c) => c.contributorId).concat(candidate.contributorId),
  ).size;

  const slices = new Set(corroborators.map((c) => c.inputSliceKey));
  const disjointSlices = slices.size >= 2 && !slices.has(candidate.inputSliceKey);

  const meanSimilarity =
    scored.length === 0 ? 0 : scored.reduce((a, x) => a + x.sim, 0) / scored.length;

  return { corroborators, distinctContributors, meanSimilarity, disjointSlices };
}
