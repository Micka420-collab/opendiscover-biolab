<div align="center">

# 🧬 OpenDiscover BioLab

### An autonomous in-silico biotechnology laboratory

**Deterministic simulation engines + AI scientist agents + a citizen-science discovery pipeline — in one reproducible, open platform.**

[![CI](https://github.com/Micka420-collab/opendiscover-biolab/actions/workflows/ci.yml/badge.svg)](https://github.com/Micka420-collab/opendiscover-biolab/actions)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![License](https://img.shields.io/badge/code-MIT-green)
![Data](https://img.shields.io/badge/data-CC--BY%204.0-orange)

</div>

---

## What this is

OpenDiscover BioLab is a **virtual biotechnology laboratory** you can run in a browser and drive with AI. It has three layers that build on each other:

1. **A library of deterministic simulation engines** covering the breadth of computational biology — molecular biology, protein biophysics, systems biology, population genetics, bioprocess engineering, epidemiology, and drug discovery. Every engine is a *pure function*: no clock, no network, no unseeded randomness. Same inputs → same outputs → same content hash, on every machine.

2. **Autonomous AI scientist agents** that use those engines as instruments. Given a research goal, an agent forms a falsifiable hypothesis, designs and runs parameter-swept experiments, reads the numbers, iterates, and writes up an honest report — journalling every step in a transparent lab notebook.

3. **A citizen-science discovery pipeline** (the original OpenDiscover engine) that screens, scores, and vulgarizes promising results into shareable Discovery Cards, with peer review, canary replication, and open archival.

> **The core idea:** because every experiment is deterministic and hashed, an AI-run experiment is exactly as reproducible and trustworthy as a human-run one. That is what lets a *swarm* of autonomous agents systematically explore biology at a throughput no wet lab can match — without giving up rigor.

---

## The simulation engines

Each engine ships with a Zod-validated parameter schema, a worked example, literature references, and a test suite that checks its output against **known analytical or textbook values** — not just "it runs".

| Domain | Engine | What it models |
|---|---|---|
| 🧫 Molecular biology | `sequence` | DNA/RNA/protein: transcription, translation (full genetic code), GC%, Tm, ORF finding |
| | `pcr` | In-silico PCR, amplicon prediction, primer design, dimer/hairpin checks |
| | `cloning` | Restriction digest (12+ enzymes), fragment/overhang prediction, Gibson assembly |
| | `crispr` | Guide RNA design, PAM finding (SpCas9/Cas12a), on-target & off-target scoring |
| 🧬 Protein biophysics | `properties` | MW, theoretical pI, GRAVY, instability index, extinction coefficient |
| | `secondary-structure` | Chou–Fasman helix/sheet/coil prediction |
| | `hp-folding` | HP lattice-model folding via seeded Monte-Carlo energy minimization |
| ⚙️ Systems biology | `enzyme-kinetics` | Michaelis–Menten, competitive/non-competitive inhibition, Hill cooperativity |
| | `grn` | Gene regulatory networks: repressilator, toggle switch, feed-forward loops |
| | `gillespie` | Exact stochastic simulation (SSA) of the chemical master equation |
| | `fba` | Flux balance analysis via a built-in linear-programming solver |
| 🌱 Population genetics | `wright-fisher` | Genetic drift, selection, mutation, fixation probability |
| | `phylogenetics` | Distance models (JC/K2P), Neighbor-Joining & UPGMA trees, Newick output |
| 🏭 Bioprocess | `bioreactor` | Monod growth: batch, fed-batch, and chemostat/CSTR dynamics |
| 🦠 Epidemiology | `compartmental` | SIR / SEIR / SIRD, R₀, herd-immunity threshold, final epidemic size |
| 💊 Drug discovery | `admet` | Lipinski/Veber/Ghose rules, QED drug-likeness, SMILES property parsing |
| | `dose-response` | Hill dose–response, IC₅₀/EC₅₀ fitting, drug-combination indices |
| 🔬 Structural | `rna-fold` | RNA secondary structure via the Nussinov DP algorithm |

> Full catalog with parameters and references: [`SIMULATION_ENGINES.md`](./SIMULATION_ENGINES.md).

Every engine also has an interactive playground at `/lab/<slug>` — a parameter form generated straight from its Zod schema (typed number/enum/boolean controls, JSON fallback for nested params), wired to `/api/lab/run`, rendering metrics, Vega-Lite charts, and the reproducibility hash.

---

## The autonomous scientist

```ts
import { runCampaign } from '@/lib/lab/scientist';

const outcome = await runCampaign({
  goal: 'Find a chemostat dilution rate that maximizes steady-state product '
      + 'productivity for a Monod organism with µmax=0.9/h, Ks=0.2 g/L.',
  engineScope: ['bioreactor'],
  runBudget: 20,
});

console.log(outcome.report.conclusion);
console.log(outcome.notebookMarkdown); // full transparent reasoning trail
```

The agent (Claude Opus, via the Vercel AI Gateway) works through a **contained tool set** — `list_engines`, `describe_engine`, `run_experiment`, `run_sweep`, `record_finding`. It never touches an engine directly, so every action it takes is a hashed, replayable experiment recorded in the notebook. Its final output is a structured report: hypothesis, evidence-backed findings, surprises, an honest conclusion, and suggested follow-ups.

---

## Architecture

```
Browser / Agent / MCP client
        │  (Pyodide · Mol* · Vega-Lite · React Three Fiber)
        ▼
Vercel Edge — BotID · rate limit · request-ID
        ▼
Vercel Functions (Fluid Compute)
   /lab/*             → catalog + interactive engine playground (Vega-Lite)
   /api/lab/*         → run engines, launch campaigns
   /api/submissions   → citizen-science discovery pipeline
   /api/mcp           → agents contribute through the same gates
        ▼
┌──────────────────────┬───────────────────────┬────────────────────┐
│ sim/  engines        │ lab/  autonomous       │ Inngest durable    │
│ (pure, deterministic)│ scientist + campaigns  │ discovery pipeline │
└──────────┬───────────┴───────────┬───────────┴─────────┬──────────┘
           ▼                       ▼                     ▼
   Postgres + pgvector     Vercel AI Gateway      Vercel Sandbox
   (Drizzle, HNSW kNN)     (Opus/Sonnet/Haiku)    (canary replication)
```

Deeper dive: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Drizzle ORM + Postgres/pgvector · Inngest · Vercel AI SDK v6 + AI Gateway · Vercel Sandbox · Better Auth · Upstash Redis (SSE) · Mol* · Vega-Lite · Biome · Vitest · Playwright.

---

## Quick start

```bash
pnpm install

# 1. Run the simulation engines — no secrets, no database needed
pnpm test                       # every engine, checked against known values

# 2. Full platform (discovery pipeline + lab UI)
cp .env.example .env.local      # fill in DATABASE_URL + AI Gateway key
pnpm db:push                    # push schema to Postgres
pnpm dev                        # Next.js + Inngest dev server
```

The engines have **zero runtime dependencies** on secrets — you can `import` and run any of them, or `pnpm test`, immediately after install. The AI scientist and discovery pipeline need the AI Gateway + Postgres configured.

---

## Why deterministic?

Reproducibility is the whole thesis. Every engine run is canonically hashed (stable key order, no whitespace). Re-running the same engine with the same params anywhere reproduces the same `outputHash`. This means:

- **AI experiments are auditable** — the notebook records exactly what was run; anyone can replicate it.
- **Canary replication works** — a promoted result is automatically re-run in an isolated Vercel Sandbox; a hash mismatch flags the engine.
- **Stochastic models stay reproducible** — every random draw comes from a seeded PRNG (`sim/core/prng`), never `Math.random()`.

---

## Contributing

New engines are welcome — a good engine is pure, documented, and tested against a known result. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and the [engine authoring guide](./SIMULATION_ENGINES.md#authoring-an-engine).

## Safety

In-silico results are **models, not clinical or applied claims**. Submissions pass a two-layer dual-use screen. See [`SECURITY.md`](./SECURITY.md).

## License

- **Code:** MIT
- **Data, protocols, discoveries:** CC-BY 4.0
