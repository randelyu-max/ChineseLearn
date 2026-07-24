import { describe, expect, it } from 'vitest';

import {
  ActiveSessionDataSchema,
  SessionAbandonRequestSchema,
  SessionLifecycleRequestSchema,
  SessionLifecycleStateSchema,
} from './session-lifecycle.ts';

const sessionId = '60000000-0000-4000-8000-000000000001';

describe('session lifecycle contracts', () => {
  it('accepts ownership-free idempotent mutation requests', () => {
    const request = {
      schemaVersion: 'session-lifecycle-request-v1',
      idempotencyKey: 'session-lifecycle:60000000-0000-4000-8000-000000000001',
    };
    expect(SessionLifecycleRequestSchema.parse(request)).toEqual(request);
    expect(SessionLifecycleRequestSchema.safeParse({ ...request, userId: sessionId }).success).toBe(
      false,
    );
    expect(
      SessionAbandonRequestSchema.safeParse({ ...request, reasonCode: 'user_requested' }).success,
    ).toBe(true);
  });

  it('enforces lifecycle timestamp coherence', () => {
    const base = {
      schemaVersion: 'session-lifecycle-v1',
      sessionId,
      abandonedReason: null,
    } as const;
    expect(
      SessionLifecycleStateSchema.safeParse({
        ...base,
        status: 'in_progress',
        startedAt: '2026-07-24T10:00:00.000Z',
        completedAt: null,
        abandonedAt: null,
      }).success,
    ).toBe(true);
    expect(
      SessionLifecycleStateSchema.safeParse({
        ...base,
        status: 'completed',
        startedAt: null,
        completedAt: '2026-07-24T10:05:00.000Z',
        abandonedAt: null,
      }).success,
    ).toBe(false);
  });

  it('returns an explicit none state instead of a missing resource error', () => {
    expect(
      ActiveSessionDataSchema.parse({
        schemaVersion: 'active-session-v1',
        availability: 'none',
        session: null,
      }),
    ).toEqual({
      schemaVersion: 'active-session-v1',
      availability: 'none',
      session: null,
    });
  });
});
