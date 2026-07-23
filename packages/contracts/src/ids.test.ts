import { describe, expect, it } from 'vitest';

import { IdempotencyKeySchema, RequestIdSchema, UuidSchema } from './ids.ts';

describe('identifier contracts', () => {
  it('accepts canonical identifiers', () => {
    expect(UuidSchema.parse('550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(RequestIdSchema.parse('req_01J4Z6M3V6D8Q9W1K2Y7')).toBe('req_01J4Z6M3V6D8Q9W1K2Y7');
    expect(
      IdempotencyKeySchema.parse('session-plan:550e8400-e29b-41d4-a716-446655440000'),
    ).toContain('session-plan:');
  });

  it.each([
    ['uuid', UuidSchema, 'not-a-uuid'],
    ['request ID without prefix', RequestIdSchema, '01J4Z6M3V6D8Q9W1K2Y7'],
    ['request ID with spaces', RequestIdSchema, 'req_not allowed'],
    ['short idempotency key', IdempotencyKeySchema, 'too-short'],
  ])('rejects an invalid %s', (_label, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});
