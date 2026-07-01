# Getting started

## Prerequisites

- **Node 24 LTS** (Vercel default)
- **pnpm 9+** (`npm i -g pnpm`)
- **Vercel CLI** (`npm i -g vercel`) — required for `vercel env pull`, `vercel deploy`, `vercel sandbox`
- **Inngest CLI** (`npm i -g inngest-cli`) for local dev of the pipeline
- A **Postgres database with pgvector** — provision via Vercel Marketplace (Neon recommended)

## 1. Install

```bash
pnpm install
```

## 2. Configure environment

```bash
cp .env.example .env.local

# Authenticate to Vercel and pull production env into your local
vercel link
vercel env pull
```

Required at minimum:
- `DATABASE_URL` (with pgvector extension available)
- `AI_GATEWAY_API_KEY` (from Vercel AI Gateway dashboard)
- `BETTER_AUTH_SECRET` (`openssl rand -hex 32`)

Recommended for full functionality:
- `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` for durable pipelines
- `UPSTASH_REDIS_REST_URL` + token for rate limiting and realtime
- `RESEND_API_KEY` for email notifications
- `SENTRY_DSN`, `POSTHOG_API_KEY` for observability

## 3. Database

```bash
# Generate migration from Drizzle schema
pnpm db:generate

# Push to your DB (uses DATABASE_URL)
pnpm db:push

# Create HNSW indexes for vector search (one-shot)
psql "$DATABASE_URL" -f drizzle/0001_pgvector_indexes.sql
```

## 4. Seed

```bash
pnpm tsx scripts/seed-protocols.ts
pnpm tsx scripts/ingest-reference-corpus.ts
```

## 5. Run

You need **three** terminals locally:

```bash
# Terminal 1 — Next.js
pnpm dev

# Terminal 2 — Inngest dev server (durable pipeline UI at http://localhost:8288)
pnpm dev:inngest

# Terminal 3 — MCP server (optional, for Claude Code integration)
pnpm mcp:dev
```

Visit http://localhost:3000.

## 6. End-to-end loop

1. Sign in (GitHub OAuth, magic link, or seeded demo user via `?demoSession=demo-contributor` in dev)
2. **Experiments → Small ORF Mining**
3. Paste a bacterial genome slice (download a FASTA from [NCBI Datasets](https://www.ncbi.nlm.nih.gov/datasets/genome/))
4. Choose runner — **TypeScript** (instant) or **Python (Pyodide)** (downloads ~7MB on first use, runs the reference Python implementation in your browser)
5. Click **Run protocol locally** → see hits + output hash
6. Click **Submit to the discovery engine**
7. Open http://localhost:8288 to watch Inngest replay the pipeline step-by-step
8. Live discoveries appear in the right-side feed on the homepage and `/discoveries`

## 7. MCP server — let Claude Code contribute

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "opendiscover": {
      "command": "pnpm",
      "args": ["--prefix", "/abs/path/to/this/repo", "mcp:dev"]
    }
  }
}
```

Or use the HTTP transport at `https://<your-deploy>.vercel.app/api/mcp`.

Tools available to agents:
- `list_protocols` · `get_protocol`
- `run_protocol` · `submit_result`
- `browse_discoveries` · `get_discovery`

## 8. Deploy

```bash
vercel deploy --prod
```

The first deploy will:
1. Detect Next.js, build with Turbopack
2. Provision Fluid Compute functions in fra1 + iad1
3. Register cron jobs from `vercel.ts`
4. Enable Rolling Releases on `/api/submissions` and `/api/inngest`
5. Apply BotID to sensitive paths

After deploy, in the Vercel dashboard:
- **Storage** → install your Postgres provider, copy `DATABASE_URL` into Production env
- **Integrations** → install **Inngest** integration
- **AI** → enable **AI Gateway**, copy `AI_GATEWAY_API_KEY` into env

## Architecture summary

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...all]/route.ts        Better Auth handler
│   │   ├── submissions/route.ts          Submission intake (auth + RL + BotID)
│   │   ├── inngest/route.ts              Inngest webhook
│   │   ├── mcp/route.ts                  MCP HTTP transport
│   │   ├── realtime/discoveries/route.ts SSE live feed
│   │   └── cron/*                        Promote, replicate-canary, refresh-corpus
│   ├── discoveries/                      Feed + detail (with Vega-Lite + Mol*)
│   ├── experiments/                      Catalog + runner (TS/Pyodide)
│   └── page.tsx                          Landing
├── components/
│   ├── ui/                               shadcn primitives (Button, Card, Badge, Progress)
│   └── discovery/                        MoleculeViewer (Mol*), LiveDiscoveryFeed (SSE)
├── lib/
│   ├── ai/
│   │   ├── agents/novelty-agent.ts       Opus 4.7 agent + tool use
│   │   ├── tools/                        Europe PMC, UniProt, internal corpus tools
│   │   ├── triage.ts                     Haiku 4.5 noise filter
│   │   ├── vulgarize.ts                  Sonnet 4.6 card + Vega-Lite generator
│   │   ├── embeddings.ts                 text-embedding-3-large via gateway
│   │   ├── novelty.ts                    Composite scoring
│   │   └── pattern-detect.ts             Embedding-based corroboration clustering
│   ├── auth/                             Better Auth setup
│   ├── db/                               Drizzle schema + pgvector queries
│   ├── inngest/                          Durable workflow functions
│   ├── mcp/                              MCP server (stdio + HTTP transports)
│   ├── realtime/                         Upstash Redis pub/sub
│   ├── sandbox/                          Vercel Sandbox protocol runner
│   ├── science/
│   │   ├── protocols/                    Deterministic protocols (TS + Python parity)
│   │   └── runners/                      Dispatch + Pyodide-browser
│   ├── security/                         Rate limiting
│   └── util/                             Canonical hashing
├── middleware.ts                         BotID + request-ID
└── instrumentation.ts                    OpenTelemetry + Sentry
```
