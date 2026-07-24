import type { FormalSessionCacheRecord, OfflineStore } from '../offline-storage/model';
import type { FormalSessionApi } from '../formal-session/api';
import { cacheRecordFromPlanResult, applyLifecycleState } from '../formal-session/model';
import { recoverFormalSession, type FormalSessionRecoveryResult } from '../formal-session/recovery';
import type { FormalOutboxSyncResult } from '../formal-session/sync';

export type LearnEntryResult =
  | { status: 'ready'; offline: boolean; session: FormalSessionCacheRecord }
  | {
      status: 'error';
      code:
        | 'auth_expired'
        | 'content_unavailable'
        | 'network_required'
        | 'recovery_choice_required'
        | 'request_failed'
        | 'unsupported_schema';
    };

type SyncFormalAttempts = (store: OfflineStore, userId: string) => Promise<FormalOutboxSyncResult>;

async function startPlannedSession(input: {
  api: FormalSessionApi;
  nowIso: string;
  session: FormalSessionCacheRecord;
  store: OfflineStore;
}): Promise<LearnEntryResult> {
  const started = await input.api.start(input.session.sessionId, {
    schemaVersion: 'session-lifecycle-request-v1',
    idempotencyKey: `mobile-start:${input.session.sessionId}`,
  });
  if (!started.ok) {
    return {
      status: 'error',
      code: started.status === 401 ? 'auth_expired' : 'request_failed',
    };
  }
  const session = applyLifecycleState(input.session, started.value, input.nowIso);
  await input.store.saveFormalSession(session);
  return { status: 'ready', offline: false, session };
}

function recoveredSession(recovery: FormalSessionRecoveryResult): FormalSessionCacheRecord | null {
  return 'session' in recovery ? recovery.session : null;
}

export async function enterLearnSession(input: {
  api: FormalSessionApi;
  clientSessionId: () => string;
  idempotencyKey: () => string;
  isOnline: boolean;
  nowIso: string;
  store: OfflineStore;
  sync: SyncFormalAttempts;
  targetMinutes: number;
  userId: string;
}): Promise<LearnEntryResult> {
  const recovery = await recoverFormalSession({
    api: input.api,
    isOnline: input.isOnline,
    nowIso: input.nowIso,
    store: input.store,
    sync: input.sync,
    userId: input.userId,
  });
  const recovered = recoveredSession(recovery);
  if (recovery.status === 'unsupported_schema') {
    return { status: 'error', code: 'unsupported_schema' };
  }
  if (recovery.status === 'recovery_choice_required') {
    return { status: 'error', code: 'recovery_choice_required' };
  }
  if (recovery.status === 'unavailable') {
    if (recovery.code === 'UNAUTHENTICATED' || recovery.code === 'unauthenticated') {
      return { status: 'error', code: 'auth_expired' };
    }
    if (recovered?.status === 'in_progress') {
      return { status: 'ready', offline: true, session: recovered };
    }
    return { status: 'error', code: 'request_failed' };
  }
  if (recovered) {
    if (recovered.status === 'in_progress') {
      return {
        status: 'ready',
        offline: recovery.status === 'offline_cached',
        session: recovered,
      };
    }
    if (!input.isOnline) return { status: 'error', code: 'network_required' };
    return startPlannedSession({
      api: input.api,
      nowIso: input.nowIso,
      session: recovered,
      store: input.store,
    });
  }
  if (!input.isOnline) return { status: 'error', code: 'network_required' };

  const planned = await input.api.plan({
    schemaVersion: 'session-plan-request-v2',
    clientSessionId: input.clientSessionId(),
    idempotencyKey: input.idempotencyKey(),
    intent: 'learn',
    targetMinutes: Math.max(3, Math.min(20, Math.round(input.targetMinutes))),
  });
  if (!planned.ok) {
    return {
      status: 'error',
      code: planned.status === 401 ? 'auth_expired' : 'request_failed',
    };
  }
  if (
    planned.value.result === 'nothing_due' ||
    planned.value.result === 'insufficient_safe_content'
  ) {
    return { status: 'error', code: 'content_unavailable' };
  }
  const session = cacheRecordFromPlanResult(input.userId, planned.value, input.nowIso);
  if (!session) return { status: 'error', code: 'content_unavailable' };
  await input.store.saveFormalSession(session);
  if (session.status === 'in_progress') {
    return { status: 'ready', offline: false, session };
  }
  return startPlannedSession({
    api: input.api,
    nowIso: input.nowIso,
    session,
    store: input.store,
  });
}
