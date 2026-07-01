import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
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
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
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
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
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
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
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
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    contributorId: text('contributor_id')
      .notNull()
      .references(() => users.id),
    protocolId: text('protocol_id')
      .notNull()
      .references(() => protocols.id),
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
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id),
    protocolId: text('protocol_id')
      .notNull()
      .references(() => protocols.id),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    cardMarkdown: text('card_markdown').notNull(),
    visualizationSpec: jsonb('visualization_spec').notNull(),
    structureSpec: jsonb('structure_spec'), // optional Mol*/3D scene
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
    discoveryId: text('discovery_id')
      .notNull()
      .references(() => discoveries.id, { onDelete: 'cascade' }),
    submissionId: text('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
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
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    reviewerId: text('reviewer_id')
      .notNull()
      .references(() => users.id),
    discoveryId: text('discovery_id')
      .notNull()
      .references(() => discoveries.id, { onDelete: 'cascade' }),
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
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
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
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    submissionId: text('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
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

/* ═══════════════════════════════════════════════════════════════════════
 *  BioLab — autonomous in-silico laboratory
 *
 *  The lab turns the deterministic simulation engines (src/lib/sim) into a
 *  research instrument: AI scientist agents run parameter-swept experiments
 *  inside research campaigns, journal their reasoning in a lab notebook, and
 *  surface promising results into the existing discovery pipeline.
 * ═════════════════════════════════════════════════════════════════════ */

export const campaignStatusEnum = pgEnum('campaign_status', [
  'planning',
  'running',
  'paused',
  'completed',
  'failed',
  'aborted',
]);

export const notebookKindEnum = pgEnum('notebook_kind', [
  'hypothesis',
  'plan',
  'experiment',
  'observation',
  'analysis',
  'conclusion',
  'error',
]);

/** A research campaign: a goal an autonomous scientist agent pursues via many experiments. */
export const campaigns = pgTable(
  'campaigns',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerId: text('owner_id').references(() => users.id),
    title: text('title').notNull(),
    goal: text('goal').notNull(),
    hypothesis: text('hypothesis'),
    /** Which simulation engines the agent is allowed to reach for. */
    engineScope: jsonb('engine_scope').notNull(),
    /** Configuration: model, max experiments, seed budget, stop conditions. */
    config: jsonb('config').notNull(),
    status: campaignStatusEnum('status').default('planning').notNull(),
    /** Rolling agent-authored synthesis of what has been learned so far. */
    findings: text('findings'),
    experimentCount: integer('experiment_count').default(0).notNull(),
    bestScore: doublePrecision('best_score'),
    /** 'human' | 'agent:<model>' — who is driving. */
    driver: text('driver').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
  },
  (t) => ({
    byStatus: index('campaigns_status_idx').on(t.status, t.createdAt),
    byOwner: index('campaigns_owner_idx').on(t.ownerId),
  }),
);

/** One deterministic engine run inside (or outside) a campaign. */
export const experiments = pgTable(
  'experiments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: text('campaign_id').references(() => campaigns.id, { onDelete: 'cascade' }),
    authorId: text('author_id').references(() => users.id),
    engine: text('engine').notNull(),
    engineVersion: text('engine_version').notNull(),
    params: jsonb('params').notNull(),
    /** Canonical hash of {engine, version, params} — dedupes & enables replication. */
    inputHash: text('input_hash').notNull(),
    /** Canonical hash of the SimResult — the reproducibility fingerprint. */
    outputHash: text('output_hash').notNull(),
    summary: text('summary').notNull(),
    metrics: jsonb('metrics').notNull(),
    result: jsonb('result').notNull(),
    /** Agent- or heuristic-assigned interestingness in [0,1]. */
    score: doublePrecision('score'),
    seed: text('seed'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    byCampaign: index('experiments_campaign_idx').on(t.campaignId, t.createdAt),
    byEngine: index('experiments_engine_idx').on(t.engine),
    byInputHash: index('experiments_input_hash_idx').on(t.inputHash),
    byScore: index('experiments_score_idx').on(t.score),
  }),
);

/** The lab notebook — the agent's transparent, append-only reasoning trail. */
export const notebookEntries = pgTable(
  'notebook_entries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    experimentId: text('experiment_id').references(() => experiments.id, { onDelete: 'set null' }),
    seq: integer('seq').notNull(),
    kind: notebookKindEnum('kind').notNull(),
    content: text('content').notNull(),
    data: jsonb('data'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    byCampaign: index('notebook_campaign_seq_idx').on(t.campaignId, t.seq),
  }),
);

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type Experiment = typeof experiments.$inferSelect;
export type NewExperiment = typeof experiments.$inferInsert;
export type NotebookEntry = typeof notebookEntries.$inferSelect;
export type NewNotebookEntry = typeof notebookEntries.$inferInsert;
