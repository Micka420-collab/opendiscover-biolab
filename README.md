# OpenDiscover — Citizen Science Discovery Engine

**Vision.** A community platform where amateurs, students, and researchers run accessible in-silico experiments on public biological data, and an AI-driven engine detects, scores, and vulgarizes potential discoveries in real time.

We don't vulgarize existing science. We vulgarize what the community **just discovered**.

## How it works

1. **Pick a protocol** — short, reproducible experiments on public datasets (NCBI, UniProt, AlphaFold). Protocols are versioned TypeScript modules that run via Pyodide or Vercel Sandbox.
2. **Run it** — the protocol executes in-browser (Pyodide) or in a Vercel Sandbox for isolation. You see your raw result immediately.
3. **Submit** — your result is safety-screened (keyword + embedding-based dual-use filter) and joins the aggregated corpus.
4. **The engine watches** — Inngest durable workflows handle triage, embedding, clustering, and novelty scoring continuously and reliably.
5. **A signal emerges** — when a result (or aggregate) crosses the novelty threshold, a **Discovery Card** is auto-generated in your name and broadcast via SSE live feed.
6. **The community validates** — peer review, canary replication, and provenance tracking confirm or dispute the discovery.
7. **It's archived openly** — DOI minted via Zenodo, CC-BY data, MIT code, full submission lineage on-chain.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Database | Postgres + pgvector with HNSW kNN indexes via Drizzle ORM |
| Workflows | Inngest durable functions (triage → embed → cluster → score → promote) |
| AI | Vercel AI Gateway — Claude Opus 4.7 (novelty), Sonnet 4.6 (vulgarization), Haiku 4.5 (triage) |
| UI | Radix UI primitives + CVA + Tailwind |
| Auth | Better Auth — GitHub OAuth + magic link |
| Realtime | Upstash Redis + SSE live discovery feed |
| Protocols | TypeScript + Pyodide + Vercel Sandbox |
| Safety | Dual-use screen — keyword blocklist + embedding similarity |
| DOI minting | Zenodo REST API |
| MCP server | For AI agent contributions |

## Quick start

```bash
pnpm install

# Copy and fill in secrets
cp .env.example .env.local

# Push schema to your Postgres instance
pnpm db:push

# Start the dev server (also starts Inngest Dev Server)
pnpm dev
```

## License

- Code: MIT
- Data, protocols, discoveries: CC-BY 4.0
