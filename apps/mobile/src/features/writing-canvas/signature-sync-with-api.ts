import { apiRequest } from '../../lib/api/client';
import { syncSignaturePracticeMetadata, type SignatureSyncResult } from './signature-sync';
import type { WritingDraftRecord } from './storage-model';

export function syncSignaturePracticeMetadataWithApi(
  record: WritingDraftRecord,
): Promise<SignatureSyncResult> {
  return syncSignaturePracticeMetadata(record, apiRequest);
}
