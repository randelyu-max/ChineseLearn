import { apiRequest } from '../../lib/api/client';
import type { OfflineStore } from './model';
import { syncPendingAttempts } from './sync';

export async function syncPendingAttemptsWithApi(store: OfflineStore) {
  return syncPendingAttempts(store, (request) =>
    apiRequest('/api/attempts-batch', {
      method: 'POST',
      body: JSON.stringify(request),
    }),
  );
}
