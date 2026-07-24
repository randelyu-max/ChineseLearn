import type { FormalSessionApi } from '../formal-session/api';
import type { FormalOutboxSyncResult } from '../formal-session/sync';
import { createWebOfflineStore } from '../offline-storage/web-store';
import { describe, expect, it, vi } from 'vitest';

import { enterLearnSession } from './learn-entry';
import {
  RUNNER_NOW,
  RUNNER_SESSION_ID,
  RUNNER_USER_ID,
  runnerActiveData,
  runnerSession,
} from './test-fixtures';

const synced: FormalOutboxSyncResult = {
  accepted: 0,
  duplicate: 0,
  pending: 0,
  preservedRejected: 0,
  scoringMismatches: 0,
  status: 'idle',
};

function memoryStore() {
  const values = new Map<string, string>();
  return createWebOfflineStore({
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  });
}

function plannedResult() {
  const active = runnerActiveData('planned');
  if (active.availability !== 'active') throw new Error('Expected active fixture.');
  if (active.session.snapshot.plan.schemaVersion !== 'session-plan-snapshot-v2') {
    throw new Error('Expected a V2 plan fixture.');
  }
  return {
    schemaVersion: 'session-plan-result-v2' as const,
    result: 'planned' as const,
    session: {
      sessionId: active.session.header.sessionId,
      clientSessionId: active.session.header.clientSessionId,
      status: 'planned' as const,
      createdAt: active.session.header.createdAt,
      snapshot: active.session.snapshot.plan,
    },
  };
}

function api(overrides: Partial<FormalSessionApi> = {}): FormalSessionApi {
  return {
    abandon: vi.fn(),
    complete: vi.fn(),
    getActive: vi.fn(async () => ({
      ok: true as const,
      value: {
        schemaVersion: 'active-session-v1' as const,
        availability: 'none' as const,
        session: null,
      },
    })),
    plan: vi.fn(async () => ({ ok: true as const, value: plannedResult() })),
    start: vi.fn(async () => ({
      ok: true as const,
      value: {
        schemaVersion: 'session-lifecycle-v1' as const,
        sessionId: RUNNER_SESSION_ID,
        status: 'in_progress' as const,
        startedAt: RUNNER_NOW,
        completedAt: null,
        abandonedAt: null,
        abandonedReason: null,
      },
    })),
    ...overrides,
  };
}

describe('learn entry orchestration', () => {
  it('creates, caches, starts, and returns a formal learn Session', async () => {
    const store = memoryStore();
    await store.initialize();
    const service = api();
    await expect(
      enterLearnSession({
        api: service,
        clientSessionId: () => '54000000-0000-4000-8000-000000000001',
        idempotencyKey: () => 'mobile-plan:test:0001',
        isOnline: true,
        nowIso: RUNNER_NOW,
        store,
        sync: vi.fn(async () => synced),
        targetMinutes: 10,
        userId: RUNNER_USER_ID,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      offline: false,
      session: { status: 'in_progress', sessionId: RUNNER_SESSION_ID },
    });
    expect(service.plan).toHaveBeenCalledOnce();
    expect(service.start).toHaveBeenCalledOnce();
    await expect(store.getActiveFormalSession(RUNNER_USER_ID)).resolves.toMatchObject({
      status: 'in_progress',
    });
  });

  it('resumes an in-progress cached Session without network or a new plan', async () => {
    const store = memoryStore();
    await store.initialize();
    await store.saveFormalSession(runnerSession());
    const service = api();
    await expect(
      enterLearnSession({
        api: service,
        clientSessionId: vi.fn(),
        idempotencyKey: vi.fn(),
        isOnline: false,
        nowIso: RUNNER_NOW,
        store,
        sync: vi.fn(async () => synced),
        targetMinutes: 10,
        userId: RUNNER_USER_ID,
      }),
    ).resolves.toMatchObject({ status: 'ready', offline: true });
    expect(service.getActive).not.toHaveBeenCalled();
    expect(service.plan).not.toHaveBeenCalled();
  });

  it('requires network for a cached planned Session', async () => {
    const store = memoryStore();
    await store.initialize();
    await store.saveFormalSession(runnerSession('planned'));
    await expect(
      enterLearnSession({
        api: api(),
        clientSessionId: vi.fn(),
        idempotencyKey: vi.fn(),
        isOnline: false,
        nowIso: RUNNER_NOW,
        store,
        sync: vi.fn(async () => synced),
        targetMinutes: 10,
        userId: RUNNER_USER_ID,
      }),
    ).resolves.toEqual({ status: 'error', code: 'network_required' });
  });

  it('fails closed on an expired authenticated API Session', async () => {
    const store = memoryStore();
    await store.initialize();
    await expect(
      enterLearnSession({
        api: api({
          getActive: vi.fn(async () => ({
            ok: false as const,
            status: 401,
            code: 'UNAUTHENTICATED',
          })),
        }),
        clientSessionId: vi.fn(),
        idempotencyKey: vi.fn(),
        isOnline: true,
        nowIso: RUNNER_NOW,
        store,
        sync: vi.fn(async () => synced),
        targetMinutes: 10,
        userId: RUNNER_USER_ID,
      }),
    ).resolves.toEqual({ status: 'error', code: 'auth_expired' });
  });
});
