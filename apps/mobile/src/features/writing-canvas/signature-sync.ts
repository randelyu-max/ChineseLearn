import {
  SignaturePracticeSummarySuccessResponseSchema,
  type SignaturePracticeSummary,
} from '@hanziquest/contracts';

import { WritingDraftRecordSchema, type WritingDraftRecord } from './storage-model';

type ApiResult<T> = { ok: true; value: T } | { ok: false; status: number; code: string };
type MetadataSender = (path: string, init: RequestInit) => Promise<ApiResult<unknown>>;

export type SignatureSyncResult = Readonly<{
  record: WritingDraftRecord;
  status: 'synced' | 'unavailable';
}>;

function updateRecord(
  record: WritingDraftRecord,
  update: Readonly<{
    pendingEvents?: WritingDraftRecord['pendingEvents'];
    serverSummary?: SignaturePracticeSummary;
  }>,
): WritingDraftRecord {
  return WritingDraftRecordSchema.parse({
    ...record,
    ...update,
    updatedAt: new Date().toISOString(),
  });
}

export async function syncSignaturePracticeMetadata(
  record: WritingDraftRecord,
  sender: MetadataSender,
): Promise<SignatureSyncResult> {
  const projectResponse = await sender('/api/signature-practice/project', {
    body: JSON.stringify({
      schemaVersion: 'signature-project-request-v1',
      chineseName: record.chineseName,
      projectId: record.projectId,
      selectedStyle: record.selectedStyle,
    }),
    method: 'PUT',
  });
  if (!projectResponse.ok) return { record, status: 'unavailable' };
  const parsedProject = SignaturePracticeSummarySuccessResponseSchema.safeParse(
    projectResponse.value,
  );
  if (!parsedProject.success) return { record, status: 'unavailable' };

  let next = updateRecord(record, { serverSummary: parsedProject.data.data });
  for (const event of record.pendingEvents) {
    const eventResponse = await sender('/api/signature-practice/events', {
      body: JSON.stringify(event),
      method: 'POST',
    });
    if (!eventResponse.ok) return { record: next, status: 'unavailable' };
    const parsedEvent = SignaturePracticeSummarySuccessResponseSchema.safeParse(
      eventResponse.value,
    );
    if (!parsedEvent.success) return { record: next, status: 'unavailable' };
    next = updateRecord(next, {
      pendingEvents: next.pendingEvents.filter((candidate) => candidate.eventId !== event.eventId),
      serverSummary: parsedEvent.data.data,
    });
  }
  return { record: next, status: 'synced' };
}
