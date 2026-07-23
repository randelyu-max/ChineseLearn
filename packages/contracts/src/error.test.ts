import { describe, expect, it } from 'vitest';

import { ApiErrorResponseSchema } from './error.ts';

const currentErrorResponse = {
  apiVersion: 'v1',
  error: {
    schemaVersion: 'error-v1',
    code: 'SESSION_EXPIRED',
    message: 'This learning session has expired.',
    retryable: false,
    requestId: 'req_01J4Z6M3V6D8Q9W1K2Y7',
    childMessage: '这一关需要重新开始。',
  },
} as const;

describe('error response contracts', () => {
  it('parses the current versioned error response', () => {
    expect(ApiErrorResponseSchema.parse(currentErrorResponse)).toEqual(currentErrorResponse);
  });

  it('normalizes the legacy design response without explicit versions', () => {
    const parsed = ApiErrorResponseSchema.parse({
      error: {
        code: 'SESSION_EXPIRED',
        message: 'This learning session has expired.',
        retryable: false,
        requestId: 'req_01J4Z6M3V6D8Q9W1K2Y7',
      },
    });

    expect(parsed).toEqual({
      apiVersion: 'v1',
      error: {
        schemaVersion: 'error-v1',
        code: 'SESSION_EXPIRED',
        message: 'This learning session has expired.',
        retryable: false,
        requestId: 'req_01J4Z6M3V6D8Q9W1K2Y7',
      },
    });
  });

  it.each([
    [
      'lowercase error code',
      {
        ...currentErrorResponse,
        error: { ...currentErrorResponse.error, code: 'session_expired' },
      },
    ],
    ['unknown API version', { ...currentErrorResponse, apiVersion: 'v2' }],
    [
      'unknown error schema version',
      {
        ...currentErrorResponse,
        error: { ...currentErrorResponse.error, schemaVersion: 'error-v2' },
      },
    ],
    [
      'retry delay on a non-retryable error',
      {
        ...currentErrorResponse,
        error: { ...currentErrorResponse.error, retryAfterSeconds: 30 },
      },
    ],
    ['unknown top-level field', { ...currentErrorResponse, debug: true }],
  ])('rejects an invalid response with %s', (_label, value) => {
    expect(ApiErrorResponseSchema.safeParse(value).success).toBe(false);
  });
});
