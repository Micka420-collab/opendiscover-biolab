/**
 * Zod schema → form-field description, for the `/lab/[engine]` playground.
 *
 * Every `EngineSpec.paramsSchema` is a `z.object(...)`, sometimes wrapped in
 * `.strict()` / `.refine(...)`. This walks that schema (unwrapping
 * `ZodEffects`/`ZodDefault`/`ZodOptional`/`ZodNullable`) and produces one
 * `ParamField` per top-level key so a UI can render a typed control instead of
 * a raw textarea. Anything with a shape too irregular for a scalar control
 * (arrays, nested objects, unions, ...) degrades to a `json` field, which is
 * always a safe, lossless fallback since `execute` re-validates on submit.
 */

import { z } from 'zod';

export type ParamFieldKind = 'number' | 'string' | 'boolean' | 'enum' | 'json';

export interface ParamField {
  name: string;
  kind: ParamFieldKind;
  optional: boolean;
  default?: unknown;
  description?: string;
  enumValues?: string[];
  min?: number;
  max?: number;
  integer?: boolean;
}

/** Peel `ZodEffects` (refine/transform/preprocess) down to its source schema. */
function unwrapEffects(schema: z.ZodTypeAny): z.ZodTypeAny {
  let current = schema;
  while (current._def.typeName === z.ZodFirstPartyTypeKind.ZodEffects) {
    current = (current as z.ZodEffects<z.ZodTypeAny>)._def.schema;
  }
  return current;
}

/** Peel `ZodOptional` / `ZodNullable` / `ZodDefault`, tracking optionality + default. */
function unwrapField(schema: z.ZodTypeAny): {
  inner: z.ZodTypeAny;
  optional: boolean;
  default?: unknown;
} {
  let current = schema;
  let optional = false;
  let defaultValue: unknown;
  for (;;) {
    const typeName = current._def.typeName;
    if (typeName === z.ZodFirstPartyTypeKind.ZodOptional) {
      optional = true;
      current = (current as z.ZodOptional<z.ZodTypeAny>)._def.innerType;
    } else if (typeName === z.ZodFirstPartyTypeKind.ZodNullable) {
      optional = true;
      current = (current as z.ZodNullable<z.ZodTypeAny>)._def.innerType;
    } else if (typeName === z.ZodFirstPartyTypeKind.ZodDefault) {
      const def = current as z.ZodDefault<z.ZodTypeAny>;
      defaultValue = def._def.defaultValue();
      current = def._def.innerType;
    } else {
      break;
    }
  }
  return { inner: current, optional, default: defaultValue };
}

function describeOne(name: string, rawSchema: z.ZodTypeAny): ParamField {
  const { inner, optional, default: defaultValue } = unwrapField(rawSchema);
  const description = rawSchema.description ?? inner.description;
  const base = { name, optional, default: defaultValue, description };

  switch (inner._def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodNumber: {
      const checks = (inner as z.ZodNumber)._def.checks;
      let min: number | undefined;
      let max: number | undefined;
      let integer = false;
      for (const check of checks) {
        if (check.kind === 'min')
          min = min === undefined ? check.value : Math.max(min, check.value);
        if (check.kind === 'max')
          max = max === undefined ? check.value : Math.min(max, check.value);
        if (check.kind === 'int') integer = true;
      }
      return { ...base, kind: 'number', min, max, integer };
    }
    case z.ZodFirstPartyTypeKind.ZodString:
      return { ...base, kind: 'string' };
    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return { ...base, kind: 'boolean' };
    case z.ZodFirstPartyTypeKind.ZodEnum:
      return {
        ...base,
        kind: 'enum',
        enumValues: [...(inner as z.ZodEnum<[string, ...string[]]>)._def.values],
      };
    default:
      return { ...base, kind: 'json' };
  }
}

/**
 * Describe a params schema as a list of form fields, in declaration order.
 * Returns `[]` if the schema isn't a top-level object (nothing to walk).
 */
export function describeParamsForForm(schema: z.ZodTypeAny): ParamField[] {
  const objectSchema = unwrapEffects(schema);
  if (objectSchema._def.typeName !== z.ZodFirstPartyTypeKind.ZodObject) return [];
  const shape = (objectSchema as z.ZodObject<z.ZodRawShape>).shape;
  return Object.entries(shape).map(([name, fieldSchema]) => describeOne(name, fieldSchema));
}
