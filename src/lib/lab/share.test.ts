import { describe, expect, it } from 'vitest';
import {
  SHARE_PARAM,
  decodeExperiment,
  encodeExperiment,
  experimentOverlayPath,
  experimentSharePath,
} from './share';

describe('experiment share codec', () => {
  const cases: { engine: string; params: Record<string, unknown> }[] = [
    { engine: 'breeding', params: {} },
    { engine: 'bioreactor', params: { mode: 'chemostat', d: 0.2, muMax: 0.9 } },
    { engine: 'sequence', params: { seq: 'ATGGCC', kind: 'dna', findOrfs: true } },
    {
      engine: 'grn',
      params: { network: 'repressilator', nodes: ['a', 'b', 'c'], nested: { k: [1, 2, 3] } },
    },
  ];

  it('round-trips engine + params exactly', () => {
    for (const state of cases) {
      const decoded = decodeExperiment(encodeExperiment(state));
      expect(decoded).toEqual(state);
    }
  });

  it('produces only URL-safe characters', () => {
    for (const state of cases) {
      expect(encodeExperiment(state)).toMatch(/^[A-Za-z0-9_-]*$/);
    }
  });

  it('is canonical — key order does not change the token', () => {
    const a = encodeExperiment({ engine: 'bioreactor', params: { d: 0.2, muMax: 0.9, ks: 0.2 } });
    const b = encodeExperiment({ engine: 'bioreactor', params: { ks: 0.2, muMax: 0.9, d: 0.2 } });
    expect(a).toBe(b);
  });

  it('builds a /lab/<engine>?x=<token> permalink', () => {
    const state = { engine: 'admet', params: { smiles: 'CC(=O)Oc1ccccc1C(=O)O' } };
    const path = experimentSharePath(state);
    expect(path.startsWith('/lab/admet?')).toBe(true);
    const token = new URL(`https://x${path}`).searchParams.get(SHARE_PARAM);
    expect(decodeExperiment(token)).toEqual(state);
  });

  it('builds a /lab/<engine>/overlay?x=<token> OBS permalink', () => {
    const state = { engine: 'bioreactor', params: { mode: 'chemostat', d: 0.4 } };
    const path = experimentOverlayPath(state);
    expect(path.startsWith('/lab/bioreactor/overlay?')).toBe(true);
    const token = new URL(`https://x${path}`).searchParams.get(SHARE_PARAM);
    expect(decodeExperiment(token)).toEqual(state);
  });

  it('returns null for malformed / empty / wrongly-shaped tokens', () => {
    expect(decodeExperiment(null)).toBeNull();
    expect(decodeExperiment(undefined)).toBeNull();
    expect(decodeExperiment('')).toBeNull();
    expect(decodeExperiment('!!!not base64!!!')).toBeNull();
    expect(decodeExperiment('a'.repeat(9000))).toBeNull();
    // valid base64url JSON, but not an experiment shape
    expect(decodeExperiment(encodeArbitrary({ e: 42 }))).toBeNull();
    expect(decodeExperiment(encodeArbitrary({ e: 'x', p: [1, 2] }))).toBeNull();
    expect(decodeExperiment(encodeArbitrary({ e: '', p: {} }))).toBeNull();
    expect(decodeExperiment(encodeArbitrary('just a string'))).toBeNull();
  });
});

/** Encode any JSON value the way the codec does, to test decode-side guards. */
function encodeArbitrary(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return Buffer.from(binary, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
