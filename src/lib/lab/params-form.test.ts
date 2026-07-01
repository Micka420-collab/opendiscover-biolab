import { spec as bioreactor } from '@/lib/sim/bioprocess/bioreactor';
import { spec as admet } from '@/lib/sim/drug/admet';
import { spec as doseResponse } from '@/lib/sim/drug/dose-response';
import { spec as grn } from '@/lib/sim/systems/grn';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { describeParamsForForm } from './params-form';

describe('describeParamsForForm', () => {
  it('describes a plain .strict() object schema (bioreactor)', () => {
    const fields = describeParamsForForm(bioreactor.paramsSchema);
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));

    expect(byName.mode).toMatchObject({
      kind: 'enum',
      enumValues: ['batch', 'fedbatch', 'chemostat'],
      default: 'batch',
      optional: false,
    });
    expect(byName.muMax).toMatchObject({ kind: 'number', default: 0.4, integer: false });
    expect(byName.muMax.min).toBeCloseTo(0, 10);
    expect(byName.outputPoints).toMatchObject({ kind: 'number', default: 300, integer: true });
    expect(byName.seed).toMatchObject({ kind: 'number', default: 12345 });
  });

  it('unwraps min/max bounds from chained checks (dose-response numPoints)', () => {
    const fields = describeParamsForForm(doseResponse.paramsSchema);
    const numPoints = fields.find((f) => f.name === 'numPoints');
    expect(numPoints).toMatchObject({
      kind: 'number',
      min: 2,
      max: 2000,
      default: 49,
      integer: true,
    });

    const combo = fields.find((f) => f.name === 'combo');
    expect(combo).toMatchObject({ kind: 'json', optional: true });
  });

  it('unwraps a .refine()-wrapped schema down to its object shape (grn)', () => {
    const fields = describeParamsForForm(grn.paramsSchema);
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));

    expect(byName.preset).toMatchObject({ kind: 'enum', optional: true });
    expect(byName.preset?.enumValues).toEqual(['repressilator', 'toggleSwitch', 'feedForwardLoop']);
    expect(byName.tMax).toMatchObject({ kind: 'number', default: 100, optional: false });
    // `network` is a nested object schema — no scalar control exists for it.
    expect(byName.network).toMatchObject({ kind: 'json', optional: true });
  });

  it('unwraps a doubly-refined schema (admet) and falls back to json for union-ish fields', () => {
    const fields = describeParamsForForm(admet.paramsSchema);
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));

    expect(byName.smiles).toMatchObject({ kind: 'string', optional: true });
    expect(byName.descriptors).toMatchObject({ kind: 'json', optional: true });
  });

  it('returns [] for a non-object schema instead of throwing', () => {
    expect(describeParamsForForm(z.number())).toEqual([]);
  });
});
