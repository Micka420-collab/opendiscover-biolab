/**
 * BioLab MCP tools — expose the deterministic simulation engines to external
 * agents through the same Model Context Protocol server as the discovery
 * protocols.
 *
 * Deliberately DB-free and secret-free: an agent can list engines, read a spec,
 * and run an engine, getting back a reproducible content hash — no auth, no
 * database. The handlers are exported as plain functions so they can be unit
 * tested without standing up an MCP transport.
 */

import { runExperiment } from '@/lib/lab/runner';
import { describeEngine, getEngine, listEngines } from '@/lib/sim';
import { z } from 'zod';

export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

const ok = (value: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
});

const fail = (message: string): ToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
});

/** list_engines handler — the catalog, optionally filtered by domain. */
export function labListEngines(domain?: string): ToolResult {
  const rows = listEngines(domain).map((e) => ({
    slug: e.slug,
    title: e.title,
    domain: e.domain,
    description: e.description,
  }));
  return ok({ count: rows.length, engines: rows });
}

/** describe_engine handler — one engine's full spec (params, example, refs). */
export function labDescribeEngine(slug: string): ToolResult {
  const spec = getEngine(slug);
  if (!spec) return fail(`not_found: ${slug}`);
  return ok(describeEngine(spec));
}

/** run_engine handler — deterministic run with a reproducible content hash. */
export async function labRunEngine(
  slug: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    const rec = await runExperiment(slug, params);
    return ok({
      engine: rec.engine,
      version: rec.engineVersion,
      summary: rec.summary,
      metrics: rec.metrics,
      outputHash: rec.outputHash,
      result: rec.result,
    });
  } catch (err) {
    return fail(`error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Register the three BioLab tools onto an MCP server instance. */
// biome-ignore lint/suspicious/noExplicitAny: McpServer's tool() typings are intentionally loose here
export function registerLabTools(server: any): void {
  server.tool(
    'list_engines',
    {
      description:
        'List the deterministic biotech simulation engines in the BioLab (molecular biology, protein biophysics, systems biology, population genetics, bioprocess, epidemiology, drug discovery, structural). Optional domain filter.',
      inputSchema: z.object({ domain: z.string().optional() }),
    },
    async ({ domain }: { domain?: string }) => labListEngines(domain),
  );

  server.tool(
    'describe_engine',
    {
      description:
        "Get one simulation engine's full specification: parameters (with defaults, ranges, types), a worked example, references, and outputs. Read this before run_engine.",
      inputSchema: z.object({ slug: z.string() }),
    },
    async ({ slug }: { slug: string }) => labDescribeEngine(slug),
  );

  server.tool(
    'run_engine',
    {
      description:
        'Run a simulation engine with parameters. Deterministic and secret-free — returns the summary, metrics, series, and a reproducible SHA-256 content hash (same params → same hash).',
      inputSchema: z.object({
        slug: z.string(),
        params: z.record(z.unknown()).default({}),
      }),
    },
    async ({ slug, params }: { slug: string; params: Record<string, unknown> }) =>
      labRunEngine(slug, params),
  );
}
