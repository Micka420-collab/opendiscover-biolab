# Roadmap — OpenDiscover BioLab

## 🧬 BioLab backlog (autonomous build queue)

This is the live queue the autonomous heartbeat works through. Each item must land
with `pnpm typecheck`, `pnpm test`, and `pnpm lint` all green, then be committed + pushed.

### Done
- [x] Deterministic simulation core (PRNG, ODE RK4/RK45, linalg) — 14 tests
- [x] 18 simulation engines across 7 domains — 422 tests, all vs known values
- [x] Engine registry + kernel (validate/run/provenance by slug)
- [x] Autonomous lab: runner, sweep, notebook, AI-SDK tools, `runCampaign`
- [x] DB schema: campaigns / experiments / notebook_entries + queries
- [x] Green build: 437 tests, tsc clean, biome clean; CI `engines` job

### Next (priority order)
- [x] **Breeding / genetic-crossing engine** — `sim/genetics/breeding.ts`: generalised Punnett
      distributions, complete/incomplete/codominant dominance (3:1, 9:3:3:1, 1:2:1), two-locus
      linkage + recombination, seeded offspring sampling. 11 tests vs classical ratios.
- [x] **Breeding game UI** — `/lab/breeding`: pick two Glowzoa specimens, cross them, reveal
      offspring cards with rarity tiers, and fill a "phenotype dex" of discovered traits.
      Featured on `/lab`. Game rules unit-tested (`lib/lab/breeding-game.ts`, 6 tests).
- [x] **Lab API routes** — `/api/lab/engines` (catalog + per-engine spec), `/api/lab/run`
      (run engine, hashed record), `/api/lab/campaigns` (bounded autonomous campaign).
      Covered by `src/lib/lab/runner.test.ts` (registry + determinism, 9 tests).
- [x] **Lab workbench UI (catalog + playground)** — `/lab` catalog grouped by domain, `/lab/[engine]`
      interactive playground with a param form generated from each engine's Zod schema
      (`sim/core/param-fields.ts`, `describeEngine().fields`) and Vega-Lite result charts
      (`lib/lab/charts.ts` + shared `components/charts/vega-lite-embed.tsx`). 16 new tests.
      `/lab/campaigns` live viewer is still open — tracked below.
- [ ] **Lab campaigns live viewer** — `/lab/campaigns` page streaming a running autonomous
      campaign's notebook (builds on the durable Inngest campaign below)
- [x] **SIMULATION_ENGINES.md** — full catalog GENERATED from the registry
      (`scripts/gen-engines-doc.ts`, `pnpm docs:engines`): per-engine model, params table,
      references, worked example JSON + an "authoring an engine" guide. Can never drift.
- [x] **MCP tools** — `list_engines` / `describe_engine` / `run_engine` added to the MCP server
      (`src/lib/mcp/lab-tools.ts`, wired in `server.ts`). DB-free, secret-free, reproducible hash.
      7 tests. (`run_campaign` over MCP waits on the durable Inngest campaign below.)
- [ ] **Campaign persistence + Inngest** — durable `run-campaign` function; notebook streamed
      to the UI via the existing SSE channel
- [ ] **Bridge to discovery pipeline** — a novel campaign finding becomes a Discovery Card
      (reuse triage → novelty → vulgarize), canary-replicated via the deterministic hash
- [~] **More engines** — done: `alignment` (Needleman–Wunsch + Smith–Waterman), `hodgkin-huxley`
      (new neuroscience domain; a real ODE-discontinuity truncation bug in the shared solver's
      usage was found and fixed while building it). Next: molecular docking (geometric),
      mass-spec fragmentation, thermodynamic RNA (Zuker), agent-based tissue growth,
      metabolic pathway explorer
- [ ] **3D/visual** — Mol* protein view for folding/structure engines; network graphs for GRN/FBA
- [x] **Seeded reproducibility harness** — `src/lib/sim/reproducibility.test.ts` runs in CI
      (`engines` job). Asserts strict intra-run hash determinism per engine + pins a robust,
      cross-platform snapshot (summary + metrics @ 6 sig figs) so any science change is caught.

### Later
- [ ] Multi-agent lab: a PI agent decomposing a grand goal into parallel bench-agent campaigns
- [ ] Public "discoveries from the autonomous lab" feed
- [ ] Notebook export (JSON-LD / RO-Crate) for each campaign

---

# Roadmap — OpenDiscover (original discovery engine)

## Phase 0 — Foundations (weeks 1–2)
- [x] Architecture document
- [x] Domain choice & justification
- [x] Initial scaffold (Next.js 15, Prisma, AI SDK v6 via Vercel AI Gateway)
- [ ] Postgres + pgvector provisioned on Vercel Marketplace
- [ ] AI Gateway keys + first prompt-cached system prompts
- [ ] Authentication (Sign in with Vercel + optional ORCID)
- [ ] CI: deterministic-runner tests for protocols

## Phase 1 — One protocol, end-to-end (weeks 3–5)
Goal: a single working protocol that can produce a *plausible* Discovery Card from real public data.

- [ ] Protocol: **Small ORF mining in understudied bacterial genomes**
  - Pull a random ≤1 MB slice of a low-popularity NCBI bacterial genome
  - Scan for ORFs 20–100 aa with non-canonical start codons
  - Score for codon-usage anomaly vs the genome's bulk
  - Submit: `{genome_id, orf_coords, sequence, scores}`
- [ ] Reference corpus ingested: UniProt small-protein subset + SmProt + sORFs.org summaries → embedded into pgvector
- [ ] Triage → embed → cluster → novelty score → vulgarize pipeline live
- [ ] Discovery Card renderer (narrative + Vega-Lite viz)
- [ ] Peer-review primitives (replicate / endorse / challenge)
- [ ] Deploy preview to Vercel, invite ~10 alpha users

## Phase 2 — Real corroboration loop (weeks 6–9)
- [ ] Promotion logic: require 2+ independent corroborations + canary re-run
- [ ] Provenance graph UI (which submissions → which discovery)
- [ ] Dispute / retraction flows
- [ ] Reputation system (replication-weighted)
- [ ] Add 2 more protocols: codon-bias HGT signature, cross-species motif conservation
- [ ] First public alpha (target: 100 contributors)

## Phase 3 — Scientific credibility (weeks 10–16)
- [ ] Onboard 2–3 academic advisors (microbial genomics, bioinformatics)
- [ ] External methodological review of novelty pipeline
- [ ] Zenodo DOI minting on confirmed Discoveries
- [ ] First confirmed Discovery written up as a short methods preprint (citing all contributors)
- [ ] Public beta (1k contributors)

## Phase 4 — Scale (months 5+)
- [ ] Protocol marketplace: researchers can author and propose protocols, community votes on adoption
- [ ] Domain expansion: nanotechnology (MD simulation snippets), AlphaFold structural mining
- [ ] Educational integrations (university courses run as cohorts)
- [ ] Sustainability: grant funding + corporate sponsorships gated on non-interference with openness

## Success metrics

| Metric | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Active contributors / week | 5 | 50 | 500 |
| Submissions / week | 50 | 1,000 | 20,000 |
| Provisional Discoveries / month | 1 | 5 | 30 |
| Confirmed Discoveries / quarter | 0 | 1 | 5 |
| Pipeline novelty-scoring p95 latency | <30s | <15s | <10s |
| Cost per submission (compute + LLM) | <$0.05 | <$0.02 | <$0.01 |

## Risk register

| Risk | Mitigation |
|---|---|
| False positives flood the feed | Strict promotion threshold, corroboration requirement, peer review |
| LLM novelty scoring biased toward fluency over substance | Embedding-distance gate + literature tool-use + human review |
| Adversarial submissions | Determinism check + canary re-run + reputation weighting |
| Dual-use concerns | Protocol allowlist, automatic homology screen against toxin/select-agent DBs |
| Cost runaway | Prompt caching, Haiku triage layer, per-account compute credits |
| Academic credibility | External advisors, transparent methodology, preprint publishing |
