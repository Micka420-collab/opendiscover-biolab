# Roadmap — OpenDiscover BioLab

## 🧬 BioLab backlog (autonomous build queue)

This is the live queue the autonomous heartbeat works through. Each item must land
with `pnpm typecheck`, `pnpm test`, and `pnpm lint` all green, then be committed + pushed.

### Reality check (updated 2026-07-13)

This document had drifted well behind the code. Current, verified state:

- **80 simulation engines** across 11 domains (biochemistry, population genetics, ecology,
  systems biology, drug discovery, protein biophysics, neuroscience, molecular biology,
  epidemiology, structural biology, bioprocess) — not the "18/25" the older checkpoints below
  mention. **113 test files, 1340+ tests, all green**; `tsc`, `pnpm test`, and `pnpm lint` all
  clean; CI green on all three jobs (`engines`, `build`, `ci`).
- **The lab + game layer is built and works client-side, secret-free:** `/lab` catalog,
  `/lab/[engine]` generic playground (Zod-schema param form + Vega-Lite charts), `/lab/breeding`
  game, AURORA (`/aurora` + OBS overlay), daily `/challenge`, `/gallery`, `/tv`, share/remix
  permalinks, OG cards, the MCP server, and `SIMULATION_ENGINES.md` (auto-generated).
- **The original "discovery engine" is code-complete but runtime-unverified:** Better Auth
  (magic-link + guest + GitHub OAuth), the Drizzle schema, `/discoveries` + Discovery Card
  renderer + peer-review UI, the public `/api/v1` API, the admin review queue, and a full Inngest
  pipeline (`process-submission`, `peer-review`, `canary-replicate`, `recheck-corroboration`,
  `notify-discovery`, `mint-doi`) plus three cron jobs all exist and typecheck — but none has been
  exercised against a live Postgres+pgvector / AI Gateway, so the older Phase 0–1 checkboxes below
  stay unchecked on purpose (they gate on runtime verification, not on code existing).
- **Hosted deployment: not live.** There is currently **no Vercel project** for this repo (the
  `opendiscover-biolab.vercel.app` URL in the README is the intended target, not a working deploy).
  Re-establishing it is the top open item — see "Deployment" below.

### Deployment (top open item)

- [ ] **Restore the Vercel deployment.** No Vercel project exists yet. Import the GitHub repo in the
      Vercel dashboard (project name `opendiscover-biolab` so the README URL resolves), set the env
      vars from `.env.example` (DATABASE_URL, BETTER_AUTH_SECRET, UPSTASH_REDIS_*, AI Gateway key,
      GitHub OAuth, RESEND/ZENODO/NCBI keys, CRON_SECRET), and deploy. The build already passes with
      only a placeholder `DATABASE_URL` (CI's `build` job proves it), so the deterministic Lab +
      AURORA + challenge come up even before the secrets are filled in; the DB/auth/discovery routes
      light up once the env vars are set. Git-connected import also gives auto-deploy on every push,
      so the hosted app can't silently rot again.

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
      linkage + recombination, seeded offspring sampling. 19 tests vs classical ratios.
      **Rare mutations**: an optional `mutationRate` perturbs only the sampled offspring
      (theoretical distribution/ratio stays the exact unmutated Mendelian calculation, honestly
      documented). Verified with a fully deterministic edge case — an AA×AA cross (guaranteed 100%
      AA pre-mutation) at mutationRate=1 forces every sampled offspring to "aa", checked both in
      vitest and live against the running dev server — plus a Monte-Carlo statistical check
      (empirical rate ≈ 1−(1−rate)² for the two independent per-allele rolls).
      **X-linked (sex-linked) inheritance**: a standalone `crossXLinked(gene, motherAlleles,
      fatherAllele)` helper models hemizygous males (sons get their single X from the mother only;
      daughters get one X from each parent) — deliberately not wired into `run()`'s autosomal
      Punnett machinery, same pattern as `recombinantGametes`. Verified against the classic
      textbook carrier-mother × normal-father cross (no affected daughters, exactly 50% of sons
      affected) before writing any test; 5 tests including probability-sums-to-1 and purity.
      **Epistasis (two-locus gene interaction)**: a standalone `crossEpistatic(geneA, geneB,
      parents, kind)` helper re-groups a two-locus dihybrid cross into the four classical
      epistasis ratios — recessive (9:3:4), dominant (12:3:1), duplicate-recessive/complementary
      (9:7), duplicate-dominant (15:1) — again not wired into `run()`. Every ratio was hand-derived
      from the known 9:3:3:1 dihybrid baseline (e.g. 9:3:4 = 9 A_B_ : 3 A_bb : (3 aaB_ + 1 aabb)
      merged) and cross-checked against the real `crossLocus` output via a throwaway script before
      any test was written; caught and fixed a flawed test-helper along the way (naive "divide by
      the smallest class" integer-ratio reduction is unsound once classes don't share a common
      unit, e.g. 9:3:4 has no common denominator other than 1/16 itself) — replaced with direct
      exact-fraction assertions. 5 tests, all passing on exact /16 fractions.
      **Lethal alleles**: a standalone `applyLethality(genotypeDistribution, isLethal)` helper
      removes genotype classes that never survive to be observed and renormalizes the rest —
      post-processes `run()`'s own output rather than needing new params on it. Verified against
      the classic Cuenot (1905) mouse yellow-coat lethal (Y dominant for yellow but homozygous-
      lethal): Ya × Ya gives the standard 1:2:1 genotype ratio at conception, but exactly 2:1 among
      survivors once YY is removed — confirmed via a throwaway script against the real engine
      output before any test was written. Also asserts the "every class lethal" case throws rather
      than silently returning a broken distribution. 5 tests.
- [x] **Breeding game UI** — `/lab/breeding`: pick two Glowzoa specimens, cross them, reveal
      offspring cards with rarity tiers, and fill a "phenotype dex" of discovered traits.
      Featured on `/lab`. Game rules unit-tested (`lib/lab/breeding-game.ts`, 9 tests).
      **Multi-generation breeding**: a "🐣 Breed this one" button promotes any offspring card into
      a real `Specimen` (`offspringToSpecimen`) selectable as a parent for the next cross — F1 x F1
      or F1 x starter. Round-trip fidelity and a genuine Mendelian invariant are both tested (a
      homozygous GG parent can never pass on a "Faint" allele — verified live against the running
      dev server, not just vitest, matching the exact predicted 50/50 Radiant/Radiant-Faint split).
      **Expected phenotype ratio chart**: a bar chart (`lib/lab/charts.ts`'s new
      `distributionToVegaLiteSpec`) renders the full theoretical Punnett-square prediction next to
      each litter, so players can compare their actual draw against the exact Mendelian ratio, not
      just read a `9:3:3:1`-style string. Verified live against the running dev server's real
      `/api/lab/run` response (not mocked). The underlying chart-spec builder is generic (any
      engine's `{ <label>: string; probability: number }[]` detail field that sums to ~1 gets
      auto-charted in the `/lab/[engine]` playground too — `extractDistributions` deliberately
      requires the probabilities to sum to 1 so it doesn't misfire on unrelated per-item scores
      like `secondary-structure`'s independent beta-turn bend probabilities). 3 new chart tests.
      **Advanced genetics panel**: `/lab/breeding` now has a live, client-side (no API round-trip —
      these helpers are pure functions) demo of four previously-invisible standalone genetics
      helpers: X-linked inheritance (`crossXLinked`, pick mother/father genotype, see the
      4 sex/genotype/phenotype classes update instantly — default carrier-mother × normal-father
      case verified live to render exactly 25%/25%/25%/25% with no affected daughters), epistasis
      (`crossEpistatic`, pick one of the 4 classical interaction kinds, bar-charted via
      `distributionToVegaLiteSpec`), lethal alleles (`applyLethality`, Cuénot's mouse
      yellow-coat cross, side-by-side "at conception" 1:2:1 vs "among survivors" 2:1 bar charts),
      and linkage/recombination (`recombinantGametes`, pick a recombination frequency r from
      0/0.1/0.2/0.3/0.5, see the 4 gamete frequencies re-chart — reuses the exact `(1-r)/2` /
      `r/2` fractions already hand-verified in `breeding.test.ts`, so no new math needed
      re-verifying, only its live wiring). Confirmed rendering live against a real dev server
      response (curled HTML, not just unit tests) — the default X-linked case's exact percentages
      and the linkage demo's description text were both read back from the served page.
- [x] **Lab API routes** — `/api/lab/engines` (catalog + per-engine spec), `/api/lab/run`
      (run engine, hashed record), `/api/lab/campaigns` (bounded autonomous campaign).
      Covered by `src/lib/lab/runner.test.ts` (registry + determinism, 9 tests).
- [x] **Lab workbench UI (catalog + playground)** — `/lab` catalog grouped by domain, `/lab/[engine]`
      interactive playground with a param form generated from each engine's Zod schema
      (`sim/core/param-fields.ts`, `describeEngine().fields`) and Vega-Lite result charts
      (`lib/lab/charts.ts` + shared `components/charts/vega-lite-embed.tsx`). 16 new tests.
      `/lab/campaigns` live viewer is still open — tracked below.
      **Seed field usability**: the near-universal `seed: z.union([z.number(), z.string()])`
      param (present on every seeded engine, including all newer ones — `luria-delbruck`,
      `moran-process`, `kuramoto`, etc.) used to fall back to a raw JSON textarea (`describeParamFields`
      couldn't map a union to a control), forcing users to type `"my-seed"` with quotes instead of
      just `my-seed`. `param-fields.ts` now special-cases the exact `number | string` union shape as
      a plain text field — verified live end-to-end: `/lab/luria-delbruck` renders a real `<input
      type="text">`, and `POST /api/lab/run` accepts a bare unquoted seed string and returns a valid
      result. Any other union shape still correctly falls back to `json`.
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
- [x] **More engines** — done: `alignment` (Needleman–Wunsch + Smith–Waterman), `hodgkin-huxley`
      (new neuroscience domain; a real ODE-discontinuity truncation bug in the shared solver's
      usage was found and fixed while building it), `mass-spec` (peptide MS/MS b/y fragment-ion
      prediction; residue masses derived from CODATA atomic masses rather than a copied table,
      cross-checked both algebraically — b_i + y_(n-i) = M + 2·proton — and against the standard
      literature figures), `docking` (geometric rigid-body pose ranking via Lennard-Jones scoring;
      LJ minimum/root and Rodrigues-rotation orthogonality verified by hand-derivation, not memory),
      `branching-growth` (Galton-Watson cell-population growth/extinction; the extinction-probability
      theorem verified on 3 hand-solved edge cases before being trusted for the general formula),
      `metabolic-pathway` (kinetic ODE complement to fba.ts's steady-state LP: a linear
      Michaelis-Menten chain reaches uniform flux at steady state, or backs up without bound past a
      genuine capacity bottleneck — both regimes hand-derived/verified, including a closed-form
      two-step steady state solved algebraically before trusting the ODE integration against it).
      This closes the "more engines" backlog item at 25 engines. Thermodynamic RNA (Zuker)
      deprioritized — its real nearest-neighbour free-energy tables (Turner parameters) are too
      extensive to safely hand-verify rather than risk copying a misremembered figure; revisit
      only with a citable primary source.
- [~] **3D/visual** — done: `grn`'s regulatory network topology and `fba`'s bipartite metabolite/
      reaction network are both visualized in the `/lab/[engine]` playground (`lib/lab/network-chart.ts`).
      `grn`: deterministic circular layout (exact trig, hand-verified: node i at angle -π/2+i·2π/n),
      color-coded activation/repression. `fba`: two concentric circles (metabolites outer r=1.5,
      reactions inner r=0.7, both the same circular layout scaled), substrate/product edges directed
      by stoichiometric coefficient sign. Both engines' `detail` gained additive, non-breaking fields
      (`grn.edges`, `fba.metabolites`/`fba.stoichiometryEdges`). Verified live against the running dev
      server: `/lab/grn` and `/lab/fba` both render, and their APIs return the exact hand-derived
      topology (repressilator's 3-cycle; the textbook EX_glc→glc_c→GLYC→pyr_c→BIOMASS chain, objective
      20 matching the engine's own documented optimum). Still open: a real Mol* 3D view (needs actual
      3D coordinates — hp-folding's are a 2D lattice, not real protein structure, so this needs a
      genuine PDB-shaped output first, not a forced fit).
- [x] **Seeded reproducibility harness** — `src/lib/sim/reproducibility.test.ts` runs in CI
      (`engines` job). Asserts strict intra-run hash determinism per engine + pins a robust,
      cross-platform snapshot (summary + metrics @ 6 sig figs) so any science change is caught.
- [x] **Production build hardening** — `pnpm build` was actually broken (3 GET routes tried to
      hit a live DB during static prerendering). Fixed with explicit `dynamic = 'force-dynamic'`
      + Cache-Control headers; new CI `build` job runs with no DB service at all to guard it.
- [x] **Scientific rigor audit (all 20 pre-existing engines)** — independent per-engine audit vs.
      each engine's own cited references, found and fixed real bugs with regression tests (not
      just wording): admet TPSA ether/amine misclassification, bioreactor D=0 chemostat
      singularity, breeding multi-char allele corruption, compartmental SIR peak formula misuse
      below R₀·s₀≤1, crispr Cas12a PAM-orientation bug, wright-fisher fixation-latch bug, and
      more — full detail in each engine's commit / the audit's `changesSummary`. 579 tests total.

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
