import { apiRequest } from '../../lib/api/client';
import type { OfflineStore } from '../offline-storage/model';
import { syncFormalAttempts } from './sync';

export function syncFormalAttemptsWithApi(store: OfflineStore, userId: string) {
  return syncFormalAttempts(
    store,
    userId,
    (request) =>
      apiRequest('/api/attempts-batch', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
    () => {
      console.warn('Formal Attempt score reconciliation applied.', {
        code: 'LOCAL_SERVER_SCORE_MISMATCH',
      });
    },
  );
}
