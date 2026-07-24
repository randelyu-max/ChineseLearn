import type { ActiveSessionData, SessionLifecycleState } from '@hanziquest/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { FormalSessionApi } from './api';
import {
  FormalSessionDataError,
  cacheRecordFromActiveSession,
  cacheRecordFromPlanResult,
} from './model';
import { reconcileLifecycleState, recoverFormalSession } from './recovery';
import type { FormalOutboxSyncResult } from './sync';
import {
  NOW,
  SESSION_A,
  SESSION_B,
  USER_A,
  USER_B,
  activeFixture,
  attemptV2Fixture,
  lifecycleFixture,
  memoryStorage,
  plannedResultFixture,
} from './test-fixtures';
import { migrateWebDocument } from '../offline-storage/model';
import { createWebOfflineStore } from '../offline-storage/web-store';

const synced: FormalOutboxSyncResult = {
  accepted: 0,
  duplicate: 0,
  pending: 0,
  preservedRejected: 0,
  scoringMismatches: 0,
  status: 'idle',
};

function apiWithActive(active: ActiveSessionData): FormalSessionApi {
  return {
    abandon: vi.fn(),
    complete: vi.fn(),
    getActive: vi.fn(async () => ({ ok: true as const, value: active })),
    plan: vi.fn(),
    start: vi.fn(),
  };
}

async function storeSetup(storage = memoryStorage()) {
  const store = createWebOfflineStore(storage);
  await store.initialize();
  return { storage, store };
}

describe('formal Session cache and recovery', () => {
  it('caches a first V2 plan and recovers it after process death while offline', async () => {
    const storage = memoryStorage();
    const first = createWebOfflineStore(storage);
    await first.initialize();
    const record = cacheRecordFromPlanResult(USER_A, plannedResultFixture(), NOW);
    expect(record).not.toBeNull();
    await first.saveFormalSession(record!);

    const restarted = createWebOfflineStore(storage);
    await restarted.initialize();
    await expect(
      recoverFormalSession({
        api: apiWithActive(activeFixture()),
        isOnline: false,
        nowIso: NOW,
        store: restarted,
        sync: vi.fn(async () => synced),
        userId: USER_A,
      }),
    ).resolves.toMatchObject({
      status: 'offline_cached',
      session: { sessionId: SESSION_A, snapshotSchemaVersion: 'session-plan-snapshot-v2' },
    });
  });

  it('reconciles the same server Session without resetting local progress', async () => {
    const { store } = await storeSetup();
    const local = {
      ...cacheRecordFromActiveSession(USER_A, activeFixture(), NOW),
      currentActivityPosition: 0,
    };
    await store.saveFormalSession(local);
    await expect(
      recoverFormalSession({
        api: apiWithActive(activeFixture(SESSION_A, 'in_progress')),
        isOnline: true,
        nowIso: '2026-07-24T10:10:00.000Z',
        store,
        sync: vi.fn(async () => synced),
        userId: USER_A,
      }),
    ).resolves.toMatchObject({
      status: 'ready',
      session: { sessionId: SESSION_A, status: 'in_progress' },
    });
  });

  it('does not overwrite a local Session with unsynced attempts during a server conflict', async () => {
    const { store } = await storeSetup();
    const local = cacheRecordFromActiveSession(USER_A, activeFixture(), NOW);
    await store.saveAttemptV2AndSession(USER_A, attemptV2Fixture, local);
    const unavailable: FormalOutboxSyncResult = { ...synced, pending: 1, status: 'unavailable' };
    await expect(
      recoverFormalSession({
        api: apiWithActive(activeFixture(SESSION_B)),
        isOnline: true,
        nowIso: NOW,
        store,
        sync: vi.fn(async () => unavailable),
        userId: USER_A,
      }),
    ).resolves.toMatchObject({
      status: 'recovery_choice_required',
      reason: 'session_conflict_with_pending',
      session: { sessionId: SESSION_A },
    });
    await expect(store.listPendingAttemptsV2(USER_A)).resolves.toHaveLength(1);
  });

  it.each(['completed', 'abandoned'] as const)(
    'lets server %s state win while preserving an unsynced outbox',
    async (status) => {
      const { store } = await storeSetup();
      const local = cacheRecordFromActiveSession(USER_A, activeFixture(), NOW);
      await store.saveAttemptV2AndSession(USER_A, attemptV2Fixture, local);
      await store.setSyncCursor(`${USER_A}:learn-home`, 'stale-learn');
      await store.setSyncCursor(`${USER_A}:review-center`, 'stale-review');
      await expect(
        reconcileLifecycleState({
          nowIso: '2026-07-24T10:05:00.000Z',
          state: lifecycleFixture(status),
          store,
          userId: USER_A,
        }),
      ).resolves.toMatchObject({
        status: 'terminal_with_pending',
        session: { status },
      });
      await expect(store.listPendingAttemptsV2(USER_A)).resolves.toHaveLength(1);
      await expect(store.getSyncCursor(`${USER_A}:learn-home`)).resolves.toBeNull();
      await expect(store.getSyncCursor(`${USER_A}:review-center`)).resolves.toBeNull();
    },
  );

  it('strictly isolates two user caches and supports per-user logout cleanup', async () => {
    const { store } = await storeSetup();
    await store.saveFormalSession(cacheRecordFromActiveSession(USER_A, activeFixture(), NOW));
    await store.saveFormalSession(
      cacheRecordFromActiveSession(USER_B, activeFixture(SESSION_B), NOW),
    );
    await expect(store.getActiveFormalSession(USER_A)).resolves.toMatchObject({
      userId: USER_A,
      sessionId: SESSION_A,
    });
    await expect(store.getActiveFormalSession(USER_B)).resolves.toMatchObject({
      userId: USER_B,
      sessionId: SESSION_B,
    });
    await store.clearUser(USER_A);
    await expect(store.getActiveFormalSession(USER_A)).resolves.toBeNull();
    await expect(store.getActiveFormalSession(USER_B)).resolves.toMatchObject({
      userId: USER_B,
    });
  });

  it('isolates V1 and Demo data instead of uploading or upgrading it', () => {
    const migrated = migrateWebDocument({
      schemaVersion: 2,
      attempts: { legacy: { broken: true } },
      sessions: {
        demo: {
          schemaVersion: 'local-session-snapshot-v1',
          sessionId: 'demo',
          payload: { demo: true },
          updatedAt: NOW,
        },
      },
    });
    expect(migrated.formalSessions).toEqual({});
    expect(migrated.attemptsV2).toEqual({});
    expect(migrated.legacySessions).toHaveProperty('demo');
  });

  it('rejects an Attempt that references an activity outside the cached Session', async () => {
    const { store } = await storeSetup();
    const local = cacheRecordFromActiveSession(USER_A, activeFixture(), NOW);
    await expect(
      store.saveAttemptV2AndSession(
        USER_A,
        {
          ...attemptV2Fixture,
          sessionActivityId: '30000000-0000-4000-8000-000000000099',
        },
        local,
      ),
    ).rejects.toThrow('outside the cached Session');
    await expect(store.listPendingAttemptsV2(USER_A)).resolves.toHaveLength(0);
  });

  it('rejects a changed immutable snapshot for the same Session ID', async () => {
    const { store } = await storeSetup();
    const local = cacheRecordFromActiveSession(USER_A, activeFixture(), NOW);
    await store.saveFormalSession(local);
    await expect(
      store.saveFormalSession({
        ...local,
        plan: {
          ...local.plan,
          humorContentVersion: 'mutated-content-v2',
        },
      }),
    ).rejects.toThrow();
    await expect(store.getFormalSession(USER_A, SESSION_A)).resolves.toMatchObject({
      plan: { humorContentVersion: 'humor-content-v1' },
    });
  });

  it('rejects a server V1 schema downgrade and retains the V2 cache', async () => {
    const { store } = await storeSetup();
    const local = cacheRecordFromActiveSession(USER_A, activeFixture(), NOW);
    await store.saveFormalSession(local);
    const current = activeFixture();
    if (current.availability !== 'active') throw new Error('Expected active fixture.');
    const downgraded: ActiveSessionData = {
      ...current,
      session: {
        ...current.session!,
        header: {
          ...current.session!.header,
          snapshotSchemaVersion: 'session-plan-snapshot-v1',
        },
        snapshot: {
          activities: [],
          plan: {
            schemaVersion: 'session-plan-snapshot-v1',
            activities: [],
            algorithmVersion: 'session-planner-v2',
            domainMix: {
              hanziActivities: 0,
              pinyinActivities: 0,
              targetPinyinRatio: 0.3,
            },
            estimatedSeconds: 0,
            integrationAlgorithmVersion: 'pinyin-session-planner-v1',
            newConceptIds: [],
            newConceptLimit: 3,
            seed: 'downgrade-test',
            status: 'insufficient_safe_content',
            supportDecision: {
              allowReveal: false,
              fadeStage: 0,
              initialEvidenceSupport: 'pinyin_visible',
              presentation: 'visible',
              reason: 'support_not_yet_faded',
            },
            targetSeconds: 600,
          },
        },
      },
    };
    await expect(
      recoverFormalSession({
        api: apiWithActive(downgraded),
        isOnline: true,
        nowIso: NOW,
        store,
        sync: vi.fn(async () => synced),
        userId: USER_A,
      }),
    ).resolves.toMatchObject({
      status: 'unsupported_schema',
      session: { sessionId: SESSION_A },
    });
  });

  it('quarantines only a corrupt V2 snapshot and preserves other user data', async () => {
    const storage = memoryStorage();
    const store = createWebOfflineStore(storage);
    await store.initialize();
    await store.saveFormalSession(cacheRecordFromActiveSession(USER_A, activeFixture(), NOW));
    await store.saveFormalSession(
      cacheRecordFromActiveSession(USER_B, activeFixture(SESSION_B), NOW),
    );
    const [key, raw] = [...storage.values.entries()].find(([entry]) =>
      entry.includes('offline-store.v3'),
    ) ?? ['', ''];
    const document = JSON.parse(raw) as {
      formalSessions: Record<string, { plan: unknown }>;
      quarantine: Record<string, unknown>;
    };
    const userAKey = Object.keys(document.formalSessions).find((entry) => entry.startsWith(USER_A));
    document.formalSessions[userAKey!].plan = { broken: true };
    storage.setItem(key, JSON.stringify(document));

    await expect(store.getActiveFormalSession(USER_A)).resolves.toBeNull();
    await expect(store.getActiveFormalSession(USER_B)).resolves.toMatchObject({ userId: USER_B });
    const exported = JSON.parse(await store.exportForRecovery()) as {
      quarantine: Record<string, unknown>;
    };
    expect(Object.keys(exported.quarantine)).toContain(userAKey);
  });

  it('returns a clear recovery choice when the server has no active Session but outbox sync fails', async () => {
    const { store } = await storeSetup();
    const local = cacheRecordFromActiveSession(USER_A, activeFixture(), NOW);
    await store.saveAttemptV2AndSession(USER_A, attemptV2Fixture, local);
    const api = apiWithActive({
      schemaVersion: 'active-session-v1',
      availability: 'none',
      session: null,
    });
    await expect(
      recoverFormalSession({
        api,
        isOnline: true,
        nowIso: NOW,
        store,
        sync: vi.fn(async (): Promise<FormalOutboxSyncResult> => ({
          ...synced,
          pending: 1,
          status: 'unavailable',
        })),
        userId: USER_A,
      }),
    ).resolves.toMatchObject({
      status: 'recovery_choice_required',
      reason: 'server_terminal_with_pending',
    });
    await expect(store.listPendingAttemptsV2(USER_A)).resolves.toHaveLength(1);
  });

  it('validates lifecycle Session identity before applying a terminal state', async () => {
    const { store } = await storeSetup();
    await store.saveFormalSession(cacheRecordFromActiveSession(USER_A, activeFixture(), NOW));
    const wrongState: SessionLifecycleState = {
      ...lifecycleFixture('completed'),
      sessionId: SESSION_B,
    };
    await expect(
      reconcileLifecycleState({ nowIso: NOW, state: wrongState, store, userId: USER_A }),
    ).resolves.toMatchObject({ status: 'missing_local' });
    expect(() =>
      cacheRecordFromActiveSession(
        USER_A,
        {
          schemaVersion: 'active-session-v1',
          availability: 'none',
          session: null,
        },
        NOW,
      ),
    ).toThrow(FormalSessionDataError);
  });
});
