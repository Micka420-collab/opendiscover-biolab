/**
 * Drizzle schema — Postgres + pgvector (native column type via custom helper).
 *
 * Why Drizzle over Prisma:
 *  - Native pgvector + ivfflat / hnsw indexes declared in the schema (no raw SQL).
 *  - Edge-runtime compatible (works in Vercel Functions on Fluid Compute without
 *    bundling a heavy Rust engine).
 *  - Type-safe joins, no client generation step, sub-millisecond cold start.
 *  - Direct relational queries with full inference.
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  real,
  doublePrecision,
  timestamp,
  jsonb,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  customType,
  primaryKey,
} from 'drizzle-orm/pg-core';

/* ─── Custom vector type ─────────────────────────────────────────────── */

const vector = (dim: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType: () => `vector(${dim})`,
    toDriver: (v) => `[${v.join(',')}]`,
    fromDriver: (s) => s.slice(1, -1).split(',').map(Number),
  });

const vec3072 = vector(3072);

/* ─── Enums ──────────────────────────────────────────────────────────── */

export const protocolStatusEnum = pgEnum('protocol_status', [
  'draft',
  'active',
  'restricted',
  'deprecated',
]);

export const submissionStatusEnum = pgEnum('submission_status', [
  'pending',
  'triaged_noise',
  'triaged_interesting',
  'promoted',
  'rejected',
]);

export const discoveryStatusEnum = pgEnum('discovery_status', [
  'provisional',
  'under_review',
  'confirmed',
  'disputed',
  'refuted',
  'retracted',
]);

export const reviewActionEnum = pgEnum('review_action', [
  'replicate',
  'endorse',
  'challenge',
  'annotate',
  'retract',
]);

/* ─── Contributors / accounts ────────────────────────────────────────── */

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  handle: text('handle').notNull().unique(),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  name: text('name'),
  image: text('image'),
  orcid: text('orcid').unique(),
  reputation: doublePrecision('reputation').default(1.0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  providerId: text('provider_id').notNull(),
  accountId: text('account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/* ─── Protocols ──────────────────────────────────────────────────────── */

export const protocols = pgTable(
  'protocols',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    slug: text('slug').notNull(),
    version: integer('version').default(1).notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    domain: text('domain').notNull(),
    inputSchema: jsonb('input_schema').notNull(),
    outputSchema: jsonb('output_schema').notNull(),
    runnerKind: text('runner_kind').notNull(), // 'js' | 'wasm' | 'pyodide' | 'sandbox'
    runnerModule: text('runner_module').notNull(),
    contentHash: text('content_hash').notNull().unique(),
    noveltyConfig: jsonb('novelty_config').notNull(),
    status: protocolStatusEnum('status').default('draft').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    slugVersion: uniqueIndex('protocols_slug_version_idx').on(t.slug, t.version),
  }),
);

/* ─── Submissions ────────────────────────────────────────────────────── */

export const submissions = pgTable(
  'submissions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    contributorId: text('contributor_id').notNull().references(() => users.id),
    protocolId: text('protocol_id').notNull().references(() => protocols.id),
    protocolVersion: integer('protocol_version').notNull(),
    inputSlice: jsonb('input_slice').notNull(),
    sliceKey: text('slice_key').notNull(),
    rawOutput: jsonb('raw_output').notNull(),
    outputHash: text('output_hash').notNull(),
    embedding: vec3072('embedding'),
    claimSummary: text('claim_summary'),
    triageScore: real('triage_score'),
    noveltyScore: real('novelty_score'),
    status: submissionStatusEnum('status').default('pending').notNull(),
    rejectionReason: text('rejection_reason'),
    runnerVersion: text('runner_version'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
  },
  (t) => ({
    byProtocolTime: index('submissions_protocol_time_idx').on(t.protocolId, t.createdAt),
    byHash: index('submissions_hash_idx').on(t.outputHash),
    byStatus: index('submissions_status_idx').on(t.status),
    bySlice: index('submissions_slice_idx').on(t.protocolId, t.sliceKey),
    // pgvector index (created in migration SQL — Drizzle can't yet declare HNSW ops)
  }),
);

/* ─── Discoveries ────────────────────────────────────────────────────── */

export const discoveries = pgTable(
  'discoveries',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    authorId: text('author_id').notNull().references(() => users.id),
    protocolId: text('protocol_id').notNull().references(() => protocols.id),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    cardMarkdown: text('card_markdown').notNull(),
    visualizationSpec: jsonb('visualization_spec').notNull(),
    structureSpec: jsonb('structure_spec'),                       // optional Mol*/3D scene
    rawData: jsonb('raw_data').notNull(),
    noveltyScore: real('novelty_score').notNull(),
    noveltyReasoning: text('novelty_reasoning').notNull(),
    citations: jsonb('citations').notNull(),
    canaryReplicated: boolean('canary_replicated').default(false).notNull(),
    status: discoveryStatusEnum('status').default('provisional').notNull(),
    doi: text('doi').unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    promotedAt: timestamp('promoted_at'),
    confirmedAt: timestamp('confirmed_at'),
  },
  (t) => ({
    byStatus: index('discoveries_status_idx').on(t.status, t.createdAt),
    byNovelty: index('discoveries_novelty_idx').on(t.noveltyScore),
  }),
);

/* ─── Many-to-many: submissions ↔ discoveries ────────────────────────── */

export const discoveryTriggers = pgTable(
  'discovery_triggers',
  {
    discoveryId: text('discovery_id').notNull().references(() => discoveries.id, { onDelete: 'cascade' }),
    submissionId: text('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'trigger' | 'corroboration'
    weight: real('weight').default(1.0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.discoveryId, t.submissionId] }),
    byDiscovery: index('dt_discovery_idx').on(t.discoveryId),
    bySubmission: index('dt_submission_idx').on(t.submissionId),
  }),
);

/* ─── Peer review trail ──────────────────────────────────────────────── */

export const peerReviews = pgTable(
  'peer_reviews',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    reviewerId: text('reviewer_id').notNull().references(() => users.id),
    discoveryId: text('discovery_id').notNull().references(() => discoveries.id, { onDelete: 'cascade' }),
    action: reviewActionEnum('action').notNull(),
    payload: jsonb('payload').notNull(),
    weight: real('weight').default(1.0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    byDiscovery: index('pr_discovery_idx').on(t.discoveryId),
  }),
);

/* ─── Reference corpus for novelty grounding ─────────────────────────── */

export const corpusEntries = pgTable(
  'corpus_entries',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata'),
    embedding: vec3072('embedding'),
    ingestedAt: timestamp('ingested_at').defaultNow().notNull(),
  },
  (t) => ({
    bySource: uniqueIndex('corpus_source_external_idx').on(t.source, t.externalId),
  }),
);

/* ─── Inngest workflow state (for audit/inspection) ──────────────────── */

export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    submissionId: text('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
    runId: text('run_id').notNull().unique(),
    stage: text('stage').notNull(),
    status: text('status').notNull(),
    durationMs: integer('duration_ms'),
    error: text('error'),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    bySubmission: index('pr_submission_idx').on(t.submissionId),
  }),
);

/* ─── Type exports ──────────────────────────────────────────────────── */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Protocol = typeof protocols.$inferSelect;
export type NewProtocol = typeof protocols.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type Discovery = typeof discoveries.$inferSelect;
export type NewDiscovery = typeof discoveries.$inferInsert;
export type CorpusEntry = typeof corpusEntries.$inferSelect;
export type PeerReview = typeof peerReviews.$inferSelect;
