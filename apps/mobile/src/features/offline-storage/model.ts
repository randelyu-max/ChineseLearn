import {
  AttemptDraftSchema,
  AttemptDraftV2Schema,
  SessionActivitySnapshotV2Schema,
  SessionPlanSnapshotV2Schema,
  UuidSchema,
  type AttemptDraft,
  type AttemptDraftV2,
} from '@hanziquest/contracts';
import { z } from 'zod';

export const LOCAL_STORE_SCHEMA_VERSION = 3;
export const ACTIVE_DEMO_SESSION_ID = '40000000-0000-4000-8000-000000000001';
export const FORMAL_SESSION_CACHE_SCHEMA_VERSION = 'formal-session-cache-v2' as const;
export const FORMAL_ATTEMPT_OUTBOX_SCHEMA_VERSION = 'formal-attempt-outbox-v2' as const;

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

export const FormalSessionCacheRecordSchema = z
  .object({
    schemaVersion: z.literal(FORMAL_SESSION_CACHE_SCHEMA_VERSION),
    userId: UuidSchema,
    sessionId: UuidSchema,
    snapshotSchemaVersion: z.literal('session-plan-snapshot-v2'),
    status: z.enum(['planned', 'in_progress', 'completed', 'abandoned']),
    intent: z.enum(['learn', 'review']),
    clientSessionId: UuidSchema,
    targetMinutes: z.number().int().min(3).max(60),
    curriculumVersionId: UuidSchema,
    createdAt: z.iso.datetime({ offset: true }),
    startedAt: z.iso.datetime({ offset: true }).nullable(),
    completedAt: z.iso.datetime({ offset: true }).nullable(),
    abandonedAt: z.iso.datetime({ offset: true }).nullable(),
    plan: SessionPlanSnapshotV2Schema,
    activities: z.array(SessionActivitySnapshotV2Schema).min(1).max(20),
    completedActivityIds: z.array(UuidSchema).max(20).default([]),
    currentActivityPosition: z.number().int().nonnegative().max(19),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.sessionId !== record.plan.sessionId) {
      context.addIssue({
        code: 'custom',
        message: 'Cached Session ID must match the immutable plan.',
        path: ['sessionId'],
      });
    }
    if (record.activities.length !== record.plan.activities.length) {
      context.addIssue({
        code: 'custom',
        message: 'Cached activities must match the immutable plan activity count.',
        path: ['activities'],
      });
    }
    if (
      record.activities.some(
        (activity, index) =>
          activity.sessionActivityId !== record.plan.activities[index]?.sessionActivityId,
      )
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Cached activities must preserve the immutable plan order.',
        path: ['activities'],
      });
    }
    if (JSON.stringify(record.activities) !== JSON.stringify(record.plan.activities)) {
      context.addIssue({
        code: 'custom',
        message: 'Cached activities must equal the immutable plan snapshots.',
        path: ['activities'],
      });
    }
    if (record.currentActivityPosition >= record.activities.length) {
      context.addIssue({
        code: 'custom',
        message: 'Current activity position must identify a cached activity.',
        path: ['currentActivityPosition'],
      });
    }
    const activityIds = new Set(record.activities.map((activity) => activity.sessionActivityId));
    if (
      new Set(record.completedActivityIds).size !== record.completedActivityIds.length ||
      record.completedActivityIds.some((activityId) => !activityIds.has(activityId))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Completed activity IDs must be unique members of the cached Session.',
        path: ['completedActivityIds'],
      });
    }
  });

export const FormalAttemptOutboxRecordSchema = z
  .object({
    schemaVersion: z.literal(FORMAL_ATTEMPT_OUTBOX_SCHEMA_VERSION),
    userId: UuidSchema,
    sessionId: UuidSchema,
    sessionActivityId: UuidSchema,
    attempt: AttemptDraftV2Schema,
    state: z.enum(['pending', 'in_flight', 'rejected']),
    retryCount: z.number().int().nonnegative().max(100),
    lastErrorCode: z.string().trim().min(1).max(64).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.sessionActivityId !== record.attempt.sessionActivityId) {
      context.addIssue({
        code: 'custom',
        message: 'Outbox Session Activity ID must match the Attempt.',
        path: ['sessionActivityId'],
      });
    }
  });

export type SessionSnapshotRecord = z.infer<typeof SessionSnapshotRecordSchema>;
export type OutboxRecord = z.infer<typeof OutboxRecordSchema>;
export type ContentCacheRecord = z.infer<typeof ContentCacheRecordSchema>;
export type FormalSessionCacheRecord = z.infer<typeof FormalSessionCacheRecordSchema>;
export type FormalAttemptOutboxRecord = z.infer<typeof FormalAttemptOutboxRecordSchema>;

export type OfflineStore = {
  cacheContent(record: ContentCacheRecord): Promise<void>;
  clearAll(): Promise<void>;
  clearUser(userId: string): Promise<void>;
  exportForRecovery(): Promise<string>;
  getActiveFormalSession(userId: string): Promise<FormalSessionCacheRecord | null>;
  getContent(contentVersion: string): Promise<ContentCacheRecord | null>;
  getFormalSession(userId: string, sessionId: string): Promise<FormalSessionCacheRecord | null>;
  getSessionSnapshot(sessionId: string): Promise<SessionSnapshotRecord | null>;
  getSyncCursor(scope: string): Promise<string | null>;
  initialize(): Promise<void>;
  listPendingAttempts(limit?: number): Promise<readonly OutboxRecord[]>;
  listPendingAttemptsV2(
    userId: string,
    limit?: number,
  ): Promise<readonly FormalAttemptOutboxRecord[]>;
  markAttemptPending(attemptId: string): Promise<void>;
  markAttemptV2Pending(attemptId: string): Promise<void>;
  markAttemptV2Rejected(attemptId: string, code: string): Promise<void>;
  removeAttempts(attemptIds: readonly string[]): Promise<void>;
  removeAttemptsV2(attemptIds: readonly string[]): Promise<void>;
  removeFormalSession(userId: string, sessionId: string): Promise<void>;
  removeSyncCursor(scope: string): Promise<void>;
  saveAttemptV2AndSession(
    userId: string,
    attempt: AttemptDraftV2,
    snapshot: FormalSessionCacheRecord,
  ): Promise<'duplicate' | 'inserted'>;
  saveAttemptAndSession(
    attempt: AttemptDraft,
    snapshot: SessionSnapshotRecord,
  ): Promise<'duplicate' | 'inserted'>;
  saveFormalSession(snapshot: FormalSessionCacheRecord): Promise<void>;
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

export function parseAttemptV2Payload(value: string): AttemptDraftV2 | null {
  try {
    return AttemptDraftV2Schema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}

function emptyWebDocument(): WebStoreDocument {
  return {
    schemaVersion: LOCAL_STORE_SCHEMA_VERSION,
    attempts: {},
    attemptsV2: {},
    content: {},
    cursors: {},
    formalSessions: {},
    legacySessions: {},
    quarantine: {},
  };
}

export function migrateWebDocument(value: unknown): WebStoreDocument {
  const empty = emptyWebDocument();
  if (typeof value !== 'object' || value === null) return empty;
  const input = value as Record<string, unknown>;
  if (input.schemaVersion === 3) {
    return {
      ...empty,
      attempts:
        typeof input.attempts === 'object' && input.attempts !== null
          ? (input.attempts as WebStoreDocument['attempts'])
          : {},
      attemptsV2:
        typeof input.attemptsV2 === 'object' && input.attemptsV2 !== null
          ? (input.attemptsV2 as WebStoreDocument['attemptsV2'])
          : {},
      content:
        typeof input.content === 'object' && input.content !== null
          ? (input.content as WebStoreDocument['content'])
          : {},
      cursors:
        typeof input.cursors === 'object' && input.cursors !== null
          ? (input.cursors as WebStoreDocument['cursors'])
          : {},
      formalSessions:
        typeof input.formalSessions === 'object' && input.formalSessions !== null
          ? (input.formalSessions as WebStoreDocument['formalSessions'])
          : {},
      legacySessions:
        typeof input.legacySessions === 'object' && input.legacySessions !== null
          ? (input.legacySessions as WebStoreDocument['legacySessions'])
          : {},
      quarantine:
        typeof input.quarantine === 'object' && input.quarantine !== null
          ? (input.quarantine as WebStoreDocument['quarantine'])
          : {},
    };
  }
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
      legacySessions:
        typeof input.sessions === 'object' && input.sessions !== null
          ? (input.sessions as WebStoreDocument['legacySessions'])
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
  schemaVersion: 3;
  attempts: Record<string, OutboxRecord>;
  attemptsV2: Record<string, FormalAttemptOutboxRecord>;
  content: Record<string, ContentCacheRecord>;
  cursors: Record<string, string>;
  formalSessions: Record<string, FormalSessionCacheRecord>;
  legacySessions: Record<string, SessionSnapshotRecord>;
  quarantine: Record<
    string,
    {
      reasonCode: string;
      quarantinedAt: string;
    }
  >;
};

export function formalSessionCacheKey(
  userId: string,
  sessionId: string,
  schemaVersion = 'session-plan-snapshot-v2',
): string {
  return `${userId}:${sessionId}:${schemaVersion}`;
}
