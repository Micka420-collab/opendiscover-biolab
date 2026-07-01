/**
 * Ingest a slice of the reference corpus into pgvector.
 * Run: pnpm tsx scripts/ingest-reference-corpus.ts
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { embedClaim } from '../src/lib/ai/embeddings';
import { db, schema } from '../src/lib/db';

const SEED = [
  {
    source: 'smprot',
    externalId: 'SMP000001',
    title: 'Sib RNA-encoded peptide IbsA in E. coli',
    summary:
      'IbsA is an 18-amino-acid toxic peptide encoded by the ibsA gene in Escherichia coli, part of the type I toxin-antitoxin system. Canonical example of a small protein with strong codon-usage divergence from the genome bulk.',
  },
  {
    source: 'smprot',
    externalId: 'SMP000147',
    title: 'MgrB regulatory peptide in Salmonella',
    summary:
      '47-aa membrane peptide regulating PhoQ kinase. Conserved across Enterobacteriaceae; under-annotated by standard Prodigal runs because of its short length and non-canonical start codon (GTG).',
  },
  {
    source: 'sorfs',
    externalId: 'SOR-BAC-00231',
    title: 'Undescribed sORF cluster on Mycobacterium phage genomes',
    summary:
      'Putative cluster of 30–60-aa ORFs detected by ribosome profiling in mycobacterial phages, mostly lacking functional annotation. Many show codon-usage profiles distinct from their host bacteria, suggesting recent horizontal acquisition.',
  },
  {
    source: 'uniprot',
    externalId: 'A0A0H3JR41',
    title: 'Uncharacterized small protein from Bacillus subtilis',
    summary:
      'Predicted 42-aa protein, no functional annotation, conserved across Bacillus species. Genome context places it adjacent to a stress-response operon, but no experimental characterization.',
  },
  {
    source: 'europepmc',
    externalId: 'PMC9876543',
    title: 'Small open reading frames in microbial dark matter',
    summary:
      'Review of approaches to mine small ORFs in metagenomes. Argues that sub-100-aa proteins remain systematically undercounted and that targeted searches in understudied genomes regularly reveal novel candidates.',
  },
];

async function main() {
  for (const e of SEED) {
    const embedding = await embedClaim(`${e.title}. ${e.summary}`);
    const v = sql.raw(`'[${embedding.join(',')}]'::vector`);
    await db
      .insert(schema.corpusEntries)
      .values({
        source: e.source,
        externalId: e.externalId,
        title: e.title,
        summary: e.summary,
        embedding: sql`${v}` as unknown as number[],
      })
      .onConflictDoUpdate({
        target: [schema.corpusEntries.source, schema.corpusEntries.externalId],
        set: { title: e.title, summary: e.summary, embedding: sql`${v}` as unknown as number[] },
      });
    console.log(`ingested ${e.source}:${e.externalId}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
