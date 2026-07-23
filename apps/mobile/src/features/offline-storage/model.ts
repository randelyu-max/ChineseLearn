import { AttemptDraftSchema, type AttemptDraft } from '@hanziquest/contracts';
import { z } from 'zod';

export const LOCAL_STORE_SCHEMA_VERSION = 2;
export const ACTIVE_DEMO_SESSION_ID = '40000000-0000-4000-8000-000000000001';

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export type JsonValue =
  boolean | null | number | string | JsonValue[] | { [key: string]: JsonValue };

export const SessionSnapshotRecordSchema = z
  .object({
    schemaVersion: z.literal('local-session-snapshot-v1'),
    sessionId: z.string().trim().min(1).max(128),
    payload: JsonValueSchema,
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const OutboxRecordSchema = z
  .object({
    schemaVersion: z.literal('attempt-outbox-v1'),
    attempt: AttemptDraftSchema,
    sessionId: z.string().trim().min(1).max(128),
    state: z.enum(['pending', 'in_flight']),
    retryCount: z.number().int().nonnegative().max(100),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const ContentCacheRecordSchema = z
  .object({
    schemaVersion: z.literal('content-cache-v1'),
    contentVersion: z.string().trim().min(1).max(64),
    contentSchemaVersion: z.string().trim().min(1).max(64),
    payload: JsonValueSchema,
    cachedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type SessionSnapshotRecord = z.infer<typeof SessionSnapshotRecordSchema>;
export type OutboxRecord = z.infer<typeof OutboxRecordSchema>;
export type ContentCacheRecord = z.infer<typeof ContentCacheRecordSchema>;

export type OfflineStore = {
  cacheContent(record: ContentCacheRecord): Promise<void>;
  clearAll(): Promise<void>;
  exportForRecovery(): Promise<string>;
  getContent(contentVersion: string): Promise<ContentCacheRecord | null>;
  getSessionSnapshot(sessionId: string): Promise<SessionSnapshotRecord | null>;
  getSyncCursor(scope: string): Promise<string | null>;
  initialize(): Promise<void>;
  listPendingAttempts(limit?: number): Promise<readonly OutboxRecord[]>;
  markAttemptPending(attemptId: string): Promise<void>;
  removeAttempts(attemptIds: readonly string[]): Promise<void>;
  saveAttemptAndSession(
    attempt: AttemptDraft,
    snapshot: SessionSnapshotRecord,
  ): Promise<'duplicate' | 'inserted'>;
  saveSessionSnapshot(snapshot: SessionSnapshotRecord): Promise<void>;
  setSyncCursor(scope: string, cursor: string): Promise<void>;
};

export function createSessionSnapshot(
  sessionId: string,
  payload: JsonValue,
  nowIso: string,
): SessionSnapshotRecord {
  return SessionSnapshotRecordSchema.parse({
    schemaVersion: 'local-session-snapshot-v1',
    sessionId,
    payload,
    updatedAt: nowIso,
  });
}

export function parseAttemptPayload(value: string): AttemptDraft | null {
  try {
    return AttemptDraftSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

export function migrateWebDocument(value: unknown): WebStoreDocument {
  const empty: WebStoreDocument = {
    schemaVersion: LOCAL_STORE_SCHEMA_VERSION,
    attempts: {},
    content: {},
    cursors: {},
    sessions: {},
  };
  if (typeof value !== 'object' || value === null) return empty;
  const input = value as Record<string, unknown>;
  if (input.schemaVersion === 2) {
    return {
      ...empty,
      attempts:
        typeof input.attempts === 'object' && input.attempts !== null
          ? (input.attempts as WebStoreDocument['attempts'])
          : {},
      content:
        typeof input.content === 'object' && input.content !== null
          ? (input.content as WebStoreDocument['content'])
          : {},
      cursors:
        typeof input.cursors === 'object' && input.cursors !== null
          ? (input.cursors as WebStoreDocument['cursors'])
          : {},
      sessions:
        typeof input.sessions === 'object' && input.sessions !== null
          ? (input.sessions as WebStoreDocument['sessions'])
          : {},
    };
  }
  if (input.schemaVersion === 1) {
    const attempts: WebStoreDocument['attempts'] = {};
    if (Array.isArray(input.queue)) {
      for (const candidate of input.queue) {
        const parsed = OutboxRecordSchema.safeParse(candidate);
        if (parsed.success) attempts[parsed.data.attempt.attemptId] = parsed.data;
      }
    }
    return { ...empty, attempts };
  }
  return empty;
}

export type WebStoreDocument = {
  schemaVersion: 2;
  attempts: Record<string, OutboxRecord>;
  content: Record<string, ContentCacheRecord>;
  cursors: Record<string, string>;
  sessions: Record<string, SessionSnapshotRecord>;
};
