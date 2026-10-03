import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

// Test-only validator for this contract's vocabulary, not a general JSON Schema engine.
export const contract = load(readFileSync(new URL('../../openapi/public-api.yaml', import.meta.url), 'utf8')) as any;
const supported = new Set([
  '$ref', 'type', 'required', 'properties', 'items', 'enum', 'const', 'anyOf',
  'format', 'minimum', 'maximum', 'default', 'description', 'example',
]);

export function checkSchema(schema: any): void {
  for (const keyword of Object.keys(schema)) {
    assert.ok(supported.has(keyword), `Unsupported contract keyword: ${keyword}; extend validation first`);
  }
  if (schema.$ref) resolve(schema.$ref);
  if (schema.type) {
    for (const type of [schema.type].flat()) assert.ok(['object', 'array', 'string', 'integer', 'null'].includes(type));
  }
  if (schema.format) assert.ok(['date-time', 'uri'].includes(schema.format), `Unsupported format: ${schema.format}`);
  for (const key of schema.required ?? []) assert.ok(key in schema.properties, `Undefined required property: ${key}`);
  for (const child of Object.values(schema.properties ?? {})) checkSchema(child);
  if (schema.items) checkSchema(schema.items);
  for (const child of schema.anyOf ?? []) checkSchema(child);
}

function resolve(ref: string): any {
  assert.ok(ref.startsWith('#/'), `Only local contract refs supported: ${ref}`);
  const schema = ref.slice(2).split('/').reduce((value, key) => value?.[key], contract);
  assert.ok(schema, `Unresolved contract ref: ${ref}`);
  return schema;
}

export function validate(schema: any, value: any, path = '$'): void {
  if (schema.$ref) validate(resolve(schema.$ref), value, path);
  if (schema.type) {
    const matches = (type: string) => type === 'null' ? value === null
      : type === 'array' ? Array.isArray(value)
      : type === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
      : type === 'integer' ? Number.isInteger(value) : typeof value === type;
    assert.ok([schema.type].flat().some(matches), `${path}: expected ${schema.type}`);
  }
  if (schema.enum) assert.ok(schema.enum.includes(value), `${path}: unexpected enum value`);
  if ('const' in schema) assert.equal(value, schema.const, `${path}: const`);
  if (schema.anyOf) {
    assert.ok(schema.anyOf.some((child: any) => {
      try { validate(child, value, path); return true; } catch { return false; }
    }), `${path}: no matching alternative`);
  }
  if (typeof value === 'string' && schema.format === 'date-time') {
    assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i, `${path}: timestamp`);
    assert.ok(Number.isFinite(Date.parse(value)), `${path}: invalid timestamp`);
  }
  if (typeof value === 'string' && schema.format === 'uri') {
    assert.doesNotThrow(() => new URL(value), `${path}: absolute URI`);
  }
  if (schema.minimum !== undefined) assert.ok(value >= schema.minimum, `${path}: minimum`);
  if (schema.maximum !== undefined) assert.ok(value <= schema.maximum, `${path}: maximum`);
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) assert.ok(Object.hasOwn(value, key), `${path}.${key}: required`);
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) validate(child, value[key], `${path}.${key}`);
    }
  }
  if (Array.isArray(value) && schema.items) value.forEach((item, i) => validate(schema.items, item, `${path}[${i}]`));
}

export function responseSchema(path: string, status = 200): any {
  const schema = contract.paths[path]?.get.responses[status]?.content['application/json'].schema;
  assert.ok(schema, `Undocumented response: GET ${path} ${status}`);
  return schema;
}
