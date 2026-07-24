import {
  ContentCacheRecordSchema,
  FormalAttemptOutboxRecordSchema,
  FormalSessionCacheRecordSchema,
  formalSessionCacheKey,
  migrateWebDocument,
  OutboxRecordSchema,
  SessionSnapshotRecordSchema,
  type ContentCacheRecord,
  type FormalAttemptOutboxRecord,
  type FormalSessionCacheRecord,
  type OfflineStore,
  type OutboxRecord,
  type SessionSnapshotRecord,
  type WebStoreDocument,
} from './model';

const STORAGE_KEY = 'hanziquest.offline-store.v3';
const LEGACY_STORAGE_KEY = 'hanziquest.offline-store.v2';

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export function createWebOfflineStore(storage: StorageLike): OfflineStore {
  function read(): WebStoreDocument {
    const raw = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return migrateWebDocument(null);
    try {
      return migrateWebDocument(JSON.parse(raw));
    } catch {
      return migrateWebDocument(null);
    }
  }

  function write(document: WebStoreDocument): void {
    storage.setItem(STORAGE_KEY, JSON.stringify(document));
    storage.removeItem(LEGACY_STORAGE_KEY);
  }

  return {
    async initialize() {
      write(read());
    },
    async cacheContent(record) {
      const parsed = ContentCacheRecordSchema.parse(record);
      const document = read();
      document.content[parsed.contentVersion] = parsed;
      write(document);
    },
    async clearAll() {
      storage.removeItem(STORAGE_KEY);
      storage.removeItem(LEGACY_STORAGE_KEY);
    },
    async clearUser(userId) {
      const document = read();
      for (const [key, record] of Object.entries(document.formalSessions)) {
        if (record.userId === userId) delete document.formalSessions[key];
      }
      for (const [attemptId, record] of Object.entries(document.attemptsV2)) {
        if (record.userId === userId) delete document.attemptsV2[attemptId];
      }
      for (const scope of Object.keys(document.cursors)) {
        if (scope.startsWith(`${userId}:`)) delete document.cursors[scope];
      }
      write(document);
    },
    async exportForRecovery() {
      return JSON.stringify(read());
    },
    async getContent(contentVersion) {
      const record = read().content[contentVersion];
      const parsed = ContentCacheRecordSchema.safeParse(record);
      return parsed.success ? parsed.data : null;
    },
    async getActiveFormalSession(userId) {
      const document = read();
      const valid: FormalSessionCacheRecord[] = [];
      let changed = false;
      for (const [key, value] of Object.entries(document.formalSessions)) {
        if (value.userId !== userId) continue;
        const parsed = FormalSessionCacheRecordSchema.safeParse(value);
        if (!parsed.success) {
          delete document.formalSessions[key];
          document.quarantine[key] = {
            reasonCode: 'LOCAL_SNAPSHOT_INVALID',
            quarantinedAt: new Date().toISOString(),
          };
          changed = true;
          continue;
        }
        if (parsed.data.status === 'planned' || parsed.data.status === 'in_progress') {
          valid.push(parsed.data);
        }
      }
      if (changed) write(document);
      return (
        valid.sort(
          (left, right) =>
            right.updatedAt.localeCompare(left.updatedAt) ||
            right.sessionId.localeCompare(left.sessionId),
        )[0] ?? null
      );
    },
    async getFormalSession(userId, sessionId) {
      const document = read();
      const key = formalSessionCacheKey(userId, sessionId);
      const parsed = FormalSessionCacheRecordSchema.safeParse(document.formalSessions[key]);
      if (parsed.success) return parsed.data;
      if (document.formalSessions[key]) {
        delete document.formalSessions[key];
        document.quarantine[key] = {
          reasonCode: 'LOCAL_SNAPSHOT_INVALID',
          quarantinedAt: new Date().toISOString(),
        };
        write(document);
      }
      return null;
    },
    async getSessionSnapshot(sessionId) {
      const record = read().legacySessions[sessionId];
      const parsed = SessionSnapshotRecordSchema.safeParse(record);
      return parsed.success ? parsed.data : null;
    },
    async getSyncCursor(scope) {
      return read().cursors[scope] ?? null;
    },
    async listPendingAttempts(limit = 50) {
      const document = read();
      const valid: OutboxRecord[] = [];
      let changed = false;
      for (const [attemptId, value] of Object.entries(document.attempts)) {
        const parsed = OutboxRecordSchema.safeParse(value);
        if (!parsed.success) {
          delete document.attempts[attemptId];
          changed = true;
          continue;
        }
        if (parsed.data.state === 'pending' || parsed.data.state === 'in_flight') {
          valid.push({ ...parsed.data, state: 'pending' });
        }
      }
      if (changed) write(document);
      return valid
        .sort(
          (left, right) =>
            left.attempt.offlineSequence - right.attempt.offlineSequence ||
            left.attempt.attemptId.localeCompare(right.attempt.attemptId),
        )
        .slice(0, Math.max(1, Math.min(100, limit)));
    },
    async listPendingAttemptsV2(userId, limit = 50) {
      const document = read();
      const valid: FormalAttemptOutboxRecord[] = [];
      let changed = false;
      for (const [attemptId, value] of Object.entries(document.attemptsV2)) {
        if (value.userId !== userId) continue;
        const parsed = FormalAttemptOutboxRecordSchema.safeParse(value);
        if (!parsed.success) {
          delete document.attemptsV2[attemptId];
          document.quarantine[`attempt:${attemptId}`] = {
            reasonCode: 'LOCAL_ATTEMPT_INVALID',
            quarantinedAt: new Date().toISOString(),
          };
          changed = true;
          continue;
        }
        if (parsed.data.state === 'pending' || parsed.data.state === 'in_flight') {
          valid.push({ ...parsed.data, state: 'pending' });
        }
      }
      if (changed) write(document);
      return valid
        .sort(
          (left, right) =>
            left.attempt.occurredAt.localeCompare(right.attempt.occurredAt) ||
            left.attempt.offlineSequence - right.attempt.offlineSequence ||
            left.attempt.attemptId.localeCompare(right.attempt.attemptId),
        )
        .slice(0, Math.max(1, Math.min(100, limit)));
    },
    async markAttemptPending(attemptId) {
      const document = read();
      const existing = document.attempts[attemptId];
      if (existing) {
        document.attempts[attemptId] = {
          ...existing,
          retryCount: existing.retryCount + 1,
          state: 'pending',
        };
        write(document);
      }
    },
    async markAttemptV2Pending(attemptId) {
      const document = read();
      const existing = document.attemptsV2[attemptId];
      if (existing) {
        document.attemptsV2[attemptId] = {
          ...existing,
          retryCount: existing.retryCount + 1,
          state: 'pending',
          updatedAt: new Date().toISOString(),
        };
        write(document);
      }
    },
    async markAttemptV2Rejected(attemptId, code) {
      const document = read();
      const existing = document.attemptsV2[attemptId];
      if (existing) {
        document.attemptsV2[attemptId] = {
          ...existing,
          lastErrorCode: code,
          state: 'rejected',
          updatedAt: new Date().toISOString(),
        };
        write(document);
      }
    },
    async removeAttempts(attemptIds) {
      const document = read();
      for (const attemptId of attemptIds) delete document.attempts[attemptId];
      write(document);
    },
    async removeAttemptsV2(attemptIds) {
      const document = read();
      for (const attemptId of attemptIds) delete document.attemptsV2[attemptId];
      write(document);
    },
    async removeFormalSession(userId, sessionId) {
      const document = read();
      delete document.formalSessions[formalSessionCacheKey(userId, sessionId)];
      write(document);
    },
    async removeSyncCursor(scope) {
      const document = read();
      delete document.cursors[scope];
      write(document);
    },
    async saveAttemptV2AndSession(userId, attempt, snapshot) {
      const parsedSnapshot = FormalSessionCacheRecordSchema.parse(snapshot);
      const document = read();
      if (parsedSnapshot.userId !== userId) throw new Error('Formal Session user mismatch.');
      if (
        !parsedSnapshot.activities.some(
          (activity) => activity.sessionActivityId === attempt.sessionActivityId,
        )
      ) {
        throw new Error('Formal Attempt activity is outside the cached Session.');
      }
      if (document.attemptsV2[attempt.attemptId]) return 'duplicate';
      const timestamp = parsedSnapshot.updatedAt;
      document.attemptsV2[attempt.attemptId] = FormalAttemptOutboxRecordSchema.parse({
        schemaVersion: 'formal-attempt-outbox-v2',
        userId,
        sessionId: parsedSnapshot.sessionId,
        sessionActivityId: attempt.sessionActivityId,
        attempt,
        state: 'pending',
        retryCount: 0,
        lastErrorCode: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      document.formalSessions[formalSessionCacheKey(userId, parsedSnapshot.sessionId)] =
        parsedSnapshot;
      write(document);
      return 'inserted';
    },
    async saveAttemptAndSession(attempt, snapshot) {
      const parsedSnapshot = SessionSnapshotRecordSchema.parse(snapshot);
      const document = read();
      if (document.attempts[attempt.attemptId]) return 'duplicate';
      const timestamp = parsedSnapshot.updatedAt;
      document.attempts[attempt.attemptId] = OutboxRecordSchema.parse({
        schemaVersion: 'attempt-outbox-v1',
        attempt,
        sessionId: parsedSnapshot.sessionId,
        state: 'pending',
        retryCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      document.legacySessions[parsedSnapshot.sessionId] = parsedSnapshot;
      write(document);
      return 'inserted';
    },
    async saveFormalSession(snapshot) {
      const parsed = FormalSessionCacheRecordSchema.parse(snapshot);
      const document = read();
      const key = formalSessionCacheKey(parsed.userId, parsed.sessionId);
      const existing = FormalSessionCacheRecordSchema.safeParse(document.formalSessions[key]);
      if (existing.success && JSON.stringify(existing.data.plan) !== JSON.stringify(parsed.plan)) {
        throw new Error('Immutable formal Session snapshot conflict.');
      }
      document.formalSessions[key] = {
        ...parsed,
        completedActivityIds:
          existing.success &&
          existing.data.plan.contentManifestSha256 === parsed.plan.contentManifestSha256
            ? [...new Set([...existing.data.completedActivityIds, ...parsed.completedActivityIds])]
            : parsed.completedActivityIds,
        currentActivityPosition:
          existing.success &&
          existing.data.snapshotSchemaVersion === parsed.snapshotSchemaVersion &&
          existing.data.plan.contentManifestSha256 === parsed.plan.contentManifestSha256
            ? Math.max(existing.data.currentActivityPosition, parsed.currentActivityPosition)
            : parsed.currentActivityPosition,
      };
      write(document);
    },
    async saveSessionSnapshot(snapshot) {
      const parsed = SessionSnapshotRecordSchema.parse(snapshot);
      const document = read();
      document.legacySessions[parsed.sessionId] = parsed;
      write(document);
    },
    async setSyncCursor(scope, cursor) {
      const document = read();
      document.cursors[scope] = cursor;
      write(document);
    },
  };
}

export type { ContentCacheRecord, SessionSnapshotRecord };
