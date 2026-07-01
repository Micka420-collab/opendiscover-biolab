/**
 * Protocol runner dispatch.
 *
 * Three runner kinds:
 *   - js       — pure TypeScript, runs anywhere
 *   - pyodide  — Python via Pyodide in browser, or Node-Pyodide on server
 *   - sandbox  — Vercel Sandbox (Python 3.13, network=off by default)
 *
 * Determinism contract: every runner must produce identical output for
 * identical input. No time, no random, no network inside protocol code.
 */

import { runProtocolInSandbox } from '@/lib/sandbox/protocol-runner';
import { runAlphaFoldDisorder } from '@/lib/science/protocols/alphafold-disorder';
import { runCodonBiasHgt } from '@/lib/science/protocols/codon-bias-hgt';
import { runMotifConservation } from '@/lib/science/protocols/motif-conservation';
import { runSmallOrfMining } from '@/lib/science/protocols/small-orf-mining';

export type RunnerKind = 'js' | 'pyodide' | 'sandbox';

export interface RunProtocolArgs {
  slug: string;
  version: number;
  runnerKind: RunnerKind;
  input: Record<string, unknown>;
}

// biome-ignore lint/suspicious/noExplicitAny: protocol runners take arbitrary typed inputs
const JS_RUNNERS: Record<string, (input: any) => unknown> = {
  'small-orf-mining-v1': (i) => runSmallOrfMining(i),
  'codon-bias-hgt-v1': (i) => runCodonBiasHgt(i),
  'motif-conservation-v1': (i) => runMotifConservation(i),
  'alphafold-disorder-v1': (i) => runAlphaFoldDisorder(i),
};

export async function runProtocol(args: RunProtocolArgs): Promise<Record<string, unknown>> {
  if (args.runnerKind === 'js') {
    const fn = JS_RUNNERS[args.slug];
    if (!fn) throw new Error(`No JS runner registered for ${args.slug}`);
    return fn(args.input) as Record<string, unknown>;
  }
  if (args.runnerKind === 'sandbox' || args.runnerKind === 'pyodide') {
    const r = await runProtocolInSandbox({
      protocolSlug: args.slug,
      protocolVersion: args.version,
      runnerKind: args.runnerKind,
      input: args.input,
    });
    return r.output;
  }
  throw new Error(`Unknown runner kind: ${args.runnerKind}`);
}
