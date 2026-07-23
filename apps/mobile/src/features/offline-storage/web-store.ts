import {
  ContentCacheRecordSchema,
  migrateWebDocument,
  OutboxRecordSchema,
  SessionSnapshotRecordSchema,
  type ContentCacheRecord,
  type OfflineStore,
  type OutboxRecord,
  type SessionSnapshotRecord,
  type WebStoreDocument,
} from './model';

const STORAGE_KEY = 'hanziquest.offline-store.v2';

type StorageLike = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export function createWebOfflineStore(storage: StorageLike): OfflineStore {
  function read(): WebStoreDocument {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return migrateWebDocument(null);
    try {
      return migrateWebDocument(JSON.parse(raw));
    } catch {
      return migrateWebDocument(null);
    }
  }

  function write(document: WebStoreDocument): void {
    storage.setItem(STORAGE_KEY, JSON.stringify(document));
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
    },
    async exportForRecovery() {
      return JSON.stringify(read());
    },
    async getContent(contentVersion) {
      const record = read().content[contentVersion];
      const parsed = ContentCacheRecordSchema.safeParse(record);
      return parsed.success ? parsed.data : null;
    },
    async getSessionSnapshot(sessionId) {
      const record = read().sessions[sessionId];
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
    async removeAttempts(attemptIds) {
      const document = read();
      for (const attemptId of attemptIds) delete document.attempts[attemptId];
      write(document);
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
      document.sessions[parsedSnapshot.sessionId] = parsedSnapshot;
      write(document);
      return 'inserted';
    },
    async saveSessionSnapshot(snapshot) {
      const parsed = SessionSnapshotRecordSchema.parse(snapshot);
      const document = read();
      document.sessions[parsed.sessionId] = parsed;
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
