# Contributing to OpenDiscover

Thank you for your interest in contributing to OpenDiscover BioLab, the open-source in-silico biology lab. This document covers everything you need to get started.

## Two contribution tracks

There are two ways to contribute, and the first needs **no database, no keys, and no secrets**:

1. **The simulation / lab track (no infrastructure).** Add a deterministic simulation engine, or
   contribute an interesting run to the community gallery. Everything runs on pure functions —
   `pnpm install && pnpm test:sim` and you have a green-check loop with zero setup. Start here.
   → [Add a simulation engine](#add-a-simulation-engine-no-infrastructure) ·
   [Submit an experiment to the gallery](#submit-an-experiment-to-the-gallery)
2. **The discovery-pipeline track (DB-backed).** Add a citizen-science *protocol* to the
   discovery pipeline. This track needs Postgres + pgvector and is where dual-use screening applies.
   → [Adding a new science protocol](#adding-a-new-science-protocol)

If you're new, the simulation track is the fun, fast on-ramp — you can ship a new engine or a gallery
entry without provisioning anything.

---

## Running Locally

### Prerequisites

- Node.js >= 24
- pnpm 9.15.0 (`corepack enable && corepack prepare pnpm@9.15.0 --activate`)
- A PostgreSQL 16 instance with the `pgvector` extension enabled (or use `docker-compose up db -d`)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and fill in environment variables
cp .env.example .env.local
```

### Required environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://opendiscover:opendiscover@localhost:5432/opendiscover` |
| `BETTER_AUTH_SECRET` | Random secret for Better Auth session signing (generate with `openssl rand -hex 32`) |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

### Start the dev server

```bash
# Push the database schema
pnpm db:push

# Seed reference protocols (optional)
pnpm protocols:seed

# Start Next.js with Turbopack
pnpm dev
```

The app runs at `http://localhost:3000`.

---

## Running Tests

```bash
# Unit tests (Vitest)
pnpm test

# Watch mode
pnpm test:watch

# End-to-end tests (Playwright) — requires a running app
pnpm test:e2e
```

All tests live under `src/` next to the code they cover, using the `*.test.ts` naming convention.

---

## Add a simulation engine (no infrastructure)

Simulation engines are the heart of the lab: pure, deterministic functions (no clock, no network,
no unseeded randomness) that turn parameters into a hashed, reproducible `SimResult`. No database or
secrets are involved, so the whole loop is `pnpm test:sim`.

Full walkthrough with a copy-paste template: **[`docs/ADDING_AN_ENGINE.md`](./docs/ADDING_AN_ENGINE.md)**.
In short:

1. Create `src/lib/sim/<domain>/<engine>.ts` — a Zod `paramsSchema`, a pure `run(params)` returning a
   `SimResult`, an `example`, and an exported `spec: EngineSpec`. Copy an existing engine (e.g.
   `src/lib/sim/bioprocess/bioreactor.ts`) as your starting point.
2. Register it: one `import` + one array entry in [`src/lib/sim/index.ts`](./src/lib/sim/index.ts).
3. Add `src/lib/sim/<domain>/<engine>.test.ts` that checks the output against a **known analytical or
   textbook value** — not just "it runs" — and includes a determinism assertion (same input → same hash).
4. `pnpm test:sim` (engines only, no secrets) then `pnpm docs:engines` to regenerate
   [`SIMULATION_ENGINES.md`](./SIMULATION_ENGINES.md) from the registry so the catalog can't drift.

Your engine then shows up automatically in `/lab`, gets a share/remix permalink, an OG card, and an
OBS overlay — for free.

---

## Submit an experiment to the gallery

Found a run worth sharing? Add it to the [community gallery](./src/content/gallery) with a
**one-file pull request** — full credit to you.

1. Copy an existing entry in `src/content/gallery/` (e.g. `chemostat-peak-productivity.json`) to a new
   `your-slug.json`.
2. Fill in the fields:

   ```json
   {
     "slug": "kebab-case-unique-id",
     "title": "A short, human title",
     "engine": "bioreactor",
     "params": { "mode": "chemostat", "d": 0.77 },
     "author": "Your name or handle",
     "credit": "https://your-profile-or-@handle",
     "blurb": "One or two sentences on what makes this run interesting."
   }
   ```

3. `pnpm test` — the gallery loader validates every entry against the target engine's own Zod schema
   at build time, so an unknown engine or malformed params **fails CI and never renders**.
4. Open a PR. Curation is a human merge review — no auto-accept.

Your entry appears on `/gallery` with an "Open in Lab" button that loads the exact run.

---

## Adding a New Science Protocol

OpenDiscover protocols are self-describing pipelines that citizen scientists run against biological data. Each protocol registers itself through the central dispatcher.

### Pattern

1. **Define the protocol schema** in `src/lib/protocols/` following the structure of existing protocols. The dispatcher in `src/lib/protocols/dispatch.ts` maps protocol IDs to their handler functions — add your entry there.

2. **Write a seed entry** in `scripts/seed-protocols.ts` so the protocol appears in the database with its metadata (name, description, category, required inputs, expected outputs).

3. **Add unit tests** that cover the protocol's validation logic and any pure transformation functions. Tests for science protocols are required before a PR can be merged.

4. **Run the seeder** locally to verify the protocol appears correctly:

   ```bash
   pnpm protocols:seed
   ```

### Dual-use screening

If your protocol could plausibly be used to design harmful biological agents, it will be flagged by the dual-use screen before it is published. Document the scientific justification in the protocol's `rationale` field and expect a maintainer review before merge.

---

## Pull Request Guidelines

- **One feature or fix per PR.** Large PRs are hard to review; split them.
- **Biome lint must pass.** Run `pnpm lint` locally before pushing. The CI will fail if there are lint or format violations.
- **Type check must pass.** Run `pnpm typecheck` to catch TypeScript errors before opening a PR.
- **Tests are required for science protocols.** Any PR that adds or modifies a protocol must include corresponding Vitest tests.
- **Descriptive commit messages.** Use the imperative mood: `add AlphaFold protocol`, `fix rate-limit key collision`, `refactor dispatch loop`.
- **Keep PRs draft until ready for review.** Mark as "Ready for review" only when CI is green.

### PR checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] New engines have a known-value + determinism test, and `pnpm docs:engines` was re-run
- [ ] New gallery entries validate (`pnpm test`)
- [ ] New/updated protocols have tests
- [ ] `pnpm db:push` still works (no broken migrations)

---

## Code of Conduct

This project follows the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). By participating you agree to uphold these standards. Enforcement contact: conduct@opendiscover.science.
