import type { SessionLifecycleState } from '@hanziquest/contracts';

import type { FormalSessionCacheRecord, OfflineStore } from '../offline-storage/model';
import type { FormalSessionApi } from './api';
import { FormalSessionDataError, applyLifecycleState, cacheRecordFromActiveSession } from './model';
import type { FormalOutboxSyncResult } from './sync';

export type FormalSessionRecoveryResult =
  | { status: 'none'; session: null }
  | { status: 'offline_cached'; session: FormalSessionCacheRecord }
  | { status: 'ready'; session: FormalSessionCacheRecord }
  | {
      status: 'recovery_choice_required';
      reason: 'server_terminal_with_pending' | 'session_conflict_with_pending';
      session: FormalSessionCacheRecord;
    }
  | {
      status: 'unavailable';
      code: string;
      session: FormalSessionCacheRecord | null;
    }
  | {
      status: 'unsupported_schema';
      session: FormalSessionCacheRecord | null;
    };

type SyncFormalAttempts = (store: OfflineStore, userId: string) => Promise<FormalOutboxSyncResult>;

function hasUnsynced(result: FormalOutboxSyncResult): boolean {
  return result.pending > 0 || result.status === 'unavailable' || result.status === 'partial';
}

async function pendingForSession(
  store: OfflineStore,
  userId: string,
  sessionId: string,
): Promise<boolean> {
  return (await store.listPendingAttemptsV2(userId, 100)).some(
    (record) => record.sessionId === sessionId,
  );
}

export async function recoverFormalSession(input: {
  api: FormalSessionApi;
  isOnline: boolean;
  nowIso: string;
  store: OfflineStore;
  sync: SyncFormalAttempts;
  userId: string;
}): Promise<FormalSessionRecoveryResult> {
  const local = await input.store.getActiveFormalSession(input.userId);
  if (!input.isOnline) {
    return local ? { status: 'offline_cached', session: local } : { status: 'none', session: null };
  }

  const server = await input.api.getActive();
  if (!server.ok) {
    return { status: 'unavailable', code: server.code, session: local };
  }
  if (server.value.availability === 'none') {
    if (!local) return { status: 'none', session: null };
    if (await pendingForSession(input.store, input.userId, local.sessionId)) {
      const sync = await input.sync(input.store, input.userId);
      if (hasUnsynced(sync)) {
        return {
          status: 'recovery_choice_required',
          reason: 'server_terminal_with_pending',
          session: local,
        };
      }
    }
    await input.store.removeFormalSession(input.userId, local.sessionId);
    return { status: 'none', session: null };
  }

  let serverRecord: FormalSessionCacheRecord;
  try {
    serverRecord = cacheRecordFromActiveSession(input.userId, server.value, input.nowIso);
  } catch (error) {
    if (error instanceof FormalSessionDataError && error.code === 'SNAPSHOT_SCHEMA_DOWNGRADE') {
      return { status: 'unsupported_schema', session: local };
    }
    throw error;
  }

  if (local && local.sessionId !== serverRecord.sessionId) {
    if (await pendingForSession(input.store, input.userId, local.sessionId)) {
      const sync = await input.sync(input.store, input.userId);
      if (hasUnsynced(sync)) {
        return {
          status: 'recovery_choice_required',
          reason: 'session_conflict_with_pending',
          session: local,
        };
      }
    }
    await input.store.removeFormalSession(input.userId, local.sessionId);
  }

  const sync = await input.sync(input.store, input.userId);
  if (hasUnsynced(sync) && local?.sessionId === serverRecord.sessionId) {
    await input.store.saveFormalSession(serverRecord);
    return { status: 'unavailable', code: 'attempt_sync_pending', session: serverRecord };
  }
  await input.store.saveFormalSession(serverRecord);
  return {
    status: 'ready',
    session:
      (await input.store.getFormalSession(input.userId, serverRecord.sessionId)) ?? serverRecord,
  };
}

export async function reconcileLifecycleState(input: {
  nowIso: string;
  state: SessionLifecycleState;
  store: OfflineStore;
  userId: string;
}): Promise<
  | { status: 'aligned'; session: FormalSessionCacheRecord }
  | { status: 'terminal_with_pending'; session: FormalSessionCacheRecord }
  | { status: 'missing_local'; session: null }
> {
  const local = await input.store.getFormalSession(input.userId, input.state.sessionId);
  if (!local) return { status: 'missing_local', session: null };
  const updated = applyLifecycleState(local, input.state, input.nowIso);
  await input.store.saveFormalSession(updated);
  if (input.state.status === 'completed' || input.state.status === 'abandoned') {
    await invalidateFormalSessionReadModels(input.store, input.userId);
  }
  const pending = await pendingForSession(input.store, input.userId, input.state.sessionId);
  if (pending && (input.state.status === 'completed' || input.state.status === 'abandoned')) {
    return { status: 'terminal_with_pending', session: updated };
  }
  return { status: 'aligned', session: updated };
}

export async function invalidateFormalSessionReadModels(
  store: OfflineStore,
  userId: string,
): Promise<void> {
  await Promise.all([
    store.removeSyncCursor(`${userId}:learn-home`),
    store.removeSyncCursor(`${userId}:review-center`),
    store.removeSyncCursor(`${userId}:active-session`),
  ]);
}
