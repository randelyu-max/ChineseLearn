import { describe, expect, it } from 'vitest';

import {
  API_VERSION,
  ApiVersionSchema,
  SchemaVersionSchema,
  SemanticVersionSchema,
  VersionTagSchema,
} from './version.ts';

describe('version contracts', () => {
  it('accepts current API, semantic, schema, and domain version forms', () => {
    expect(ApiVersionSchema.parse(API_VERSION)).toBe('v1');
    expect(SemanticVersionSchema.parse('1.2.3-beta.1+build.5')).toBe('1.2.3-beta.1+build.5');
    expect(SchemaVersionSchema.parse('error-v1')).toBe('error-v1');
    expect(VersionTagSchema.parse('mandarin-simplified-1.0.0')).toBe('mandarin-simplified-1.0.0');
  });

  it.each([
    ['unknown API version', ApiVersionSchema, 'v2'],
    ['incomplete semantic version', SemanticVersionSchema, '1.0'],
    ['uppercase version tag', VersionTagSchema, 'Planner-1.0'],
    ['schema version without a positive number', SchemaVersionSchema, 'error-v0'],
  ])('rejects an invalid %s', (_label, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});
