import { describe, expect, it, vi } from 'vitest';

import { createFormalSessionApi } from './api';
import {
  NOW,
  SESSION_A,
  activeFixture,
  lifecycleFixture,
  plannedResultFixture,
} from './test-fixtures';

function success(data: unknown) {
  return {
    apiVersion: 'v1',
    data,
    meta: {
      requestId: 'req_123456789',
      respondedAt: NOW,
    },
  };
}

describe('formal Session API client', () => {
  it('validates active, planning, and lifecycle responses at the trust boundary', async () => {
    const requester = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: success(activeFixture()) })
      .mockResolvedValueOnce({ ok: true, value: success(plannedResultFixture()) })
      .mockResolvedValueOnce({ ok: true, value: success(lifecycleFixture('in_progress')) })
      .mockResolvedValueOnce({ ok: true, value: success(lifecycleFixture('completed')) })
      .mockResolvedValueOnce({ ok: true, value: success(lifecycleFixture('abandoned')) });
    const api = createFormalSessionApi(requester);

    await expect(api.getActive()).resolves.toMatchObject({
      ok: true,
      value: { availability: 'active' },
    });
    await expect(
      api.plan({
        schemaVersion: 'session-plan-request-v2',
        clientSessionId: '21000000-0000-4000-8000-000000000001',
        idempotencyKey: 'session-plan:test:0001',
        intent: 'learn',
        targetMinutes: 10,
      }),
    ).resolves.toMatchObject({ ok: true, value: { result: 'planned' } });
    await expect(
      api.start(SESSION_A, {
        schemaVersion: 'session-lifecycle-request-v1',
        idempotencyKey: 'session-start:test:0001',
      }),
    ).resolves.toMatchObject({ ok: true, value: { status: 'in_progress' } });
    await expect(
      api.complete(SESSION_A, {
        schemaVersion: 'session-lifecycle-request-v1',
        idempotencyKey: 'session-complete:test:0001',
      }),
    ).resolves.toMatchObject({ ok: true, value: { status: 'completed' } });
    await expect(
      api.abandon(SESSION_A, {
        schemaVersion: 'session-lifecycle-request-v1',
        idempotencyKey: 'session-abandon:test:0001',
        reasonCode: 'user_requested',
      }),
    ).resolves.toMatchObject({ ok: true, value: { status: 'abandoned' } });

    expect(requester.mock.calls.map(([path]) => path)).toEqual([
      '/api/sessions/active',
      '/api/session-plan',
      `/api/sessions/${SESSION_A}/start`,
      `/api/sessions/${SESSION_A}/complete`,
      `/api/sessions/${SESSION_A}/abandon`,
    ]);
  });

  it('fails closed when the server returns a malformed snapshot', async () => {
    const api = createFormalSessionApi(async () => ({
      ok: true,
      value: success({ schemaVersion: 'active-session-v1', availability: 'active' }),
    }));
    await expect(api.getActive()).resolves.toEqual({
      ok: false,
      status: 502,
      code: 'response_contract_invalid',
    });
  });
});
