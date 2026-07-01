# Contributing to OpenDiscover

Thank you for your interest in contributing to OpenDiscover, the citizen-science discovery platform for in-silico biology. This document covers everything you need to get started.

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
- [ ] New/updated protocols have tests
- [ ] `pnpm db:push` still works (no broken migrations)

---

## Code of Conduct

This project follows the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). By participating you agree to uphold these standards. Enforcement contact: conduct@opendiscover.science.
