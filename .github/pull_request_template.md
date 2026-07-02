<!-- Thanks for contributing to OpenDiscover BioLab! Keep PRs to one feature/fix. -->

## What & why

<!-- What does this change and why? Link any related issue. -->

## Contribution track

- [ ] Simulation engine / lab (no infra — `pnpm test:sim`)
- [ ] Community gallery entry (one JSON file)
- [ ] Discovery pipeline / protocol (DB-backed)
- [ ] Docs / tooling / other

## Checklist

- [ ] `pnpm lint` passes (Biome — lint + format)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] New engines: a known-value **and** determinism test, and `pnpm docs:engines` re-run + committed
- [ ] New gallery entries validate at build (`pnpm test`)
- [ ] New/updated protocols have tests
- [ ] Scientific claims stay honest — models, not clinical/applied results
