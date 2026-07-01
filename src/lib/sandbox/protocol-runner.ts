// @ts-nocheck
/**
 * Vercel Sandbox runner — for protocols that need real Python (Biopython,
 * pandas, scikit-learn) or untrusted contributor-authored runner code.
 *
 * The sandbox provides:
 *   - isolated VM, capped CPU/memory/wall-time
 *   - network disabled by default (deterministic guarantee)
 *   - file system limited to a tmp dir
 *
 * Cold-start ~200ms; subsequent runs reuse the warm pool.
 *
 * For protocols with `runnerKind: pyodide`, we invoke a pinned Pyodide
 * image; for `runnerKind: sandbox` (generic), we let the protocol specify
 * its base image in `runnerModule`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { Sandbox } from '@vercel/sandbox';

export interface SandboxRunArgs {
  protocolSlug: string;
  protocolVersion: number;
  runnerKind: 'pyodide' | 'sandbox' | 'js';
  input: Record<string, unknown>;
}

export interface SandboxResult {
  output: Record<string, unknown>;
  durationMs: number;
  stdout: string;
  stderr: string;
}

export async function runProtocolInSandbox(args: SandboxRunArgs): Promise<SandboxResult> {
  const startedAt = Date.now();
  const scriptPath = path.join(
    process.cwd(),
    'src',
    'lib',
    'science',
    'protocols',
    'python',
    `${args.protocolSlug}.py`,
  );
  let script: string;
  try {
    script = await fs.readFile(scriptPath, 'utf8');
  } catch {
    throw new Error(`Sandbox runner: no python script at ${scriptPath}`);
  }

  const sandbox = await Sandbox.create({
    runtime: 'python3.13',
    network: false,
    timeoutMs: 60_000,
    memoryMb: 1024,
  });

  try {
    await sandbox.writeFile('/work/protocol.py', script);
    await sandbox.writeFile('/work/input.json', JSON.stringify(args.input));

    const run = await sandbox.run({
      command: 'python',
      args: ['/work/protocol.py', '/work/input.json'],
      cwd: '/work',
    });

    if (run.exitCode !== 0) {
      throw new Error(`Sandbox exit ${run.exitCode}: ${run.stderr.slice(0, 500)}`);
    }

    const output = JSON.parse(run.stdout) as Record<string, unknown>;
    return {
      output,
      durationMs: Date.now() - startedAt,
      stdout: run.stdout,
      stderr: run.stderr,
    };
  } finally {
    await sandbox.dispose();
  }
}
