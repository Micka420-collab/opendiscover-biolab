# Roadmap — OpenDiscover

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
