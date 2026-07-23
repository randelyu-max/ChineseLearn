import { describe, expect, it, vi } from 'vitest';

import { createSessionSnapshot } from './model';
import { syncPendingAttempts } from './sync';
import { createWebOfflineStore } from './web-store';

const sessionId = '80000000-0000-4000-8000-000000000001';
const attemptId = '80000000-0000-4000-8000-000000000002';
const attempt = {
  attemptId,
  activityId: '80000000-0000-4000-8000-000000000003',
  answer: { optionId: '80000000-0000-4000-8000-000000000004' },
  isCorrectClient: true,
  responseMs: 1_000,
  hintLevel: 'none',
  replayCount: 0,
  retryCount: 0,
  occurredAt: '2026-07-23T10:00:00.000Z',
  offlineSequence: 1,
} as const;

function setup() {
  const values = new Map<string, string>();
  const store = createWebOfflineStore({
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  });
  return { store, values };
}

describe('attempt outbox sync', () => {
  it('removes terminal events and persists the server cursor', async () => {
    const { store } = setup();
    await store.initialize();
    await store.saveAttemptAndSession(
      attempt,
      createSessionSnapshot(sessionId, {}, '2026-07-23T10:00:00.000Z'),
    );
    const sender = vi.fn(async () => ({
      ok: true as const,
      value: {
        apiVersion: 'v1',
        data: {
          schemaVersion: 'attempts-batch-response-v1',
          sessionId,
          results: [
            {
              attemptId,
              status: 'accepted',
              isCorrect: false,
              evidenceWeight: 0,
            },
          ],
          syncCursor: '2026-07-23T10:00:01.000Z:server-attempt',
        },
        meta: {
          requestId: 'req_123456789',
          respondedAt: '2026-07-23T10:00:01.000Z',
        },
      },
    }));
    await expect(syncPendingAttempts(store, sender)).resolves.toMatchObject({
      accepted: 1,
      pending: 0,
      status: 'synced',
    });
    expect(sender).toHaveBeenCalledOnce();
    await expect(store.listPendingAttempts()).resolves.toHaveLength(0);
    await expect(store.getSyncCursor('attempts')).resolves.toContain('server-attempt');
  });

  it('keeps events pending when the network or response contract is unavailable', async () => {
    const { store } = setup();
    await store.initialize();
    await store.saveAttemptAndSession(
      attempt,
      createSessionSnapshot(sessionId, {}, '2026-07-23T10:00:00.000Z'),
    );
    await expect(
      syncPendingAttempts(store, async () => ({
        ok: false,
        status: 0,
        code: 'network_unavailable',
      })),
    ).resolves.toMatchObject({ pending: 1, status: 'unavailable' });
    await expect(store.listPendingAttempts()).resolves.toMatchObject([{ retryCount: 1 }]);
  });
});
