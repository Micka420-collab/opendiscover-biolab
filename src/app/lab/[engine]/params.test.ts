import type { ParamField } from '@/lib/sim';
import { describe, expect, it } from 'vitest';
import { buildParams } from './params';

const numberField = (name: string, optional: boolean): ParamField => ({
  name,
  label: name,
  kind: 'number',
  optional,
  integer: false,
});

describe('buildParams', () => {
  it('omits a cleared OPTIONAL number field so the engine default applies (regression)', () => {
    const fields = [numberField('tol', true)];
    // A cleared number input arrives as '' (fixed onChange) or NaN (raw valueAsNumber).
    expect(buildParams(fields, { tol: '' })).toEqual({ params: {} });
    expect(buildParams(fields, { tol: Number.NaN })).toEqual({ params: {} });
  });

  it('still errors when a REQUIRED number field is left blank', () => {
    const fields = [numberField('dose', false)];
    expect(buildParams(fields, { dose: '' }).error).toMatch(/must be a number/);
    expect(buildParams(fields, { dose: Number.NaN }).error).toMatch(/must be a number/);
  });

  it('passes a valid number through (string or number form)', () => {
    const fields = [numberField('x', true)];
    expect(buildParams(fields, { x: 5 })).toEqual({ params: { x: 5 } });
    expect(buildParams(fields, { x: '2.5' })).toEqual({ params: { x: 2.5 } });
  });

  it('handles enum, boolean and json fields, and reports invalid JSON', () => {
    const fields: ParamField[] = [
      { name: 'mode', label: 'mode', kind: 'enum', optional: false, options: ['a', 'b'] },
      { name: 'flag', label: 'flag', kind: 'boolean', optional: true },
      { name: 'cfg', label: 'cfg', kind: 'json', optional: true },
    ];
    expect(buildParams(fields, { mode: 'b', flag: true, cfg: '{"k":1}' })).toEqual({
      params: { mode: 'b', flag: true, cfg: { k: 1 } },
    });
    expect(buildParams(fields, { mode: 'a', cfg: '{oops' }).error).toMatch(/valid JSON/);
    // An empty non-number field is simply omitted.
    expect(buildParams(fields, { mode: '' })).toEqual({ params: {} });
  });
});
