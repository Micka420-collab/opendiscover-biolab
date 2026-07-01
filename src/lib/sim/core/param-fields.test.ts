import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { paramsSchema as bioreactorParams } from '../bioprocess/bioreactor';
import { spec as pcrSpec } from '../molbio/pcr';
import { describeParamFields } from './param-fields';

const pcrParams = pcrSpec.paramsSchema;

describe('describeParamFields', () => {
  it('classifies number, string, boolean, and enum fields with defaults/bounds', () => {
    const schema = z.object({
      mode: z.enum(['batch', 'fedbatch', 'chemostat']).default('batch'),
      muMax: z.number().positive().default(0.4).describe('Maximum specific growth rate (1/h)'),
      steps: z.number().int().min(1).max(100).default(10),
      name: z.string().min(1).optional(),
      verbose: z.boolean().default(false),
    });

    const fields = describeParamFields(schema);
    expect(fields.map((f) => f.name)).toEqual(['mode', 'muMax', 'steps', 'name', 'verbose']);

    expect(fields[0]).toMatchObject({
      kind: 'enum',
      options: ['batch', 'fedbatch', 'chemostat'],
      default: 'batch',
      optional: true,
    });
    expect(fields[1]).toMatchObject({
      kind: 'number',
      default: 0.4,
      min: 0,
      optional: true,
      description: 'Maximum specific growth rate (1/h)',
    });
    expect(fields[2]).toMatchObject({
      kind: 'number',
      default: 10,
      min: 1,
      max: 100,
      integer: true,
    });
    expect(fields[3]).toMatchObject({ kind: 'string', default: undefined, optional: true });
    expect(fields[4]).toMatchObject({ kind: 'boolean', default: false, optional: true });
  });

  it('marks a field with no `.optional()`/`.default()` as required', () => {
    const schema = z.object({ template: z.string().min(1) });
    const [field] = describeParamFields(schema);
    expect(field).toMatchObject({ kind: 'string', optional: false, default: undefined });
  });

  it('falls back to `json` for arrays, objects, and unions it cannot render as a control', () => {
    const schema = z.object({
      tags: z.array(z.number()).default([1, 2, 3]),
      nested: z.object({ a: z.number() }).optional(),
      seed: z.union([z.number(), z.string()]).default('run-1'),
    });
    const fields = describeParamFields(schema);
    expect(fields).toEqual([
      {
        name: 'tags',
        label: 'Tags',
        description: undefined,
        optional: true,
        kind: 'json',
        default: [1, 2, 3],
      },
      {
        name: 'nested',
        label: 'Nested',
        description: undefined,
        optional: true,
        kind: 'json',
        default: undefined,
      },
      {
        name: 'seed',
        label: 'Seed',
        description: undefined,
        optional: true,
        kind: 'json',
        default: 'run-1',
      },
    ]);
  });

  it('humanizes camelCase names into label-cased words', () => {
    const schema = z.object({ muMax: z.number().default(1), yxs: z.number().default(1) });
    const fields = describeParamFields(schema);
    expect(fields[0].label).toBe('Mu max');
    expect(fields[1].label).toBe('Yxs');
  });

  it('unwraps an object-level `.refine()` to reach the underlying shape', () => {
    const schema = z
      .object({ a: z.number().default(1), b: z.number().optional() })
      .refine((v) => v.a !== undefined || v.b !== undefined);
    const fields = describeParamFields(schema);
    expect(fields.map((f) => f.name)).toEqual(['a', 'b']);
  });

  it('returns [] for a non-object schema', () => {
    expect(describeParamFields(z.number())).toEqual([]);
  });

  it('reads the real bioreactor engine schema: mode enum + muMax number bounds', () => {
    const fields = describeParamFields(bioreactorParams);
    const mode = fields.find((f) => f.name === 'mode');
    expect(mode).toMatchObject({ kind: 'enum', default: 'batch' });
    expect((mode as { options: string[] }).options).toEqual(['batch', 'fedbatch', 'chemostat']);

    const muMax = fields.find((f) => f.name === 'muMax');
    expect(muMax).toMatchObject({ kind: 'number', default: 0.4, min: 0 });
  });

  it('reads the real pcr engine schema: required template, optional primers, bounded ints', () => {
    const fields = describeParamFields(pcrParams);

    expect(fields.find((f) => f.name === 'template')).toMatchObject({
      kind: 'string',
      optional: false,
    });
    expect(fields.find((f) => f.name === 'forwardPrimer')).toMatchObject({
      kind: 'string',
      optional: true,
    });
    expect(fields.find((f) => f.name === 'primerLength')).toMatchObject({
      kind: 'number',
      default: 20,
      min: 6,
      max: 60,
      integer: true,
    });
    expect(fields.find((f) => f.name === 'tmMethod')).toMatchObject({
      kind: 'enum',
      options: ['wallace', 'gc', 'nn', 'auto'],
      default: 'auto',
    });
  });
});
