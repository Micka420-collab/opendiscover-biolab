-- Run after the initial schema push.
-- HNSW indexes give sub-10ms cosine kNN at our expected scale.

CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- HNSW is preferred over IVFFlat for incrementally growing datasets
-- because it does not need periodic re-clustering.
CREATE INDEX IF NOT EXISTS submissions_embedding_hnsw
  ON submissions
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS corpus_embedding_hnsw
  ON corpus_entries
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
