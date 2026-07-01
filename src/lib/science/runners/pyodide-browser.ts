/**
 * Browser-side Pyodide runner.
 *
 * Loads Pyodide from the official CDN on first use (cached afterwards), fetches
 * the protocol's Python source from /protocols/*.py, runs it with the input as
 * stdin, returns the parsed output.
 *
 * Why bother shipping Python to the browser:
 *   - Many bioinformatics tools have only Python implementations (Biopython,
 *     scikit-bio). Re-implementing them in TypeScript would be both expensive
 *     and an audit liability — running the reference Python keeps "the science"
 *     unambiguous.
 *   - Determinism: same code runs server-side in Sandbox AND client-side in
 *     Pyodide. Output hashes match.
 */

declare global {
  interface Window {
    loadPyodide?: (cfg?: { indexURL?: string }) => Promise<PyodideInstance>;
  }
}

interface PyodideInstance {
  loadPackage: (names: string | string[]) => Promise<void>;
  runPython: (code: string) => unknown;
  runPythonAsync: (code: string) => Promise<unknown>;
  FS: {
    writeFile: (path: string, data: string) => void;
    readFile: (path: string, opts?: { encoding?: string }) => string;
  };
  globals: { get: (name: string) => unknown; set: (name: string, val: unknown) => void };
}

const PYODIDE_VERSION = '0.27.0';
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let _pyodide: Promise<PyodideInstance> | null = null;

async function loadPyodideOnce(): Promise<PyodideInstance> {
  if (_pyodide) return _pyodide;
  _pyodide = (async () => {
    const script = document.createElement('script');
    script.src = `${PYODIDE_CDN}pyodide.js`;
    const loaded = new Promise<void>((res, rej) => {
      script.onload = () => res();
      script.onerror = () => rej(new Error('failed to load pyodide.js'));
    });
    document.head.appendChild(script);
    await loaded;
    const py = await window.loadPyodide?.({ indexURL: PYODIDE_CDN });
    if (!py) throw new Error('Pyodide failed to initialize');
    return py;
  })();
  return _pyodide;
}

export async function runPyodideProtocol(args: {
  protocolSlug: string;
  pythonSource: string;
  input: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const py = await loadPyodideOnce();
  py.FS.writeFile('/tmp/protocol.py', args.pythonSource);
  py.FS.writeFile('/tmp/input.json', JSON.stringify(args.input));

  await py.runPythonAsync(`
import json, sys, io
sys.argv = ["protocol.py", "/tmp/input.json"]
buf = io.StringIO()
sys.stdout = buf
exec(open("/tmp/protocol.py").read())
sys.stdout = sys.__stdout__
_output_json = buf.getvalue()
  `);
  const json = py.globals.get('_output_json') as string;
  return JSON.parse(json) as Record<string, unknown>;
}

export async function fetchProtocolPython(slug: string, version: number): Promise<string> {
  const resp = await fetch(`/protocols/${slug}-v${version}.py`);
  if (!resp.ok) throw new Error(`No Python source for ${slug}@v${version}`);
  return resp.text();
}
