/**
 * Seed protocols + demo contributor.
 * Run: pnpm tsx scripts/seed-protocols.ts
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/lib/db';
import { canonicalHash } from '../src/lib/util/hash';

const PROTOCOLS = [
  {
    slug: 'small-orf-mining-v1',
    version: 1,
    title: 'Small ORF Mining in Bacterial Genomes',
    description:
      'Scan a slice of bacterial genome for small open reading frames (20–100 aa) with codon usage diverging from the genome bulk.',
    domain: 'microbial-genomics',
    runnerKind: 'js',
    runnerModule: 'builtin:small-orf-mining',
    inputSchema: {
      type: 'object',
      required: ['genomeId', 'sequence', 'windowStart', 'sliceKey'],
      properties: {
        genomeId: { type: 'string' },
        sequence: { type: 'string', pattern: '^[ACGTNacgtn]+$' },
        windowStart: { type: 'integer', minimum: 1 },
        sliceKey: { type: 'string' },
        minAa: { type: 'integer', minimum: 10 },
        maxAa: { type: 'integer', maximum: 300 },
        zThreshold: { type: 'number' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['hits', 'schemaVersion'],
      properties: { schemaVersion: { const: 1 } },
    },
    noveltyConfig: {
      weights: { similarity: 0.4, corroboration: 0.3, llm: 0.3 },
      clusterThreshold: 0.88,
    },
    status: 'active' as const,
  },
  {
    slug: 'codon-bias-hgt-v1',
    version: 1,
    title: 'Codon-Bias HGT Signature',
    description:
      'Compare a gene’s codon usage against a host genome and a panel of putative donors. Flags candidates whose closest match is NOT the host — a fingerprint of recent horizontal transfer.',
    domain: 'microbial-genomics',
    runnerKind: 'js',
    runnerModule: 'builtin:codon-bias-hgt',
    inputSchema: {
      type: 'object',
      required: ['hostGenomeId', 'hostBulkUsage', 'geneDna', 'geneId', 'donorPanel', 'sliceKey'],
      properties: {
        hostGenomeId: { type: 'string' },
        geneId: { type: 'string' },
        sliceKey: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['bestMatch', 'hgtCandidate', 'schemaVersion'],
      properties: { schemaVersion: { const: 1 } },
    },
    noveltyConfig: {
      weights: { similarity: 0.35, corroboration: 0.35, llm: 0.3 },
      clusterThreshold: 0.85,
    },
    status: 'active' as const,
  },
  {
    slug: 'motif-conservation-v1',
    version: 1,
    title: 'Cross-Genome Motif Conservation',
    description:
      'Search a short protein motif (5–25 aa) across multiple genomes. Flags motifs conserved across distantly related taxa that fall outside known annotated domains.',
    domain: 'comparative-genomics',
    runnerKind: 'js',
    runnerModule: 'builtin:motif-conservation',
    inputSchema: {
      type: 'object',
      required: ['motif', 'genomes', 'sliceKey'],
      properties: {
        motif: { type: 'string', minLength: 5, maxLength: 25 },
        maxMismatches: { type: 'integer', minimum: 0, maximum: 5 },
        sliceKey: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['hitGenomes', 'noveltyConservationScore', 'schemaVersion'],
      properties: { schemaVersion: { const: 1 } },
    },
    noveltyConfig: {
      weights: { similarity: 0.4, corroboration: 0.3, llm: 0.3 },
      clusterThreshold: 0.9,
    },
    status: 'active' as const,
  },
  {
    slug: 'alphafold-disorder-v1',
    version: 1,
    title: 'AlphaFold pLDDT Disorder Region Mining',
    description:
      'Identify intrinsically disordered regions (IDRs) in a protein using AlphaFold2 per-residue pLDDT confidence scores. Low pLDDT (< 50) is a validated proxy for structural disorder. Flags proteins with unusually long disordered stretches outside known functional domains.',
    domain: 'structural-biology',
    runnerKind: 'js',
    runnerModule: 'builtin:alphafold-disorder',
    inputSchema: {
      type: 'object',
      required: ['uniprotAccession', 'plddt', 'sequence', 'sliceKey'],
      properties: {
        uniprotAccession: { type: 'string' },
        plddt: { type: 'array', items: { type: 'number', minimum: 0, maximum: 100 } },
        sequence: { type: 'string', pattern: '^[ACDEFGHIKLMNPQRSTVWY]+$' },
        sliceKey: { type: 'string' },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['disorderRegions', 'disorderFraction', 'schemaVersion'],
      properties: { schemaVersion: { const: 1 } },
    },
    noveltyConfig: {
      weights: { similarity: 0.35, corroboration: 0.3, llm: 0.35 },
      clusterThreshold: 0.85,
    },
    status: 'active' as const,
  },
];

async function main() {
  const handle = 'demo-contributor';
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.handle, handle))
    .limit(1);
  if (!existing) {
    await db
      .insert(schema.users)
      .values({ handle, email: 'demo@opendiscover.science', reputation: 1.0 });
    console.log('seeded demo contributor', handle);
  }

  for (const p of PROTOCOLS) {
    const contentHash = await canonicalHash(p);
    await db
      .insert(schema.protocols)
      .values({ ...p, contentHash })
      .onConflictDoUpdate({
        target: schema.protocols.contentHash,
        set: { ...p, updatedAt: new Date() },
      });
    console.log('seeded', p.slug, `v${p.version}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
