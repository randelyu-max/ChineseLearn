import type { FormalSessionApi } from '../formal-session/api';
import { reconcileLifecycleState } from '../formal-session/recovery';
import type { FormalOutboxSyncResult } from '../formal-session/sync';
import type { FormalSessionCacheRecord, OfflineStore } from '../offline-storage/model';

type SyncFormalAttempts = (store: OfflineStore, userId: string) => Promise<FormalOutboxSyncResult>;

export type CompleteFormalSessionResult =
  | { status: 'completed'; session: FormalSessionCacheRecord }
  | { status: 'auth_expired' | 'request_failed' | 'sync_pending' };

export async function completeFormalSession(input: {
  api: FormalSessionApi;
  nowIso: string;
  sessionId: string;
  store: OfflineStore;
  sync: SyncFormalAttempts;
  userId: string;
}): Promise<CompleteFormalSessionResult> {
  const sync = await input.sync(input.store, input.userId);
  if (sync.status === 'unavailable' || sync.status === 'partial' || sync.pending > 0) {
    return { status: 'sync_pending' };
  }
  const completed = await input.api.complete(input.sessionId, {
    schemaVersion: 'session-lifecycle-request-v1',
    idempotencyKey: `mobile-complete:${input.sessionId}`,
  });
  if (!completed.ok) {
    return {
      status: completed.status === 401 ? 'auth_expired' : 'request_failed',
    };
  }
  const reconciled = await reconcileLifecycleState({
    nowIso: input.nowIso,
    state: completed.value,
    store: input.store,
    userId: input.userId,
  });
  return reconciled.session
    ? { status: 'completed', session: reconciled.session }
    : { status: 'request_failed' };
}
