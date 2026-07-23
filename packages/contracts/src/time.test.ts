import { describe, expect, it } from 'vitest';

import { IsoDateSchema, IsoDateTimeSchema, UtcDateTimeSchema } from './time.ts';

describe('time contracts', () => {
  it('accepts normalized UTC and offset timestamps', () => {
    expect(UtcDateTimeSchema.parse('2026-07-22T18:00:00Z')).toBe('2026-07-22T18:00:00Z');
    expect(IsoDateTimeSchema.parse('2026-07-22T20:00:00+02:00')).toBe('2026-07-22T20:00:00+02:00');
    expect(IsoDateSchema.parse('2026-07-22')).toBe('2026-07-22');
  });

  it.each([
    ['UTC timestamp without timezone', UtcDateTimeSchema, '2026-07-22T18:00:00'],
    ['UTC timestamp with an offset', UtcDateTimeSchema, '2026-07-22T20:00:00+02:00'],
    ['impossible date', IsoDateSchema, '2026-02-30'],
  ])('rejects an invalid %s', (_label, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});
