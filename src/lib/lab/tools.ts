// @ts-nocheck
/**
 * AI SDK tools that give a scientist agent hands in the lab.
 *
 * The agent never touches an engine directly — it works exclusively through
 * these tools, which enforce the engine scope, hash every run, and journal each
 * action to the notebook. That containment is what makes an autonomous campaign
 * safe and reproducible: everything the agent does is a recorded, replayable
 * experiment.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { getEngine, listEngines } from '../sim';
import { describeEngine } from '../sim/kernel';
import type { Notebook } from './notebook';
import { type ExperimentRecord, runExperiment } from './runner';
import { type ParamAxis, gridSweep } from './sweep';

export interface LabToolContext {
  notebook: Notebook;
  /** Engine slugs the agent may use; empty = all. */
  engineScope: string[];
  /** Called for every experiment run, so the caller can persist records. */
  onRecord: (record: ExperimentRecord & { score?: number }) => void;
  /** Hard cap on total engine runs across the campaign. */
  runBudget: { used: number; max: number };
}

function inScope(ctx: LabToolContext, slug: string): boolean {
  return ctx.engineScope.length === 0 || ctx.engineScope.includes(slug);
}

export function makeLabTools(ctx: LabToolContext) {
  return {
    list_engines: tool({
      description:
        'List the simulation engines available in this campaign, with their domain and a one-line description. Call this first to see what instruments the lab has.',
      parameters: z.object({
        domain: z
          .string()
          .optional()
          .describe('Optional domain filter, e.g. "systems-biology", "drug-discovery".'),
      }),
      execute: async ({ domain }) => {
        const engines = listEngines(domain)
          .filter((e) => inScope(ctx, e.slug))
          .map((e) => ({
            slug: e.slug,
            title: e.title,
            domain: e.domain,
            description: e.description,
          }));
        return { count: engines.length, engines };
      },
    }),

    describe_engine: tool({
      description:
        'Get the full specification of one engine: what it models, its parameters (with an example), references, and outputs. Read this before running an engine you have not used yet.',
      parameters: z.object({ slug: z.string() }),
      execute: async ({ slug }) => {
        const spec = getEngine(slug);
        if (!spec || !inScope(ctx, slug))
          return { error: `Engine "${slug}" not available in this campaign.` };
        return describeEngine(spec);
      },
    }),

    run_experiment: tool({
      description:
        'Run one engine with a concrete set of parameters. Returns the summary and all output metrics. Every run is hashed and recorded in the lab notebook.',
      parameters: z.object({
        slug: z.string(),
        params: z
          .record(z.any())
          .describe('Parameter object matching the engine schema. See describe_engine.'),
        rationale: z
          .string()
          .max(400)
          .describe('Why you are running this — one sentence for the notebook.'),
      }),
      execute: async ({ slug, params, rationale }) => {
        if (!inScope(ctx, slug))
          return { error: `Engine "${slug}" not available in this campaign.` };
        if (ctx.runBudget.used >= ctx.runBudget.max) {
          return {
            error: `Run budget exhausted (${ctx.runBudget.max} experiments). Draw conclusions now.`,
          };
        }
        try {
          const record = await runExperiment(slug, params);
          ctx.runBudget.used++;
          ctx.notebook.add('experiment', `${slug}: ${rationale}`, {
            params,
            summary: record.summary,
          });
          ctx.notebook.observation(record.summary, record.metrics);
          ctx.onRecord(record);
          return {
            summary: record.summary,
            metrics: record.metrics,
            outputHash: record.outputHash.slice(0, 12),
            runsRemaining: ctx.runBudget.max - ctx.runBudget.used,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.notebook.error(`run_experiment ${slug} failed: ${msg}`);
          return { error: msg };
        }
      },
    }),

    run_sweep: tool({
      description:
        'Sweep one engine across a parameter grid and rank the runs by a chosen output metric. Use this to find a maximum, a transition, or a sensitivity. Each grid point counts against the run budget.',
      parameters: z.object({
        slug: z.string(),
        base: z.record(z.any()).describe('Fixed parameters shared by every grid point.'),
        axes: z
          .array(
            z.object({
              key: z.string(),
              min: z.number().optional(),
              max: z.number().optional(),
              steps: z.number().int().optional(),
              scale: z.enum(['linear', 'log']).optional(),
              values: z.array(z.union([z.number(), z.string(), z.boolean()])).optional(),
            }),
          )
          .max(3)
          .describe('1–3 axes to sweep. Give either {min,max,steps} or {values}.'),
        scoreMetric: z.string().describe('Metric key to rank by (from the engine outputs).'),
        maximize: z.boolean().default(true),
        rationale: z.string().max(400),
      }),
      execute: async ({ slug, base, axes, scoreMetric, maximize, rationale }) => {
        if (!inScope(ctx, slug))
          return { error: `Engine "${slug}" not available in this campaign.` };
        const remaining = ctx.runBudget.max - ctx.runBudget.used;
        if (remaining <= 0) return { error: 'Run budget exhausted. Draw conclusions now.' };
        try {
          const sweep = await gridSweep(slug, base, axes as ParamAxis[], {
            scoreMetric,
            maximize,
            maxRuns: remaining,
          });
          ctx.runBudget.used += sweep.evaluated;
          for (const r of sweep.ranked) ctx.onRecord({ ...r.record, score: r.score });
          ctx.notebook.add(
            'experiment',
            `sweep ${slug} over ${axes.map((a) => a.key).join(',')}: ${rationale}`,
            {
              best: sweep.best?.params,
              bestScore: sweep.best?.score,
            },
          );
          return {
            evaluated: sweep.evaluated,
            best: sweep.best
              ? { params: sweep.best.params, [scoreMetric]: sweep.best.score }
              : null,
            top: sweep.ranked
              .slice(0, 5)
              .map((r) => ({ params: r.params, score: r.score, summary: r.record.summary })),
            runsRemaining: ctx.runBudget.max - ctx.runBudget.used,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          ctx.notebook.error(`run_sweep ${slug} failed: ${msg}`);
          return { error: msg };
        }
      },
    }),

    record_finding: tool({
      description:
        'Journal an interim analysis or insight to the lab notebook. Use this to note a pattern before deciding your next experiment.',
      parameters: z.object({ note: z.string().max(1000) }),
      execute: async ({ note }) => {
        ctx.notebook.add('analysis', note);
        return { recorded: true };
      },
    }),
  };
}
