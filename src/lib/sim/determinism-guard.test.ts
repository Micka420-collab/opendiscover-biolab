/**
 * Determinism guard — a static check that no engine source uses a nondeterministic or
 * locale-dependent construct.
 *
 * The whole lab rests on engines being pure, deterministic functions: the same params must
 * produce byte-identical output on every machine, every run (that is what the reproducibility
 * snapshot pins). Two classes of bug quietly break that:
 *
 *   1. NONDETERMINISM — `Math.random()`, `Date.now()`, `new Date()`: different output each run.
 *      (Seeded randomness must go through `core/prng.ts`, never `Math.random`.)
 *   2. LOCALE DEPENDENCE — `toLocaleString()` / `Intl.*`: the SAME inputs render differently
 *      depending on the host machine's locale (e.g. a thousands separator of "," vs " " vs "."),
 *      so a summary string built with them fails the byte-identical snapshot across CI machines.
 *      (This actually happened once with `diagnostic-accuracy`; use a locale-independent
 *      formatter instead — see its `group()` helper.)
 *
 * Comments are stripped before scanning, so a docstring may still *mention* these APIs; only
 * real code uses are flagged. This is cheap insurance that a future engine cannot reintroduce
 * either hazard without a red test.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SIM_DIR = fileURLToPath(new URL('.', import.meta.url));

/** All engine/infra source files under src/lib/sim, excluding tests and this guard. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === '__snapshots__') continue;
      sourceFiles(path, acc);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      acc.push(path);
    }
  }
  return acc;
}

/** Remove block and line comments so a docstring mention of a banned API is not flagged. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const BANNED: { pattern: RegExp; why: string }[] = [
  { pattern: /\bMath\.random\s*\(/, why: 'nondeterministic — use the seeded PRNG in core/prng.ts' },
  { pattern: /\bDate\.now\s*\(/, why: 'wall-clock nondeterminism' },
  { pattern: /\bnew\s+Date\s*\(/, why: 'wall-clock nondeterminism' },
  {
    pattern: /\.toLocaleString\s*\(/,
    why: 'locale-dependent output breaks byte-identical reproducibility',
  },
  { pattern: /\.toLocaleDateString\s*\(/, why: 'locale-dependent output' },
  { pattern: /\.toLocaleTimeString\s*\(/, why: 'locale-dependent output' },
  { pattern: /\bIntl\.[A-Za-z]/, why: 'locale-dependent formatting/collation' },
];

describe('determinism guard: engine source is pure and locale-independent', () => {
  const files = sourceFiles(SIM_DIR);

  it('scans a non-trivial number of source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('no engine source uses a nondeterministic or locale-dependent construct', () => {
    const violations: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, 'utf8'));
      for (const { pattern, why } of BANNED) {
        if (pattern.test(code)) {
          const rel = file.slice(file.indexOf('src/lib/sim'));
          violations.push(`${rel}: ${pattern.source} — ${why}`);
        }
      }
    }
    expect(violations, `Banned constructs found:\n${violations.join('\n')}`).toEqual([]);
  });
});
