// @ts-nocheck
/**
 * MCP server — exposes OpenDiscover protocols as tools for external AI agents.
 *
 * Why: agents (Claude Code, Cursor, the user's own scripts) can now:
 *   - list available protocols
 *   - fetch a protocol definition + sample input
 *   - run a protocol on a dataset slice
 *   - submit a result to the discovery pipeline
 *   - browse recent discoveries
 *
 * This turns OpenDiscover into a true federated discovery system: agents
 * contribute alongside humans, and their submissions are subject to the same
 * triage + corroboration + novelty gates as anyone else's.
 *
 * Transport: streamable HTTP (Vercel Functions). Stdio transport is also
 * available via `pnpm mcp:dev` for local development.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// @ts-nocheck
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { recentDiscoveries } from '@/lib/db/queries';
import { runProtocol } from '@/lib/science/runners/dispatch';
import { canonicalHash } from '@/lib/util/hash';
import { inngest } from '@/lib/inngest';

export function buildMcpServer() {
  const server = new McpServer({ name: 'opendiscover', version: '0.2.0' });

  /* ── list_protocols ─────────────────────────────────────────────── */
  server.tool(
    'list_protocols',
    {
      description: 'List active discovery protocols on OpenDiscover.',
      inputSchema: z.object({}),
    },
    async () => {
      const rows = await db
        .select({
          slug: schema.protocols.slug,
          version: schema.protocols.version,
          title: schema.protocols.title,
          description: schema.protocols.description,
          domain: schema.protocols.domain,
          status: schema.protocols.status,
        })
        .from(schema.protocols)
        .where(eq(schema.protocols.enabled, true))
        .orderBy(desc(schema.protocols.createdAt));
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    },
  );

  /* ── get_protocol ───────────────────────────────────────────────── */
  server.tool(
    'get_protocol',
    {
      description: 'Get full definition of a protocol including its input schema.',
      inputSchema: z.object({
        slug: z.string(),
        version: z.number().int().positive().optional(),
      }),
    },
    async ({ slug, version }) => {
      const [proto] = await db
        .select()
        .from(schema.protocols)
        .where(eq(schema.protocols.slug, slug))
        .orderBy(desc(schema.protocols.version))
        .limit(1);
      if (!proto || (version && proto.version !== version)) {
        return { content: [{ type: 'text', text: `not_found: ${slug}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(proto, null, 2) }] };
    },
  );

  /* ── run_protocol ───────────────────────────────────────────────── */
  server.tool(
    'run_protocol',
    {
      description:
        'Run a protocol locally (server-side, deterministic). Returns the output and its hash. Does not submit. Use submit_result with the hash to register.',
      inputSchema: z.object({
        slug: z.string(),
        version: z.number().int().positive().optional(),
        input: z.record(z.unknown()),
      }),
    },
    async ({ slug, version, input }) => {
      const [proto] = await db
        .select()
        .from(schema.protocols)
        .where(eq(schema.protocols.slug, slug))
        .orderBy(desc(schema.protocols.version))
        .limit(1);
      if (!proto) return { content: [{ type: 'text', text: `not_found: ${slug}` }], isError: true };

      const output = await runProtocol({
        slug,
        version: version ?? proto.version,
        runnerKind: proto.runnerKind as 'js' | 'pyodide' | 'sandbox',
        input,
      });
      const hash = await canonicalHash(output);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ output, hash, slug, version: proto.version }, null, 2),
          },
        ],
      };
    },
  );

  /* ── submit_result ──────────────────────────────────────────────── */
  server.tool(
    'submit_result',
    {
      description:
        'Submit a protocol result to the discovery pipeline. Requires a contributor identity (auth) — for agent contributions, link an API key to a contributor account.',
      inputSchema: z.object({
        contributorId: z.string(),
        slug: z.string(),
        version: z.number().int().positive(),
        input: z.record(z.unknown()),
        output: z.record(z.unknown()),
        hash: z.string().length(64),
      }),
    },
    async ({ contributorId, slug, version, input, output, hash }) => {
      const serverHash = await canonicalHash(output);
      if (serverHash !== hash) {
        return {
          content: [{ type: 'text', text: `hash_mismatch: expected ${serverHash}` }],
          isError: true,
        };
      }
      const [proto] = await db
        .select()
        .from(schema.protocols)
        .where(eq(schema.protocols.slug, slug))
        .orderBy(desc(schema.protocols.version))
        .limit(1);
      if (!proto || proto.version !== version) {
        return { content: [{ type: 'text', text: `protocol_version_mismatch` }], isError: true };
      }
      const sliceKey = String(
        (input as { sliceKey?: unknown }).sliceKey ?? JSON.stringify(input).slice(0, 64),
      );

      const [sub] = await db
        .insert(schema.submissions)
        .values({
          contributorId,
          protocolId: proto.id,
          protocolVersion: proto.version,
          inputSlice: input,
          sliceKey,
          rawOutput: output,
          outputHash: serverHash,
        })
        .returning({ id: schema.submissions.id });

      await inngest.send({ name: 'submission/received', data: { submissionId: sub!.id } });
      return {
        content: [
          { type: 'text', text: JSON.stringify({ submissionId: sub!.id, status: 'accepted' }) },
        ],
      };
    },
  );

  /* ── browse_discoveries ─────────────────────────────────────────── */
  server.tool(
    'browse_discoveries',
    {
      description: 'List recent discoveries sorted by novelty score.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
    },
    async ({ limit }) => {
      const rows = await recentDiscoveries(limit);
      return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
    },
  );

  /* ── get_discovery ──────────────────────────────────────────────── */
  server.tool(
    'get_discovery',
    {
      description: 'Get full discovery card by ID, including provenance and citations.',
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      const [d] = await db
        .select()
        .from(schema.discoveries)
        .where(eq(schema.discoveries.id, id))
        .limit(1);
      if (!d) return { content: [{ type: 'text', text: 'not_found' }], isError: true };
      return { content: [{ type: 'text', text: JSON.stringify(d, null, 2) }] };
    },
  );

  return server;
}
