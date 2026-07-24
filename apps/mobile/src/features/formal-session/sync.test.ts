import { describe, expect, it, vi } from 'vitest';

import { cacheRecordFromActiveSession } from './model';
import { syncFormalAttempts } from './sync';
import {
  NOW,
  SESSION_A,
  USER_A,
  activeFixture,
  attemptV2Fixture,
  memoryStorage,
} from './test-fixtures';
import { createWebOfflineStore } from '../offline-storage/web-store';

function response(
  status: 'accepted' | 'duplicate' | 'rejected',
  rejectionCode = 'SESSION_NOT_ACTIVE',
) {
  return {
    apiVersion: 'v1',
    data: {
      schemaVersion: 'attempts-batch-response-v2',
      sessionId: SESSION_A,
      results:
        status === 'rejected'
          ? [{ attemptId: attemptV2Fixture.attemptId, status, rejectionCode }]
          : [
              {
                attemptId: attemptV2Fixture.attemptId,
                status,
                isCorrect: false,
                evidence: [
                  {
                    conceptType: 'character',
                    conceptId: 'hanzi.water',
                    skill: 'audio_to_glyph',
                    abilityAxis: 'hanzi_recognition',
                    correct: false,
                    baseQuality: 1,
                    supportMultiplier: 1,
                    effectiveQuality: 1,
                    algorithmVersion: 'exercise-quality-v1+pinyin-evidence-v1',
                  },
                ],
              },
            ],
      syncCursor: '2026-07-24T10:03:00.000Z:attempt',
    },
    meta: { requestId: 'req_123456789', respondedAt: NOW },
  };
}

async function setup() {
  const store = createWebOfflineStore(memoryStorage());
  await store.initialize();
  const snapshot = cacheRecordFromActiveSession(USER_A, activeFixture(), NOW);
  await store.saveAttemptV2AndSession(USER_A, attemptV2Fixture, snapshot);
  return store;
}

describe('formal Attempt V2 outbox sync', () => {
  it('submits sessionActivityId batches and removes accepted or duplicate events', async () => {
    const store = await setup();
    const sender = vi.fn(async (_request: unknown) => ({
      ok: true as const,
      value: response('accepted'),
    }));
    await expect(syncFormalAttempts(store, USER_A, sender)).resolves.toMatchObject({
      accepted: 1,
      pending: 0,
      scoringMismatches: 0,
      status: 'synced',
    });
    expect(sender.mock.calls[0]?.[0]).toMatchObject({
      schemaVersion: 'attempts-batch-request-v2',
      attempts: [{ sessionActivityId: attemptV2Fixture.sessionActivityId }],
    });
    await expect(store.listPendingAttemptsV2(USER_A)).resolves.toHaveLength(0);
  });

  it('preserves server-rejected events for explicit recovery instead of losing them', async () => {
    const store = await setup();
    await expect(
      syncFormalAttempts(store, USER_A, async () => ({
        ok: true,
        value: response('rejected'),
      })),
    ).resolves.toMatchObject({ preservedRejected: 1, pending: 0, status: 'synced' });
    const exported = JSON.parse(await store.exportForRecovery()) as {
      attemptsV2: Record<string, { lastErrorCode: string; state: string }>;
    };
    expect(exported.attemptsV2[attemptV2Fixture.attemptId]).toMatchObject({
      lastErrorCode: 'SESSION_NOT_ACTIVE',
      state: 'rejected',
    });
  });

  it('keeps events pending when transport or response validation is unavailable', async () => {
    const store = await setup();
    await expect(
      syncFormalAttempts(store, USER_A, async () => ({
        ok: false,
        status: 0,
        code: 'network_unavailable',
      })),
    ).resolves.toMatchObject({ pending: 1, status: 'unavailable' });
    await expect(store.listPendingAttemptsV2(USER_A)).resolves.toMatchObject([
      { retryCount: 1, state: 'pending' },
    ]);
  });

  it('reports a safe reconciliation signal when server scoring differs', async () => {
    const store = await setup();
    const mismatch = vi.fn();
    const serverResponse = response('accepted');
    if (serverResponse.data.results[0]?.status !== 'rejected') {
      serverResponse.data.results[0]!.isCorrect = true;
    }
    await expect(
      syncFormalAttempts(
        store,
        USER_A,
        async () => ({ ok: true, value: serverResponse }),
        mismatch,
      ),
    ).resolves.toMatchObject({ scoringMismatches: 1, status: 'synced' });
    expect(mismatch).toHaveBeenCalledOnce();
  });
});
