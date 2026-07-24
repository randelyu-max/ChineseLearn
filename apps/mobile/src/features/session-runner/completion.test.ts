import type { FormalSessionApi } from '../formal-session/api';
import type { FormalOutboxSyncResult } from '../formal-session/sync';
import { createWebOfflineStore } from '../offline-storage/web-store';
import { describe, expect, it, vi } from 'vitest';

import { completeFormalSession } from './completion';
import { RUNNER_NOW, RUNNER_SESSION_ID, RUNNER_USER_ID, runnerSession } from './test-fixtures';

const synced: FormalOutboxSyncResult = {
  accepted: 4,
  duplicate: 0,
  pending: 0,
  preservedRejected: 0,
  scoringMismatches: 0,
  status: 'synced',
};

function storeFixture() {
  const values = new Map<string, string>();
  return createWebOfflineStore({
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  });
}

function apiFixture(): FormalSessionApi {
  return {
    abandon: vi.fn(),
    complete: vi.fn(async () => ({
      ok: true as const,
      value: {
        schemaVersion: 'session-lifecycle-v1' as const,
        sessionId: RUNNER_SESSION_ID,
        status: 'completed' as const,
        startedAt: RUNNER_NOW,
        completedAt: '2026-07-24T12:10:00.000Z',
        abandonedAt: null,
        abandonedReason: null,
      },
    })),
    getActive: vi.fn(),
    plan: vi.fn(),
    start: vi.fn(),
  };
}

describe('formal Session completion orchestration', () => {
  it('syncs first, completes once, and invalidates refreshed read models', async () => {
    const store = storeFixture();
    await store.initialize();
    await store.saveFormalSession(runnerSession());
    await store.setSyncCursor(`${RUNNER_USER_ID}:learn-home`, 'stale');
    await store.setSyncCursor(`${RUNNER_USER_ID}:review-center`, 'stale');
    const api = apiFixture();
    await expect(
      completeFormalSession({
        api,
        nowIso: '2026-07-24T12:10:00.000Z',
        sessionId: RUNNER_SESSION_ID,
        store,
        sync: vi.fn(async () => synced),
        userId: RUNNER_USER_ID,
      }),
    ).resolves.toMatchObject({
      status: 'completed',
      session: { status: 'completed' },
    });
    expect(api.complete).toHaveBeenCalledOnce();
    await expect(store.getSyncCursor(`${RUNNER_USER_ID}:learn-home`)).resolves.toBeNull();
    await expect(store.getSyncCursor(`${RUNNER_USER_ID}:review-center`)).resolves.toBeNull();
  });

  it('never completes while offline Attempts remain pending', async () => {
    const store = storeFixture();
    await store.initialize();
    await store.saveFormalSession(runnerSession());
    const api = apiFixture();
    await expect(
      completeFormalSession({
        api,
        nowIso: RUNNER_NOW,
        sessionId: RUNNER_SESSION_ID,
        store,
        sync: vi.fn(async (): Promise<FormalOutboxSyncResult> => ({
          ...synced,
          accepted: 0,
          pending: 1,
          status: 'unavailable',
        })),
        userId: RUNNER_USER_ID,
      }),
    ).resolves.toEqual({ status: 'sync_pending' });
    expect(api.complete).not.toHaveBeenCalled();
  });
});
