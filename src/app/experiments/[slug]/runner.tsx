'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { type SmallOrfOutput, runSmallOrfMining } from '@/lib/science/protocols/small-orf-mining';
import { fetchProtocolPython, runPyodideProtocol } from '@/lib/science/runners/pyodide-browser';
import { canonicalHash } from '@/lib/util/hash';
import { useState } from 'react';

/**
 * Two runner modes side-by-side:
 *  - JS (instant, no download)
 *  - Pyodide Python (downloads ~7MB on first run, lets contributors verify
 *    that the JS and Python implementations agree on every byte)
 */

type RunMode = 'js' | 'pyodide';
type Status =
  | { kind: 'idle' }
  | { kind: 'running'; pct: number; stage: string }
  | { kind: 'done'; output: SmallOrfOutput; hash: string; mode: RunMode }
  | { kind: 'submitting' }
  | { kind: 'submitted'; submissionId: string }
  | { kind: 'error'; message: string };

export function ProtocolRunner({
  slug,
  version,
  runnerKind,
}: {
  slug: string;
  version: number;
  runnerKind: 'js' | 'pyodide' | 'sandbox';
}) {
  const [genomeId, setGenomeId] = useState('NC_009925.1');
  const [sequence, setSequence] = useState('');
  const [windowStart, setWindowStart] = useState(1);
  const [mode, setMode] = useState<RunMode>('js');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function run() {
    if (!sequence) return;
    const sliceKey = `${genomeId}:${windowStart}:${sequence.length}`;
    const input = {
      genomeId,
      sequence,
      windowStart,
      sliceKey,
    };
    try {
      let output: SmallOrfOutput;
      if (mode === 'pyodide') {
        setStatus({ kind: 'running', pct: 10, stage: 'fetching Python source' });
        const py = await fetchProtocolPython(slug, version);
        setStatus({ kind: 'running', pct: 50, stage: 'loading Pyodide' });
        const rawOutput = await runPyodideProtocol({
          protocolSlug: slug,
          pythonSource: py,
          input,
        });
        output = rawOutput as unknown as SmallOrfOutput;
      } else {
        setStatus({ kind: 'running', pct: 30, stage: 'scanning ORFs' });
        output = runSmallOrfMining(input);
      }
      setStatus({ kind: 'running', pct: 90, stage: 'hashing' });
      const hash = await canonicalHash(output);
      setStatus({ kind: 'done', output, hash, mode });
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message });
    }
  }

  async function submit() {
    if (status.kind !== 'done') return;
    setStatus({ kind: 'submitting' });
    try {
      const resp = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          protocolSlug: slug,
          protocolVersion: version,
          inputSlice: {
            sliceKey: `${genomeId}:${windowStart}:${sequence.length}`,
            genomeId,
            windowStart,
            windowLengthNt: sequence.length,
          },
          sliceKey: `${genomeId}:${windowStart}:${sequence.length}`,
          rawOutput: status.output,
          clientOutputHash: status.hash,
          runnerVersion: status.mode === 'pyodide' ? 'pyodide-0.27' : 'js-v1',
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? `HTTP ${resp.status}`);
      setStatus({ kind: 'submitted', submissionId: json.id });
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Input</span>
            <div className="flex gap-1 text-xs">
              <button
                type="button"
                onClick={() => setMode('js')}
                className={`px-2 py-1 rounded ${mode === 'js' ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}
              >
                TypeScript
              </button>
              <button
                type="button"
                onClick={() => setMode('pyodide')}
                className={`px-2 py-1 rounded ${mode === 'pyodide' ? 'bg-accent text-accent-foreground' : 'bg-muted'}`}
              >
                Python (Pyodide)
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">Genome ID</span>
              <input
                value={genomeId}
                onChange={(e) => setGenomeId(e.target.value)}
                className="w-full bg-muted/30 border border-border rounded px-2 py-1 font-mono"
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-muted-foreground">Window start</span>
              <input
                type="number"
                value={windowStart}
                onChange={(e) => setWindowStart(Number(e.target.value) || 1)}
                className="w-full bg-muted/30 border border-border rounded px-2 py-1 font-mono"
              />
            </label>
          </div>
          <label className="text-sm space-y-1 block">
            <span className="text-muted-foreground">
              DNA sequence — paste a slice from NCBI Datasets or a local FASTA
            </span>
            <textarea
              value={sequence}
              onChange={(e) => setSequence(e.target.value.replace(/[^ACGTNacgtn]/g, ''))}
              rows={8}
              className="w-full bg-muted/30 border border-border rounded px-2 py-2 font-mono text-xs"
              placeholder="ATGGCAGCAGCA..."
            />
          </label>
          <Button onClick={run} disabled={!sequence || status.kind === 'running'}>
            Run protocol locally ({mode})
          </Button>
          {status.kind === 'running' && (
            <div className="space-y-2">
              <Progress value={status.pct} />
              <p className="text-xs text-muted-foreground">{status.stage}…</p>
            </div>
          )}
        </CardContent>
      </Card>

      {status.kind === 'done' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Result</span>
              <div className="flex items-center gap-2">
                <Badge variant="muted">via {status.mode}</Badge>
                <code className="text-xs font-mono text-muted-foreground">
                  hash {status.hash.slice(0, 16)}…
                </code>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm">
              <strong>{status.output.hits.length}</strong> candidate small ORFs in a{' '}
              <strong>{status.output.windowLengthNt}</strong> nt window.
            </div>
            {status.output.hits.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left p-2">start</th>
                      <th className="text-left p-2">end</th>
                      <th className="text-left p-2">strand</th>
                      <th className="text-left p-2">start codon</th>
                      <th className="text-left p-2">length aa</th>
                      <th className="text-left p-2">codon-bias z</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.output.hits.slice(0, 20).map((h) => (
                      <tr key={`${h.startNt}-${h.strand}`} className="border-b border-border/50">
                        <td className="p-2">{h.startNt}</td>
                        <td className="p-2">{h.endNt}</td>
                        <td className="p-2">{h.strand}</td>
                        <td className="p-2">{h.startCodon}</td>
                        <td className="p-2">{h.lengthAa}</td>
                        <td className="p-2 text-accent">{h.codonBiasZ.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button variant="outline" onClick={submit}>
              Submit to the discovery engine →
            </Button>
          </CardContent>
        </Card>
      )}

      {status.kind === 'submitting' && (
        <p className="text-sm text-muted-foreground">Submitting to the discovery engine…</p>
      )}
      {status.kind === 'submitted' && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm">
              <strong>Submitted.</strong> Pipeline run id:{' '}
              <code className="text-xs font-mono">{status.submissionId}</code>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              The pipeline is now triaging, embedding, clustering, scoring novelty, and (if it
              promotes) generating a Discovery Card. Watch the live feed on the homepage or the
              Discoveries page.
            </p>
          </CardContent>
        </Card>
      )}
      {status.kind === 'error' && <p className="text-sm text-red-400">Error: {status.message}</p>}
    </div>
  );
}
