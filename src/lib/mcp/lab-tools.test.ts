import { describe, expect, it } from 'vitest';
import { labDescribeEngine, labListEngines, labRunEngine, registerLabTools } from './lab-tools';

const body = (r: { content: { text: string }[] }) => JSON.parse(r.content[0].text);

describe('mcp lab tools', () => {
  it('list_engines returns the full catalog', () => {
    const r = labListEngines();
    expect(r.isError).toBeUndefined();
    expect(body(r).count).toBeGreaterThanOrEqual(19);
  });

  it('list_engines filters by domain', () => {
    const rows = body(labListEngines('protein')).engines;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((e: { domain: string }) => e.domain === 'protein')).toBe(true);
  });

  it('describe_engine returns fields + example', () => {
    const d = body(labDescribeEngine('sequence'));
    expect(d.slug).toBe('sequence');
    expect(Array.isArray(d.fields)).toBe(true);
    expect(d.example).toBeDefined();
  });

  it('describe_engine on an unknown slug is an error', () => {
    const r = labDescribeEngine('does-not-exist');
    expect(r.isError).toBe(true);
  });

  it('run_engine returns a reproducible 64-char hash', async () => {
    const a = body(await labRunEngine('enzyme-kinetics', { vmax: 10, km: 5 }));
    const b = body(await labRunEngine('enzyme-kinetics', { vmax: 10, km: 5 }));
    expect(a.outputHash).toHaveLength(64);
    expect(a.outputHash).toBe(b.outputHash);
    expect(a.summary.length).toBeGreaterThan(0);
  });

  it('run_engine on an unknown engine is an error', async () => {
    const r = await labRunEngine('nope', {});
    expect(r.isError).toBe(true);
  });

  it('registerLabTools wires exactly the three lab tools', () => {
    const names: string[] = [];
    const fakeServer = {
      tool: (name: string) => {
        names.push(name);
      },
    };
    registerLabTools(fakeServer);
    expect(names).toEqual(['list_engines', 'describe_engine', 'run_engine']);
  });
});
