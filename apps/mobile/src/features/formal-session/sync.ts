import {
  AttemptsBatchRequestV2Schema,
  AttemptsBatchV2SuccessResponseSchema,
  type AttemptsBatchRequestV2,
} from '@hanziquest/contracts';

import type { ApiResult } from '../../lib/api/client';
import type { FormalAttemptOutboxRecord, OfflineStore } from '../offline-storage/model';

type BatchSender = (request: AttemptsBatchRequestV2) => Promise<ApiResult<unknown>>;

export type FormalOutboxSyncResult = Readonly<{
  accepted: number;
  duplicate: number;
  pending: number;
  preservedRejected: number;
  scoringMismatches: number;
  status: 'idle' | 'partial' | 'synced' | 'unavailable';
}>;

function groupBySession(records: readonly FormalAttemptOutboxRecord[]) {
  const groups = new Map<string, FormalAttemptOutboxRecord[]>();
  for (const record of records) {
    const group = groups.get(record.sessionId) ?? [];
    group.push(record);
    groups.set(record.sessionId, group);
  }
  return groups;
}

export async function syncFormalAttempts(
  store: OfflineStore,
  userId: string,
  sender: BatchSender,
  onScoringMismatch?: () => void,
): Promise<FormalOutboxSyncResult> {
  const pending = await store.listPendingAttemptsV2(userId, 50);
  if (pending.length === 0) {
    return {
      accepted: 0,
      duplicate: 0,
      pending: 0,
      preservedRejected: 0,
      scoringMismatches: 0,
      status: 'idle',
    };
  }
  let accepted = 0;
  let duplicate = 0;
  let preservedRejected = 0;
  let scoringMismatches = 0;
  let unavailable = false;
  for (const [sessionId, records] of groupBySession(pending)) {
    const first = records[0];
    if (!first) continue;
    const request = AttemptsBatchRequestV2Schema.parse({
      schemaVersion: 'attempts-batch-request-v2',
      sessionId,
      idempotencyKey: `attempts-v2:${sessionId}:${first.attempt.attemptId}`,
      attempts: records.map((record) => record.attempt),
    });
    const response = await sender(request);
    if (!response.ok) {
      unavailable = true;
      for (const record of records) {
        await store.markAttemptV2Pending(record.attempt.attemptId);
      }
      continue;
    }
    const parsed = AttemptsBatchV2SuccessResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      unavailable = true;
      for (const record of records) {
        await store.markAttemptV2Pending(record.attempt.attemptId);
      }
      continue;
    }
    const removable: string[] = [];
    for (const result of parsed.data.data.results) {
      const local = records.find((record) => record.attempt.attemptId === result.attemptId);
      if (
        result.status !== 'rejected' &&
        typeof local?.attempt.isCorrectClient === 'boolean' &&
        local.attempt.isCorrectClient !== result.isCorrect
      ) {
        scoringMismatches += 1;
        onScoringMismatch?.();
      }
      if (result.status === 'accepted') {
        accepted += 1;
        removable.push(result.attemptId);
      } else if (result.status === 'duplicate') {
        duplicate += 1;
        removable.push(result.attemptId);
      } else {
        preservedRejected += 1;
        await store.markAttemptV2Rejected(result.attemptId, result.rejectionCode);
      }
    }
    await store.removeAttemptsV2(removable);
    await store.setSyncCursor(`${userId}:attempts-v2`, parsed.data.data.syncCursor);
  }
  const remaining = (await store.listPendingAttemptsV2(userId, 100)).length;
  return {
    accepted,
    duplicate,
    pending: remaining,
    preservedRejected,
    scoringMismatches,
    status: unavailable
      ? accepted + duplicate + preservedRejected > 0
        ? 'partial'
        : 'unavailable'
      : 'synced',
  };
}
