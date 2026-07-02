/**
 * Pure form-param helpers for the engine playground — seeding initial values from
 * an engine's example/defaults and turning the form state back into a params object
 * for a run. Kept free of React so they can be unit-tested directly (the playground
 * component imports them).
 */

import type { ParamField } from '@/lib/sim';

export type FieldValue = string | number | boolean;

/**
 * Seed form state from the engine's documented example, falling back to each field's
 * own default. An `override` (from a shared/remixed permalink) takes precedence over
 * both. `json`-kind fields are kept as pretty-printed text.
 */
export function initialValues(
  fields: ParamField[],
  example: unknown,
  override?: Record<string, unknown>,
): Record<string, FieldValue> {
  const ex = (example as Record<string, unknown>) ?? {};
  const ov = override ?? {};
  const values: Record<string, FieldValue> = {};
  for (const field of fields) {
    const raw =
      field.name in ov ? ov[field.name] : field.name in ex ? ex[field.name] : field.default;
    if (raw === undefined) continue;
    if (field.kind === 'json') {
      values[field.name] = JSON.stringify(raw, null, 2);
    } else {
      values[field.name] = raw as FieldValue;
    }
  }
  return values;
}

/**
 * Turn form state into engine params. A blank/non-numeric NUMBER field is OMITTED
 * when the field is optional (so the engine's own default applies) but reported as
 * an error when the field is required — so clearing an optional knob never blocks a
 * run, while a required knob left empty is still caught.
 */
export function buildParams(
  fields: ParamField[],
  values: Record<string, FieldValue>,
): { params: Record<string, unknown>; error?: string } {
  const params: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.name];
    if (raw === undefined) continue;

    if (field.kind === 'number') {
      // Cleared input arrives as '' (from the onChange) or NaN (empty valueAsNumber).
      const blank = raw === '' || (typeof raw === 'number' && Number.isNaN(raw));
      const n = blank ? Number.NaN : Number(raw);
      if (Number.isNaN(n)) {
        if (field.optional) continue; // omit → engine default applies
        return { params, error: `"${field.label}" must be a number` };
      }
      params[field.name] = n;
      continue;
    }

    if (raw === '') continue; // empty non-number → omit

    if (field.kind === 'boolean') {
      params[field.name] = Boolean(raw);
    } else if (field.kind === 'json') {
      try {
        params[field.name] = JSON.parse(String(raw));
      } catch {
        return { params, error: `"${field.label}" must be valid JSON` };
      }
    } else {
      params[field.name] = raw;
    }
  }
  return { params };
}
