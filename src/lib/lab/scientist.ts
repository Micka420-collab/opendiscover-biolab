// @ts-nocheck
/**
 * The autonomous BioLab scientist.
 *
 * Given a research goal and a set of engines it may use, this agent runs a
 * bounded, self-directed campaign: it forms a hypothesis, designs and runs
 * experiments through the lab tools, reads the numbers, iterates, and finally
 * synthesizes a report. Every action is hashed and journalled, so the campaign
 * is fully inspectable and reproducible.
 *
 * This is the layer that turns "18 deterministic simulators" into "a lab that
 * discovers things on its own".
 */

import { Experimental_Agent as Agent, stepCountIs } from 'ai';
import { z } from 'zod';
import { MODELS, SYSTEM_PROMPTS } from '../ai/gateway';
import { Notebook, type NotebookEntry } from './notebook';
import type { ExperimentRecord } from './runner';
import { makeLabTools } from './tools';

const reportSchema = z.object({
  hypothesis: z.string().describe('The falsifiable hypothesis the campaign tested.'),
  key_findings: z
    .array(
      z.object({
        finding: z.string(),
        evidence: z.string().describe('Which experiment(s) and metric values support this.'),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(8),
  best_experiment: z
    .object({ engine: z.string(), params: z.record(z.any()), why: z.string() })
    .nullable(),
  surprises: z
    .array(z.string())
    .max(5)
    .describe('Results that contradicted the hypothesis or expectation.'),
  conclusion: z
    .string()
    .describe('Honest synthesis; what the in-silico evidence does and does not establish.'),
  followup_experiments: z.array(z.string()).max(6),
  novelty_claim: z
    .string()
    .nullable()
    .describe('If something genuinely non-obvious emerged, state it in one sentence; else null.'),
});

export type CampaignReport = z.infer<typeof reportSchema>;

export interface CampaignInput {
  goal: string;
  /** Engine slugs the agent may use; empty = all engines. */
  engineScope?: string[];
  /** Max reasoning steps (tool calls + thinking). */
  maxSteps?: number;
  /** Max total engine runs (individual experiments) across the campaign. */
  runBudget?: number;
  /** Override the model (defaults to the scientist model). */
  model?: string;
  /** Streamed notebook callback for live UIs. */
  onNotebookEntry?: (entry: NotebookEntry) => void;
}

export interface CampaignOutcome {
  report: CampaignReport;
  notebook: NotebookEntry[];
  notebookMarkdown: string;
  experiments: (ExperimentRecord & { score?: number })[];
  runsUsed: number;
}

/**
 * Run one autonomous research campaign to completion. Requires the AI Gateway to
 * be configured (this is the only non-deterministic part of the lab — the
 * experiments it runs are themselves fully deterministic).
 */
export async function runCampaign(input: CampaignInput): Promise<CampaignOutcome> {
  const notebook = new Notebook(input.onNotebookEntry);
  const records: (ExperimentRecord & { score?: number })[] = [];
  const runBudget = { used: 0, max: input.runBudget ?? 24 };

  const tools = makeLabTools({
    notebook,
    engineScope: input.engineScope ?? [],
    onRecord: (r) => records.push(r),
    runBudget,
  });

  notebook.hypothesis(`Campaign goal: ${input.goal}`);

  const agent = new Agent({
    model: input.model ?? MODELS.scientist,
    system: SYSTEM_PROMPTS.scientist,
    tools,
    stopWhen: stepCountIs(input.maxSteps ?? 30),
  });

  const prompt = `# Research goal
${input.goal}

# Your instruments
Call list_engines to see the simulation engines available to you${
    input.engineScope?.length ? ` (restricted to: ${input.engineScope.join(', ')})` : ''
  }.

# Budget
You may run up to ${runBudget.max} experiments. Spend them wisely.

Begin: state your hypothesis (record_finding), inspect the relevant engines, then design and run experiments. When you have enough evidence — or your budget is nearly spent — return the structured campaign report.`;

  const result = await agent.generate({
    prompt,
    experimental_output: { schema: reportSchema },
  });

  const report = result.experimental_output as CampaignReport;
  notebook.conclusion(report.conclusion, {
    novelty: report.novelty_claim,
    findings: report.key_findings.length,
  });

  return {
    report,
    notebook: [...notebook.all()],
    notebookMarkdown: notebook.toMarkdown(),
    experiments: records,
    runsUsed: runBudget.used,
  };
}
