import type { FormalSessionApi } from '../formal-session';
import type { FormalOutboxSyncResult } from '../formal-session/sync';
import type { OfflineStore } from '../offline-storage';
import { enterLearnSession, type LearnEntryResult } from './learn-entry';

export function enterReviewSession(input: {
  api: FormalSessionApi;
  clientSessionId: () => string;
  idempotencyKey: () => string;
  isOnline: boolean;
  nowIso: string;
  store: OfflineStore;
  sync: (store: OfflineStore, userId: string) => Promise<FormalOutboxSyncResult>;
  targetMinutes: number;
  userId: string;
}): Promise<LearnEntryResult> {
  return enterLearnSession({ ...input, intent: 'review' });
}
