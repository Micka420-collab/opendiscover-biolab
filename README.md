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
| | `alignment` | Pairwise alignment — Needleman–Wunsch (global) & Smith–Waterman (local) |
| 🧬 Protein biophysics | `properties` | MW, theoretical pI, GRAVY, instability index, extinction coefficient |
| | `secondary-structure` | Chou–Fasman helix/sheet/coil prediction |
| | `hp-folding` | HP lattice-model folding via seeded Monte-Carlo energy minimization |
| | `mass-spec` | Peptide MS/MS b/y fragment-ion prediction; residue masses derived from CODATA atomic masses |
| | `two-state-folding` | Thermodynamic folding stability curve: ΔG(T), Tm, fraction folded, heat & cold denaturation |
| ⚙️ Systems biology | `enzyme-kinetics` | Michaelis–Menten, competitive/non-competitive inhibition, Hill cooperativity |
| | `grn` | Gene regulatory networks: repressilator, toggle switch, feed-forward loops |
| | `gillespie` | Exact stochastic simulation (SSA) of the chemical master equation |
| | `fba` | Flux balance analysis via a built-in linear-programming solver |
| | `branching-growth` | Galton-Watson branching process: cell-population growth & extinction probability |
| | `metabolic-pathway` | Kinetic linear pathway (Michaelis-Menten steps, ODE) — flux uniformity & bottlenecks |
| | `kuramoto` | Kuramoto synchronization: coupled phase oscillators, order parameter, critical coupling |
| 🌱 Population genetics | `wright-fisher` | Genetic drift, selection, mutation, fixation probability |
| | `phylogenetics` | Distance models (JC/K2P), Neighbor-Joining & UPGMA trees, Newick output |
| | `breeding` | Mendelian crossing: Punnett distributions, 3:1 / 9:3:3:1, dominance modes (loci always unlinked; `recombinantGametes` is a standalone helper, not wired into the cross) |
| | `hardy-weinberg` | Hardy–Weinberg test: allele frequencies, expected p²:2pq:q², χ² goodness-of-fit, inbreeding F |
| | `moran-process` | Finite-population fixation: exact fixation probability + seeded Monte-Carlo ensemble, drift & selection |
| | `luria-delbruck` | The 1943 fluctuation test: variance ≫ mean "jackpots", p0 mutation-rate estimate m = −ln(p0) |
| | `ewens-sampling` | Ewens sampling formula: E[K]=Σθ/(θ+i), homozygosity 1/(1+θ), allele-frequency spectrum |
| | `coalescent` | Kingman coalescent tree: E[T_MRCA]=2(1−1/n), tree length, Watterson's θ̂_W, E[S]=θ·aₙ |
| 🧠 Neuroscience | `hodgkin-huxley` | The 1952 action-potential model (Nobel Prize, 1963): spike threshold, repetitive firing |
| | `fitzhugh-nagumo` | 2-variable excitable neuron: rest/limit-cycle, Hopf bifurcation, (v,w) phase portrait |
| | `wilson-cowan` | Excitatory/inhibitory neural populations: fixed points vs limit-cycle brain rhythms |
| | `izhikevich` | Spiking-neuron model: 4 params → tonic/bursting firing, spike-rate & ISI stats |
| 🏭 Bioprocess | `bioreactor` | Monod growth: batch, fed-batch, and chemostat/CSTR dynamics |
| 🦠 Epidemiology | `compartmental` | SIR / SEIR / SIRD, R₀, herd-immunity threshold, final epidemic size |
| | `sis` | SIS (no immunity): endemic prevalence i* = 1 − 1/R₀, disease-free threshold |
| | `sir-endemic` | SIR with demography: damped recurrent epidemics to S* = 1/R₀, I* = μ(R₀−1)/β |
| | `reed-frost` | Discrete chain-binomial epidemic: I_{t+1}=S_t(1−(1−p)^{I_t}), attack rate, final size z=1−e^(−R₀z) |
| 💊 Drug discovery | `admet` | Lipinski/Veber/Ghose rules, QED drug-likeness, SMILES property parsing |
| | `docking` | Geometric rigid-body docking — Lennard-Jones pose scoring & ranking |
| | `dose-response` | Hill dose–response, IC₅₀/EC₅₀ fitting, drug-combination indices |
| | `pk-two-compartment` | IV-bolus pharmacokinetics: bi-exponential plasma curve, α/β half-lives, AUC=Dose/CL |
| 🔬 Structural | `rna-fold` | RNA secondary structure via the Nussinov DP algorithm |
| | `worm-like-chain` | DNA force–extension (Marko–Siggia): entropic elasticity, low-force stiffness, tweezers curve |
| 🐺 Ecology | `lotka-volterra` | Predator–prey oscillations: conserved quantity, coexistence equilibrium, phase portrait |
| | `logistic-map` | Robert May's map: fixed point → period-doubling → chaos, Lyapunov exponent, bifurcation diagram |
| | `rosenzweig-macarthur` | Realistic predator–prey (logistic prey, Holling II): coexistence equilibrium, paradox of enrichment |
| | `rock-paper-scissors` | Replicator dynamics of cyclic dominance: conserved V = xR·xP·xS, center/edge regimes |
| | `nicholson-bailey` | Discrete host–parasitoid map: exact equilibrium, the always-unstable divergent oscillation |
| | `chemostat-competition` | Two species, one substrate: the R* rule & competitive exclusion (lower R* wins) |
| | `levins-metapopulation` | Patch occupancy p* = h − e/c and the habitat-destruction extinction threshold |
| | `replicator-dynamics` | Evolutionary game theory: classifies any 2×2 game (Hawk–Dove, Stag Hunt, PD) and finds the ESS |

> Full catalog with parameters and references: [`SIMULATION_ENGINES.md`](./SIMULATION_ENGINES.md).
> Run any engine interactively — a param form generated from its Zod schema, Vega-Lite result
> charts, no account needed — at `/lab`.

---

## Streamers & creators

Because every run is deterministic, **any experiment is already a shareable link** — the whole
lab is built to be streamed, shared, and remixed with no account and no infrastructure.

- **🔗 Share & remix permalinks.** Every engine playground has a **Share / Remix** button that packs
  the exact engine + parameters into a `?x=` link. Whoever opens it reproduces your run
  byte-for-byte (same numbers, same content hash), then tweaks a value and re-shares their remix.
  The link is self-contained — nothing is uploaded or stored server-side.
- **🎯 Daily challenge — [`/challenge`](./src/app/challenge).** One puzzle a day, derived purely from
  the date, so it's the *same for everyone on Earth* with no server and no RNG. Tune one parameter,
  beat the target, and share your best attempt as a normal `?x=` link. A ready-made "today's episode"
  hook for a stream. Your personal best is stored locally in your browser — no global leaderboard.
- **🖼️ Rich social cards.** Every engine page and every shared run unfurls into a branded
  1200×630 Open Graph image. A shared `?x=` link shows the engine, its headline metric, and the
  reproducibility hash — so links dropped in Discord/X/Twitch chat look alive.
- **📺 OBS overlay mode.** Append `/overlay` to any engine link —
  `/lab/<engine>/overlay?x=<token>` — for a transparent, chrome-less, big-type result card that
  auto-runs on load. Add it as a **Browser Source** in OBS (1920×1080, transparent background) and
  your stream shows live engine output with its hash as proof. The **📺 OBS overlay** button in the
  playground builds the URL for you.
- **🖼️ Community gallery — [`/gallery`](./src/app/gallery).** A curated, credited collection of
  interesting runs. Each opens in the Lab in one click. Adding yours is a **one-file pull request**
  (see [`CONTRIBUTING.md`](./CONTRIBUTING.md)); a build-time check validates every entry against its
  engine's schema, so a broken run can never merge.

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
   /lab/*             → engine catalog + interactive playground (param form, Vega-Lite charts)
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

## Project status — what's actually verified

Honesty about what has and hasn't been run for real:

**Verified, hands-on:**
- All 48 engines + the lab layer: **980+ tests pass**, checked against known analytical/textbook values, run in CI with zero secrets (`engines` job).
- `pnpm build` succeeds — a real Next.js production build, with **no database and no secrets configured** (CI's `build` job runs it with a placeholder, unreachable `DATABASE_URL` to prove this). API routes that read live data are explicitly `dynamic = 'force-dynamic'` so they're never executed at build time.
- `pnpm dev` + real HTTP requests against the running server confirm `/lab`, `/lab/breeding`, and `/lab/[engine]` render actual content, and `POST /api/lab/run` returns correct, live-computed results (e.g. a `breeding` cross returning the exact 3:1 Mendelian ratio).
- `pnpm typecheck` and `pnpm lint` (Biome) are both clean.

**Not verified (needs infrastructure this repo doesn't provision):**
- The discovery pipeline, peer review, DOI minting, auth, and the autonomous `runCampaign` scientist agent all need a real Postgres + pgvector instance and a Vercel AI Gateway key — neither is running against this codebase yet. The code compiles and is typed against real schemas, but its runtime behavior with live data is unverified.
- No load testing, no security audit, no production deployment yet.

**Scientific accuracy — models, not lab results.** Every engine reproduces the textbook/analytical case it's tested against, but several use documented simplifications rather than state-of-the-art methods: see each engine's `references` and the caveats noted in its test file (e.g. the ADMET logP is a crude atom-contribution estimate, not a calibrated model; CRISPR on/off-target scoring is a documented heuristic, not the trained Doench/CFD models; HP lattice folding is a teaching model, not a real force field). Treat outputs as illustrative, not as a substitute for wet-lab or peer-reviewed computational results.

All 20 pre-existing engines went through an independent scientific-accuracy audit (each checked against its own cited references) that found and fixed **real, verifiable bugs** — not just wording. Highlights: `admet`'s TPSA fragment classifier miscounted ether/amine oxygens as carbonyls (aspirin's TPSA silently read 71.4 instead of the correct 63.6 Å²); `bioreactor`'s chemostat steady-state formula was applied at D=0, a genuine mathematical singularity, instead of the true closed-batch limit; `breeding` corrupted any multi-character allele symbol (e.g. an ABO-style locus) through a lossy string-splitting round-trip; `compartmental`'s SIR peak-prevalence formula was applied even when the effective reproduction number R₀·s₀ ≤ 1, where the epidemic never actually peaks. Every fix shipped with a regression test that fails on the old code and passes on the new. Full detail in each engine's `changesSummary` is in the commit history.

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
