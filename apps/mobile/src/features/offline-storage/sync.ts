import {
  AttemptsBatchRequestSchema,
  AttemptsBatchSuccessResponseSchema,
  type AttemptsBatchRequest,
} from '@hanziquest/contracts';

import type { OfflineStore, OutboxRecord } from './model';

type ApiResult<T> = { ok: true; value: T } | { ok: false; status: number; code: string };
type BatchSender = (request: AttemptsBatchRequest) => Promise<ApiResult<unknown>>;

export type OutboxSyncResult = Readonly<{
  accepted: number;
  duplicate: number;
  pending: number;
  rejected: number;
  status: 'idle' | 'partial' | 'synced' | 'unavailable';
}>;

function groupBySession(records: readonly OutboxRecord[]) {
  const groups = new Map<string, OutboxRecord[]>();
  for (const record of records) {
    const group = groups.get(record.sessionId) ?? [];
    group.push(record);
    groups.set(record.sessionId, group);
  }
  return groups;
}

export async function syncPendingAttempts(
  store: OfflineStore,
  sender: BatchSender,
): Promise<OutboxSyncResult> {
  const pending = await store.listPendingAttempts(50);
  if (pending.length === 0) {
    return { accepted: 0, duplicate: 0, pending: 0, rejected: 0, status: 'idle' };
  }
  let accepted = 0;
  let duplicate = 0;
  let rejected = 0;
  let unavailable = false;
  for (const [sessionId, records] of groupBySession(pending)) {
    const first = records[0];
    if (!first) continue;
    const request = AttemptsBatchRequestSchema.parse({
      schemaVersion: 'attempts-batch-request-v1',
      sessionId,
      idempotencyKey: `attempts-batch:${sessionId}:${first.attempt.attemptId}`,
      attempts: records.map((record) => record.attempt),
    });
    const response = await sender(request);
    if (!response.ok) {
      unavailable = true;
      for (const record of records) {
        await store.markAttemptPending(record.attempt.attemptId);
      }
      continue;
    }
    const parsed = AttemptsBatchSuccessResponseSchema.safeParse(response.value);
    if (!parsed.success) {
      unavailable = true;
      for (const record of records) {
        await store.markAttemptPending(record.attempt.attemptId);
      }
      continue;
    }
    const terminalIds: string[] = [];
    for (const result of parsed.data.data.results) {
      terminalIds.push(result.attemptId);
      if (result.status === 'accepted') accepted += 1;
      if (result.status === 'duplicate') duplicate += 1;
      if (result.status === 'rejected') rejected += 1;
    }
    await store.removeAttempts(terminalIds);
    await store.setSyncCursor('attempts', parsed.data.data.syncCursor);
  }
  const remaining = (await store.listPendingAttempts(100)).length;
  return {
    accepted,
    duplicate,
    pending: remaining,
    rejected,
    status: unavailable
      ? accepted + duplicate + rejected > 0
        ? 'partial'
        : 'unavailable'
      : 'synced',
  };
}
