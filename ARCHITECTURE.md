# Architecture — OpenDiscover v0.2

## 0. TL;DR

```
            ┌────────────────────────────────────────────────────────────┐
            │           Browser / Agent / MCP client                    │
            │   Pyodide-WASM  ─  Mol* viewer  ─  Vega-Lite               │
            └───────────────────────────┬────────────────────────────────┘
                                        │ HTTPS/SSE/MCP
              ┌─────────────────────────▼──────────────────────────────┐
              │   Vercel Edge (Routing Middleware)                     │
              │   BotID · rate limit · request-ID                       │
              └─────────────────────────┬──────────────────────────────┘
                                        │
              ┌─────────────────────────▼──────────────────────────────┐
              │   Vercel Functions (Fluid Compute, fra1+iad1)          │
              │                                                         │
              │  /api/submissions  /api/auth/*  /api/mcp                │
              │  /api/realtime/discoveries  /api/cron/*                 │
              │  /api/inngest (webhook) ────────────────────────┐       │
              └─────────────────────────────────────────────────┼───────┘
                                                                │
                              ┌─────────────────────────────────▼─────────┐
                              │              INNGEST                       │
                              │  Durable, replayable, traced workflows     │
                              │                                            │
                              │  • process-submission                      │
                              │    1. triage      (Haiku 4.5)              │
                              │    2. embed       (text-embedding-3-large) │
                              │    3. cluster     (pgvector kNN + DBSCAN)  │
                              │    4. corpus kNN  (pgvector + HNSW)        │
                              │    5. novelty     (Opus 4.8 agent w/ tools)│
                              │    6. promotion gate                       │
                              │    7. card + viz  (Sonnet 5, parallel)     │
                              │    8. persist + emit "discovery/promoted"  │
                              │                                            │
                              │  • notify-discovery (email + SSE)          │
                              │  • canary-replicate (Vercel Sandbox)       │
                              │  • recheck-corroboration                   │
                              └────────────────────┬───────────────────────┘
                                                   │
                       ┌───────────────────────────┴───────────────────────┐
                       ▼                       ▼                            ▼
              ┌────────────────┐    ┌───────────────────┐         ┌────────────────┐
              │  Postgres +    │    │  Upstash Redis    │         │ Vercel Sandbox │
              │  pgvector +    │    │  pub/sub + RL     │         │  (Python 3.13) │
              │  HNSW          │    └───────────────────┘         │  for canary    │
              │  (Drizzle)     │                                   │  replication   │
              └────────────────┘                                   └────────────────┘
                       ▲
                       │
              ┌────────┴────────┐
              │ Vercel AI       │
              │ Gateway         │
              │ (Opus/Sonnet/   │
              │  Haiku/Embed)   │
              │ + Europe PMC,   │
              │ UniProt tools   │
              └─────────────────┘
```

## 1. Why this stack

| Choice | Rationale |
|---|---|
| **Next.js 15 App Router + Turbopack** | Single repo, RSC for streaming the discovery feed, server actions for low-ceremony mutations |
| **Drizzle ORM + postgres.js + pgvector** | Native HNSW indexes, edge-runtime compatible, ~10× faster cold start than Prisma, typed joins |
| **Vercel AI Gateway** | Single auth + observability layer for Claude Opus/Sonnet/Haiku + OpenAI embeddings. Swap models without code changes. Built-in retries, fallbacks, zero-retention. |
| **AI SDK v6 Agents (`Experimental_Agent`)** | The novelty step is not a single LLM call — it's a real reasoning loop that decides when to search internal corpus vs reach for live UniProt/Europe PMC. |
| **Inngest** | The pipeline has expensive, retryable, individually-traced steps. Inngest persists state so we can resume after a crash, replay a step after a prompt change, and inspect every run in a dashboard. |
| **Vercel Sandbox** | Canary replication runs the protocol again in isolation to enforce determinism. Sandbox provides a network-disabled Python env that cold-starts in ~200ms. |
| **Pyodide** | Lets contributors run the *exact reference Python* in their browser. Same bytes, same hash, same result as Sandbox. No "trust me, the JS port is equivalent" — it's verifiable. |
| **Mol\*** | Industry-standard 3D molecular viewer. Embedded directly in Discovery Cards when the underlying observation involves a protein. |
| **Better Auth** | First-class GitHub + magic link + plug-in OAuth (ORCID, Sign in with Vercel). Drizzle adapter, no Prisma dependency. |
| **MCP server** | Lets external agents (Claude Code, Cursor) contribute alongside humans through the same validation gates. |
| **Upstash Redis** | Rate limiting + SSE pub/sub. REST API works in edge runtime. |
| **OpenTelemetry + Sentry + PostHog** | End-to-end tracing across HTTP → Drizzle → AI Gateway → Inngest steps. PostHog captures product events. Sentry catches uncaught. |
| **BotID** | First-party Vercel bot detection — keeps the LLM-bill-burning bots off submissions. |
| **Biome** | One tool for lint + format, 10× faster than ESLint + Prettier on this scale. |
| **Playwright** | E2E for the critical "submit and see a Discovery Card" flow. |

## 2. The novelty agent — why it's better than a single LLM call

A single-shot LLM call ("is this novel?") has two well-known failure modes:
1. It anchors on the model's training-set knowledge cutoff (stale).
2. It produces plausible-looking but unverifiable reasoning.

Our novelty step is a **bounded agentic loop** (max 6 steps):

```ts
const noveltyAgent = new Agent({
  model: 'anthropic/claude-opus-4-8',
  tools: { search_internal_corpus, search_uniprot, search_europe_pmc },
  stopWhen: stepCountIs(6),
});
```

The agent is *instructed* to:
1. Always start with cheap internal-corpus search.
2. Broaden to live UniProt / Europe PMC if results look weak.
3. **Cite specific homologs / DOIs** for any overlap claim.
4. Return novelty=false if a single neighbor materially covers the claim.

Composite score:
```
novelty = 0.4 · (1 − max_corpus_similarity)
        + 0.3 · min(1, corroborations / 4)
        + 0.3 · (judgment.novel ? confidence : 1 − confidence)
```

Promotion requires all three: `novelty ≥ 0.75` AND `≥ 2 independent disjoint corroborators` AND `triage interesting`.

## 3. Determinism enforcement

The whole "did the community find something real?" guarantee rests on determinism:
- Every protocol's runner is pure: no time, no random, no network.
- Output is **canonically hashed** before submission (stable key order, no whitespace).
- The server **recomputes** the hash and rejects mismatches.
- Every promoted Discovery triggers a **canary replication** in Vercel Sandbox, re-running the protocol on the same input slice. If the hash differs, the protocol is automatically demoted to `restricted` and its discoveries are flagged.

## 4. The MCP layer

OpenDiscover exposes itself as an MCP server. External agents see:
- `list_protocols` / `get_protocol`
- `run_protocol` / `submit_result`
- `browse_discoveries` / `get_discovery`

This means **AI agents are first-class contributors**. They're subject to the same triage, corroboration, and novelty gates as humans. A swarm of agents systematically scanning understudied genomes could yield a 10× throughput multiplier without compromising the gating model.

## 5. Realtime feed

Promoted Discoveries fan out via:
1. `step.sendEvent('discovery/promoted', …)` in the pipeline
2. `notify-discovery` Inngest function publishes to Upstash pub/sub
3. SSE endpoint `/api/realtime/discoveries` streams to all open clients
4. `<LiveDiscoveryFeed />` (client component) prepends to the list

Total latency from submission to feed update: ~10–25s under typical AI Gateway response times.

## 6. Multi-region

- All Functions deploy to `fra1` + `iad1` for low-latency submissions globally.
- Crons pinned to `iad1` to avoid duplicate fires.
- Postgres is single-region (Neon's primary); pgvector kNN is fast enough that read replicas aren't needed at MVP scale.
- Inngest fan-out is multi-region by default.

## 7. Cost model

Per submission, all-in (LLM + DB + compute), at our model routing:
- Haiku triage: ~$0.001
- Embedding: ~$0.0001 (cached 24h on identical claim summaries)
- Opus agent (avg 3 tool calls, ~5k input tokens cached): ~$0.015
- Sonnet card + viz (only if promoted): ~$0.005
- Sandbox canary (only if promoted, ~5s): ~$0.003

**~$0.02 per submission**, mostly absorbed by the Opus step. Strict promotion gating keeps Sonnet + Sandbox out of the critical path. Prompt caching on the static system prompts cuts another ~30% in practice.

## 8. What's intentionally NOT here yet

- **ORCID OAuth flow** — Better Auth scaffolding is in place; the OAuth client registration with ORCID's app gateway is a deploy-time step, not a code one.
- **Zenodo DOI minting** — triggered when a Discovery moves to `confirmed`. The hook point is in `discovery/peer-review` handling; the Zenodo API call itself is one HTTP request.
- **Federated peer review** — endorsement weights exist in schema, the social UI for the trail does not.
- **More protocols** — `codon-bias-hgt-v1`, `motif-conservation-v1`, `alphafold-structural-mining-v1` listed in PROTOCOLS.md.
