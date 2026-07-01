/**
 * Zod schema → form-field descriptors.
 *
 * Every engine documents its parameters as a Zod schema (see `EngineSpec.paramsSchema`
 * in `./types`). This module introspects that schema into a flat list of
 * `ParamField`s so a generic UI (or an AI tool-call form) can render one input per
 * parameter without engine-specific code. Anything the introspector can't map to a
 * simple control (nested objects, arrays, unions, records) falls back to `kind:
 * 'json'` — a raw JSON textarea seeded with the field's default — so every engine
 * stays usable even before its schema gets a dedicated widget.
 *
 * Pure and synchronous: same schema in, same fields out.
 */

import type { z } from 'zod';

interface ParamFieldBase {
  name: string;
  /** Humanized label derived from the field name (e.g. "muMax" -> "Mu max"). */
  label: string;
  description?: string;
  /** True if the field can be omitted (optional or has a default). */
  optional: boolean;
}

export interface NumberParamField extends ParamFieldBase {
  kind: 'number';
  default?: number;
  min?: number;
  max?: number;
  integer?: boolean;
}

export interface StringParamField extends ParamFieldBase {
  kind: 'string';
  default?: string;
}

export interface BooleanParamField extends ParamFieldBase {
  kind: 'boolean';
  default?: boolean;
}

export interface EnumParamField extends ParamFieldBase {
  kind: 'enum';
  options: string[];
  default?: string;
}

/** Fallback for anything not covered above: object, array, union, record, ... */
export interface JsonParamField extends ParamFieldBase {
  kind: 'json';
  default?: unknown;
}

export type ParamField =
  | NumberParamField
  | StringParamField
  | BooleanParamField
  | EnumParamField
  | JsonParamField;

// Zod's `_def` internals aren't part of its public type surface, but walking them
// is the only way to introspect a schema generically. Isolated to this file.
// biome-ignore lint/suspicious/noExplicitAny: see above
type ZodInternal = z.ZodTypeAny & { _def: any };

interface Unwrapped {
  inner: ZodInternal;
  /** Present iff the chain contained a `.default(...)`. */
  hasDefault: boolean;
  defaultValue?: unknown;
  description?: string;
}

/** Peel `.default()` / `.optional()` / `.nullable()` / `.refine()` / `.transform()`
 * wrappers off a schema, keeping the outermost `.describe()` text and default
 * value encountered along the way. */
function unwrap(schema: ZodInternal): Unwrapped {
  let s: ZodInternal = schema;
  let hasDefault = false;
  let defaultValue: unknown;
  let description: string | undefined = schema.description;

  for (;;) {
    if (description === undefined) description = s.description;
    const typeName = s._def.typeName;
    if (typeName === 'ZodDefault') {
      hasDefault = true;
      defaultValue = s._def.defaultValue();
      s = s._def.innerType;
      continue;
    }
    if (typeName === 'ZodOptional' || typeName === 'ZodNullable') {
      s = s._def.innerType;
      continue;
    }
    if (typeName === 'ZodEffects') {
      s = s._def.schema;
      continue;
    }
    break;
  }
  return { inner: s, hasDefault, defaultValue, description };
}

function humanize(name: string): string {
  const spaced = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function toField(name: string, fieldSchema: ZodInternal): ParamField {
  const { inner, hasDefault, defaultValue, description } = unwrap(fieldSchema);
  const base: ParamFieldBase = {
    name,
    label: humanize(name),
    description,
    optional: fieldSchema.isOptional() as boolean,
  };

  switch (inner._def.typeName) {
    case 'ZodNumber': {
      const checks = (inner._def.checks ?? []) as Array<{ kind: string; value?: number }>;
      const min = checks.find((c) => c.kind === 'min')?.value;
      const max = checks.find((c) => c.kind === 'max')?.value;
      const integer = checks.some((c) => c.kind === 'int');
      return {
        ...base,
        kind: 'number',
        default: hasDefault ? (defaultValue as number) : undefined,
        min,
        max,
        integer,
      };
    }
    case 'ZodBoolean':
      return {
        ...base,
        kind: 'boolean',
        default: hasDefault ? (defaultValue as boolean) : undefined,
      };
    case 'ZodEnum':
      return {
        ...base,
        kind: 'enum',
        options: [...(inner._def.values as string[])],
        default: hasDefault ? (defaultValue as string) : undefined,
      };
    case 'ZodString':
      return {
        ...base,
        kind: 'string',
        default: hasDefault ? (defaultValue as string) : undefined,
      };
    default:
      return { ...base, kind: 'json', default: hasDefault ? defaultValue : undefined };
  }
}

/**
 * Flatten an engine's `paramsSchema` into one `ParamField` per top-level key, in
 * declaration order. Returns `[]` if the schema isn't (or doesn't unwrap to) a
 * plain object — that shouldn't happen for a well-formed `EngineSpec`.
 */
export function describeParamFields(schema: z.ZodTypeAny): ParamField[] {
  let top = schema as ZodInternal;
  for (;;) {
    if (top._def.typeName === 'ZodEffects') {
      top = top._def.schema;
      continue;
    }
    break;
  }
  if (top._def.typeName !== 'ZodObject') return [];

  const shape = top._def.shape() as Record<string, ZodInternal>;
  return Object.entries(shape).map(([name, fieldSchema]) => toField(name, fieldSchema));
}
