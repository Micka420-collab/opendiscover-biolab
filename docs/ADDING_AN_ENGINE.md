# Adding a simulation engine

This is the **no-infrastructure** contribution track. A simulation engine is a pure, deterministic
function — no clock, no network, no unseeded randomness — that turns validated parameters into a
hashed, reproducible `SimResult`. No database, no keys, no secrets: `pnpm install` and you have a
green-check loop with `pnpm test:sim`.

New engines show up automatically in `/lab`, and inherit share/remix permalinks, an Open Graph card,
and the OBS overlay for free.

---

## The contract

Every engine exports a `spec: EngineSpec` (see [`src/lib/sim/core/types.ts`](../src/lib/sim/core/types.ts)):

- `slug`, `title`, `domain`, `version`, `description`, optional `references` and `tags`
- `paramsSchema` — a Zod schema that validates and documents parameters (it also generates the UI form)
- `run(params)` — a **pure** function returning a `SimResult`
- `example` — a ready-to-run parameter set used by demos and tests

A `SimResult` is `{ engine, summary, metrics, series?, detail?, provenance }`. Determinism is the
whole point: the same params must always produce the same output (and therefore the same content
hash). If you need randomness, draw it from the seeded PRNG in
[`src/lib/sim/core/prng.ts`](../src/lib/sim/core/prng.ts) — never `Math.random()`.

---

## Step 1 — write the engine

Create `src/lib/sim/<domain>/<engine>.ts`. Copy an existing engine close to your domain as a starting
point (e.g. [`bioprocess/bioreactor.ts`](../src/lib/sim/bioprocess/bioreactor.ts) for ODE models). A
minimal example — deterministic logistic population growth:

```ts
import { z } from 'zod';
import type { EngineSpec, Metric, Series, SimResult } from '../core/types';
import { provenance } from '../core/types';

export const paramsSchema = z
  .object({
    /** Intrinsic growth rate (per unit time). */
    r: z.number().positive().default(0.5),
    /** Carrying capacity. */
    k: z.number().positive().default(100),
    /** Initial population. */
    n0: z.number().positive().default(1),
    /** Number of time steps. */
    steps: z.number().int().positive().max(10_000).default(50),
  })
  .strict();

export type LogisticParams = z.infer<typeof paramsSchema>;

/** Closed-form logistic curve N(t) = K / (1 + ((K - N0)/N0) e^{-r t}). */
export function run(rawParams: Partial<LogisticParams> = {}): SimResult {
  const p = paramsSchema.parse(rawParams);
  const t: number[] = [];
  const n: number[] = [];
  const a = (p.k - p.n0) / p.n0;
  for (let i = 0; i <= p.steps; i++) {
    t.push(i);
    n.push(p.k / (1 + a * Math.exp(-p.r * i)));
  }
  const nFinal = n[n.length - 1] ?? p.n0;

  const metrics: Metric[] = [
    { key: 'finalPopulation', label: 'Final population', value: nFinal },
    { key: 'carryingCapacity', label: 'Carrying capacity K', value: p.k },
  ];
  const series: Series[] = [{ x: t, y: { N: n }, xLabel: 'time', yLabel: 'population' }];

  return {
    engine: 'logistic-growth',
    summary: `Logistic growth to ${nFinal.toFixed(1)} (K = ${p.k}).`,
    metrics,
    series,
    provenance: provenance('logistic-growth', '1.0.0', p),
  };
}

export const spec: EngineSpec<LogisticParams> = {
  slug: 'logistic-growth',
  title: 'Logistic Growth',
  domain: 'systems-biology',
  version: '1.0.0',
  description: 'Deterministic logistic population growth N(t) = K / (1 + a·e^{-rt}).',
  references: ['Verhulst, P.-F. (1838). Notice sur la loi que la population suit dans son accroissement.'],
  paramsSchema: paramsSchema as z.ZodType<LogisticParams>,
  run,
  example: paramsSchema.parse({ r: 0.5, k: 100, n0: 1, steps: 50 }),
  tags: ['population', 'growth', 'ode', 'logistic'],
};

export default spec;
```

> The `paramsSchema as z.ZodType<LogisticParams>` cast is the standard pattern: `.default()` makes the
> parse *input* optional while the *output* type is exact. Runtime validation still enforces the shape.

---

## Step 2 — register it

Add one import and one array entry in [`src/lib/sim/index.ts`](../src/lib/sim/index.ts):

```ts
import { spec as logisticGrowth } from './systems/logistic-growth';
// ...
export const engines: AnyEngine[] = [
  // ...existing engines...
  logisticGrowth,
];
```

That's the only wiring. The catalog, API routes, MCP tools, and the AI scientist all read from this
registry.

---

## Step 3 — test against a known value

Add `src/lib/sim/<domain>/<engine>.test.ts`. A good engine test checks the output against a **known
analytical or textbook value**, not just that it runs, and asserts determinism:

```ts
import { describe, expect, it } from 'vitest';
import { runEngine } from '../index';
import { run } from './logistic-growth';

describe('logistic-growth', () => {
  it('reaches carrying capacity in the long run', () => {
    const result = run({ r: 1, k: 100, n0: 1, steps: 200 });
    const final = result.metrics.find((m) => m.key === 'finalPopulation')?.value ?? 0;
    expect(final).toBeGreaterThan(99.9);
    expect(final).toBeLessThanOrEqual(100);
  });

  it('is deterministic (same params → identical result)', () => {
    const a = runEngine('logistic-growth', { r: 0.5, k: 100, n0: 1, steps: 50 });
    const b = runEngine('logistic-growth', { r: 0.5, k: 100, n0: 1, steps: 50 });
    expect(a).toEqual(b);
  });
});
```

---

## Step 4 — green loop + regenerate the catalog

```bash
pnpm test:sim      # runs every engine + the lab layer, no secrets
pnpm typecheck
pnpm docs:engines  # regenerates SIMULATION_ENGINES.md from the registry
```

`SIMULATION_ENGINES.md` is **generated** — never edit it by hand. Regenerating keeps the public
catalog from drifting; commit it alongside your engine.

Open a PR (see [`CONTRIBUTING.md`](../CONTRIBUTING.md)). Your engine is now live in `/lab`, complete
with a parameter form, result charts, a share/remix permalink, an OG card, and an OBS overlay.
