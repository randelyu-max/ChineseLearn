import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApiSuccessResponseSchema } from './response.ts';

const ExampleDataSchema = z.object({ value: z.string().min(1) }).strict();
const ExampleResponseSchema = createApiSuccessResponseSchema(ExampleDataSchema);

describe('success response contracts', () => {
  it('parses a versioned success response', () => {
    expect(
      ExampleResponseSchema.parse({
        apiVersion: 'v1',
        data: { value: 'ready' },
        meta: {
          requestId: 'req_01J4Z6M3V6D8Q9W1K2Y7',
          respondedAt: '2026-07-22T18:00:00Z',
        },
      }),
    ).toEqual({
      apiVersion: 'v1',
      data: { value: 'ready' },
      meta: {
        requestId: 'req_01J4Z6M3V6D8Q9W1K2Y7',
        respondedAt: '2026-07-22T18:00:00Z',
      },
    });
  });

  it('normalizes a legacy success response that omitted apiVersion', () => {
    const parsed = ExampleResponseSchema.parse({
      data: { value: 'ready' },
      meta: {
        requestId: 'req_01J4Z6M3V6D8Q9W1K2Y7',
        respondedAt: '2026-07-22T18:00:00Z',
      },
    });

    expect(parsed.apiVersion).toBe('v1');
  });

  it.each([
    ['invalid payload', { apiVersion: 'v1', data: { value: '' }, meta: {} }],
    [
      'unknown field',
      {
        apiVersion: 'v1',
        data: { value: 'ready' },
        meta: {
          requestId: 'req_01J4Z6M3V6D8Q9W1K2Y7',
          respondedAt: '2026-07-22T18:00:00Z',
        },
        unexpected: true,
      },
    ],
  ])('rejects an %s', (_label, value) => {
    expect(ExampleResponseSchema.safeParse(value).success).toBe(false);
  });
});
