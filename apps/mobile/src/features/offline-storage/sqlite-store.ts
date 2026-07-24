import {
  AttemptDraftSchema,
  AttemptDraftV2Schema,
  type AttemptDraft,
  type AttemptDraftV2,
} from '@hanziquest/contracts';
import * as SQLite from 'expo-sqlite';

import {
  ContentCacheRecordSchema,
  FormalAttemptOutboxRecordSchema,
  FormalSessionCacheRecordSchema,
  OutboxRecordSchema,
  SessionSnapshotRecordSchema,
  parseAttemptPayload,
  parseAttemptV2Payload,
  type ContentCacheRecord,
  type FormalAttemptOutboxRecord,
  type FormalSessionCacheRecord,
  type OfflineStore,
  type OutboxRecord,
  type SessionSnapshotRecord,
} from './model';
import { SQLITE_MIGRATIONS, SQLITE_SCHEMA_VERSION } from './sqlite-migrations';

export const SQLITE_DATABASE_NAME = 'hanziquest-offline.db';

type ContentRow = {
  cached_at: string;
  content_version: string;
  payload_json: string;
  schema_version: string;
};

type SessionRow = {
  payload_json: string;
  schema_version: string;
  session_id: string;
  updated_at: string;
};

type AttemptRow = {
  attempt_id: string;
  created_at: string;
  payload_json: string;
  retry_count: number;
  session_id: string;
  state: 'in_flight' | 'pending';
  updated_at: string;
};

type FormalSessionRow = {
  payload_json: string;
  session_id: string;
  snapshot_schema_version: string;
  status: FormalSessionCacheRecord['status'];
  updated_at: string;
  user_id: string;
};

type AttemptV2Row = {
  attempt_id: string;
  created_at: string;
  last_error_code: string | null;
  payload_json: string;
  retry_count: number;
  session_activity_id: string;
  session_id: string;
  state: 'in_flight' | 'pending' | 'rejected';
  updated_at: string;
  user_id: string;
};

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync('pragma journal_mode = wal; pragma foreign_keys = on;');
  const version = await database.getFirstAsync<{ user_version: number }>('pragma user_version');
  let current = version?.user_version ?? 0;
  for (const migration of SQLITE_MIGRATIONS) {
    if (current !== migration.from) continue;
    await database.withTransactionAsync(async () => {
      await database.execAsync(migration.sql);
      await database.execAsync(`pragma user_version = ${migration.to}`);
    });
    current = migration.to;
  }
  if (current !== SQLITE_SCHEMA_VERSION) {
    throw new Error('Unsupported local database schema version.');
  }
  await database.runAsync(
    `update local_attempt_outbox
     set state = 'pending', retry_count = retry_count + 1, updated_at = ?
     where state = 'in_flight'`,
    new Date().toISOString(),
  );
  await database.runAsync(
    `update local_attempt_outbox_v2
     set state = 'pending', retry_count = retry_count + 1, updated_at = ?
     where state = 'in_flight'`,
    new Date().toISOString(),
  );
}

function sessionFromRow(row: SessionRow | null): SessionSnapshotRecord | null {
  if (!row) return null;
  try {
    return SessionSnapshotRecordSchema.parse({
      schemaVersion: row.schema_version,
      sessionId: row.session_id,
      payload: JSON.parse(row.payload_json),
      updatedAt: row.updated_at,
    });
  } catch {
    return null;
  }
}

function formalSessionFromRow(row: FormalSessionRow | null): FormalSessionCacheRecord | null {
  if (!row) return null;
  try {
    return FormalSessionCacheRecordSchema.parse(JSON.parse(row.payload_json));
  } catch {
    return null;
  }
}

export function createSqliteOfflineStore(database: SQLite.SQLiteDatabase): OfflineStore {
  return {
    async initialize() {
      await migrate(database);
    },
    async cacheContent(record) {
      const parsed = ContentCacheRecordSchema.parse(record);
      await database.runAsync(
        `insert into local_content_cache (
           content_version, schema_version, payload_json, cached_at
         ) values (?, ?, ?, ?)
         on conflict (content_version) do update set
           schema_version = excluded.schema_version,
           payload_json = excluded.payload_json,
           cached_at = excluded.cached_at`,
        parsed.contentVersion,
        parsed.contentSchemaVersion,
        JSON.stringify(parsed.payload),
        parsed.cachedAt,
      );
    },
    async clearAll() {
      await database.withTransactionAsync(async () => {
        await database.execAsync(`
          delete from local_attempt_outbox_v2;
          delete from local_formal_session_snapshots;
          delete from local_formal_session_quarantine;
          delete from local_attempt_outbox;
          delete from local_session_snapshots;
          delete from local_content_cache;
          delete from local_sync_cursors;
        `);
      });
    },
    async clearUser(userId) {
      await database.withTransactionAsync(async () => {
        await database.runAsync('delete from local_attempt_outbox_v2 where user_id = ?', userId);
        await database.runAsync(
          'delete from local_formal_session_snapshots where user_id = ?',
          userId,
        );
        await database.runAsync(
          'delete from local_formal_session_quarantine where user_id = ?',
          userId,
        );
        await database.runAsync(
          `delete from local_sync_cursors where scope like ? escape '\\'`,
          `${userId.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}:%`,
        );
      });
    },
    async exportForRecovery() {
      const [content, legacySessions, attempts, cursors, formalSessions, attemptsV2, quarantine] =
        await Promise.all([
          database.getAllAsync('select * from local_content_cache order by content_version'),
          database.getAllAsync('select * from local_session_snapshots order by session_id'),
          database.getAllAsync(
            `select attempt_id, session_id, offline_sequence, payload_json, state,
             retry_count, created_at, updated_at, last_error_code
           from local_attempt_outbox order by offline_sequence, attempt_id`,
          ),
          database.getAllAsync('select * from local_sync_cursors order by scope'),
          database.getAllAsync(
            `select * from local_formal_session_snapshots
           order by user_id, session_id, snapshot_schema_version`,
          ),
          database.getAllAsync(
            `select * from local_attempt_outbox_v2
           order by user_id, occurred_at, offline_sequence, attempt_id`,
          ),
          database.getAllAsync(
            'select * from local_formal_session_quarantine order by quarantined_at, cache_key',
          ),
        ]);
      return JSON.stringify({
        schemaVersion: SQLITE_SCHEMA_VERSION,
        attempts,
        attemptsV2,
        content,
        cursors,
        formalSessions,
        legacySessions,
        quarantine,
      });
    },
    async getActiveFormalSession(userId) {
      const rows = await database.getAllAsync<FormalSessionRow>(
        `select user_id, session_id, snapshot_schema_version, status, payload_json, updated_at
         from local_formal_session_snapshots
         where user_id = ? and status in ('planned', 'in_progress')
         order by updated_at desc, session_id desc`,
        userId,
      );
      for (const row of rows) {
        const parsed = formalSessionFromRow(row);
        if (parsed) return parsed;
        await database.withTransactionAsync(async () => {
          await database.runAsync(
            `insert into local_formal_session_quarantine (
               cache_key, user_id, session_id, reason_code, quarantined_at
             ) values (?, ?, ?, 'LOCAL_SNAPSHOT_INVALID', ?)
             on conflict (cache_key) do update set
               reason_code = excluded.reason_code,
               quarantined_at = excluded.quarantined_at`,
            `${row.user_id}:${row.session_id}:${row.snapshot_schema_version}`,
            row.user_id,
            row.session_id,
            new Date().toISOString(),
          );
          await database.runAsync(
            `delete from local_formal_session_snapshots
             where user_id = ? and session_id = ? and snapshot_schema_version = ?`,
            row.user_id,
            row.session_id,
            row.snapshot_schema_version,
          );
        });
      }
      return null;
    },
    async getContent(contentVersion) {
      const row = await database.getFirstAsync<ContentRow>(
        `select content_version, schema_version, payload_json, cached_at
         from local_content_cache where content_version = ?`,
        contentVersion,
      );
      if (!row) return null;
      try {
        return ContentCacheRecordSchema.parse({
          schemaVersion: 'content-cache-v1',
          contentVersion: row.content_version,
          contentSchemaVersion: row.schema_version,
          payload: JSON.parse(row.payload_json),
          cachedAt: row.cached_at,
        });
      } catch {
        return null;
      }
    },
    async getFormalSession(userId, sessionId) {
      const row = await database.getFirstAsync<FormalSessionRow>(
        `select user_id, session_id, snapshot_schema_version, status, payload_json, updated_at
         from local_formal_session_snapshots
         where user_id = ? and session_id = ? and snapshot_schema_version = ?
         limit 1`,
        userId,
        sessionId,
        'session-plan-snapshot-v2',
      );
      const parsed = formalSessionFromRow(row);
      if (!parsed && row) {
        await database.withTransactionAsync(async () => {
          await database.runAsync(
            `insert into local_formal_session_quarantine (
               cache_key, user_id, session_id, reason_code, quarantined_at
             ) values (?, ?, ?, 'LOCAL_SNAPSHOT_INVALID', ?)
             on conflict (cache_key) do update set
               reason_code = excluded.reason_code,
               quarantined_at = excluded.quarantined_at`,
            `${row.user_id}:${row.session_id}:${row.snapshot_schema_version}`,
            row.user_id,
            row.session_id,
            new Date().toISOString(),
          );
          await database.runAsync(
            `delete from local_formal_session_snapshots
             where user_id = ? and session_id = ? and snapshot_schema_version = ?`,
            row.user_id,
            row.session_id,
            row.snapshot_schema_version,
          );
        });
      }
      return parsed;
    },
    async getSessionSnapshot(sessionId) {
      const row = await database.getFirstAsync<SessionRow>(
        `select session_id, schema_version, payload_json, updated_at
         from local_session_snapshots where session_id = ?`,
        sessionId,
      );
      const parsed = sessionFromRow(row);
      if (!parsed && row) {
        await database.runAsync(
          'delete from local_session_snapshots where session_id = ?',
          sessionId,
        );
      }
      return parsed;
    },
    async getSyncCursor(scope) {
      const row = await database.getFirstAsync<{ cursor: string }>(
        'select cursor from local_sync_cursors where scope = ?',
        scope,
      );
      return row?.cursor ?? null;
    },
    async listPendingAttempts(limit = 50) {
      const rows = await database.getAllAsync<AttemptRow>(
        `select attempt_id, session_id, payload_json, state, retry_count, created_at, updated_at
         from local_attempt_outbox
         where state in ('pending', 'in_flight')
         order by offline_sequence, attempt_id
         limit ?`,
        Math.max(1, Math.min(100, limit)),
      );
      const valid: OutboxRecord[] = [];
      for (const row of rows) {
        const attempt = parseAttemptPayload(row.payload_json);
        if (!attempt) {
          await database.runAsync(
            `update local_attempt_outbox
             set state = 'corrupt', last_error_code = 'LOCAL_PAYLOAD_INVALID'
             where attempt_id = ?`,
            row.attempt_id,
          );
          continue;
        }
        valid.push(
          OutboxRecordSchema.parse({
            schemaVersion: 'attempt-outbox-v1',
            attempt,
            sessionId: row.session_id,
            state: row.state === 'in_flight' ? 'pending' : row.state,
            retryCount: row.retry_count,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }),
        );
      }
      return valid;
    },
    async listPendingAttemptsV2(userId, limit = 50) {
      const rows = await database.getAllAsync<AttemptV2Row>(
        `select attempt_id, user_id, session_id, session_activity_id, payload_json, state,
           retry_count, last_error_code, created_at, updated_at
         from local_attempt_outbox_v2
         where user_id = ? and state in ('pending', 'in_flight')
         order by occurred_at, offline_sequence, attempt_id
         limit ?`,
        userId,
        Math.max(1, Math.min(100, limit)),
      );
      const valid: FormalAttemptOutboxRecord[] = [];
      for (const row of rows) {
        const attempt = parseAttemptV2Payload(row.payload_json);
        if (!attempt) {
          await database.runAsync(
            `update local_attempt_outbox_v2
             set state = 'corrupt', last_error_code = 'LOCAL_PAYLOAD_INVALID'
             where attempt_id = ?`,
            row.attempt_id,
          );
          continue;
        }
        valid.push(
          FormalAttemptOutboxRecordSchema.parse({
            schemaVersion: 'formal-attempt-outbox-v2',
            userId: row.user_id,
            sessionId: row.session_id,
            sessionActivityId: row.session_activity_id,
            attempt,
            state: row.state === 'in_flight' ? 'pending' : row.state,
            retryCount: row.retry_count,
            lastErrorCode: row.last_error_code,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }),
        );
      }
      return valid;
    },
    async markAttemptPending(attemptId) {
      await database.runAsync(
        `update local_attempt_outbox
         set state = 'pending', retry_count = retry_count + 1, updated_at = ?
         where attempt_id = ?`,
        new Date().toISOString(),
        attemptId,
      );
    },
    async markAttemptV2Pending(attemptId) {
      await database.runAsync(
        `update local_attempt_outbox_v2
         set state = 'pending', retry_count = retry_count + 1, updated_at = ?
         where attempt_id = ?`,
        new Date().toISOString(),
        attemptId,
      );
    },
    async markAttemptV2Rejected(attemptId, code) {
      await database.runAsync(
        `update local_attempt_outbox_v2
         set state = 'rejected', last_error_code = ?, updated_at = ?
         where attempt_id = ?`,
        code,
        new Date().toISOString(),
        attemptId,
      );
    },
    async removeAttempts(attemptIds) {
      if (attemptIds.length === 0) return;
      await database.withTransactionAsync(async () => {
        for (const attemptId of attemptIds) {
          await database.runAsync(
            'delete from local_attempt_outbox where attempt_id = ?',
            attemptId,
          );
        }
      });
    },
    async removeAttemptsV2(attemptIds) {
      if (attemptIds.length === 0) return;
      await database.withTransactionAsync(async () => {
        for (const attemptId of attemptIds) {
          await database.runAsync(
            'delete from local_attempt_outbox_v2 where attempt_id = ?',
            attemptId,
          );
        }
      });
    },
    async removeFormalSession(userId, sessionId) {
      await database.runAsync(
        `delete from local_formal_session_snapshots
         where user_id = ? and session_id = ?`,
        userId,
        sessionId,
      );
    },
    async removeSyncCursor(scope) {
      await database.runAsync('delete from local_sync_cursors where scope = ?', scope);
    },
    async saveAttemptV2AndSession(
      userId: string,
      attempt: AttemptDraftV2,
      snapshot: FormalSessionCacheRecord,
    ) {
      const parsedAttempt = AttemptDraftV2Schema.parse(attempt);
      const parsedSnapshot = FormalSessionCacheRecordSchema.parse(snapshot);
      if (parsedSnapshot.userId !== userId) throw new Error('Formal Session user mismatch.');
      if (
        !parsedSnapshot.activities.some(
          (activity) => activity.sessionActivityId === parsedAttempt.sessionActivityId,
        )
      ) {
        throw new Error('Formal Attempt activity is outside the cached Session.');
      }
      let inserted = false;
      await database.withTransactionAsync(async () => {
        const result = await database.runAsync(
          `insert into local_attempt_outbox_v2 (
             attempt_id, user_id, session_id, session_activity_id, offline_sequence, occurred_at,
             payload_json, state, retry_count, last_error_code, created_at, updated_at
           ) values (?, ?, ?, ?, ?, ?, ?, 'pending', 0, null, ?, ?)
           on conflict (attempt_id) do nothing`,
          parsedAttempt.attemptId,
          userId,
          parsedSnapshot.sessionId,
          parsedAttempt.sessionActivityId,
          parsedAttempt.offlineSequence,
          parsedAttempt.occurredAt,
          JSON.stringify(parsedAttempt),
          parsedSnapshot.updatedAt,
          parsedSnapshot.updatedAt,
        );
        inserted = result.changes === 1;
        if (inserted) {
          await database.runAsync(
            `insert into local_formal_session_snapshots (
               user_id, session_id, snapshot_schema_version, status, payload_json, updated_at
             ) values (?, ?, ?, ?, ?, ?)
             on conflict (user_id, session_id, snapshot_schema_version) do update set
               status = excluded.status,
               payload_json = excluded.payload_json,
               updated_at = excluded.updated_at`,
            userId,
            parsedSnapshot.sessionId,
            parsedSnapshot.snapshotSchemaVersion,
            parsedSnapshot.status,
            JSON.stringify(parsedSnapshot),
            parsedSnapshot.updatedAt,
          );
        }
      });
      return inserted ? 'inserted' : 'duplicate';
    },
    async saveAttemptAndSession(attempt: AttemptDraft, snapshot) {
      const parsedAttempt = AttemptDraftSchema.parse(attempt);
      const parsedSnapshot = SessionSnapshotRecordSchema.parse(snapshot);
      let inserted = false;
      await database.withTransactionAsync(async () => {
        const result = await database.runAsync(
          `insert into local_attempt_outbox (
             attempt_id, session_id, offline_sequence, payload_json, state,
             retry_count, created_at, updated_at
           ) values (?, ?, ?, ?, 'pending', 0, ?, ?)
           on conflict (attempt_id) do nothing`,
          parsedAttempt.attemptId,
          parsedSnapshot.sessionId,
          parsedAttempt.offlineSequence,
          JSON.stringify(parsedAttempt),
          parsedSnapshot.updatedAt,
          parsedSnapshot.updatedAt,
        );
        inserted = result.changes === 1;
        if (inserted) {
          await database.runAsync(
            `insert into local_session_snapshots (
               session_id, schema_version, payload_json, updated_at
             ) values (?, ?, ?, ?)
             on conflict (session_id) do update set
               schema_version = excluded.schema_version,
               payload_json = excluded.payload_json,
               updated_at = excluded.updated_at`,
            parsedSnapshot.sessionId,
            parsedSnapshot.schemaVersion,
            JSON.stringify(parsedSnapshot.payload),
            parsedSnapshot.updatedAt,
          );
        }
      });
      return inserted ? 'inserted' : 'duplicate';
    },
    async saveFormalSession(snapshot) {
      const parsed = FormalSessionCacheRecordSchema.parse(snapshot);
      const existing = await database.getFirstAsync<FormalSessionRow>(
        `select user_id, session_id, snapshot_schema_version, status, payload_json, updated_at
         from local_formal_session_snapshots
         where user_id = ? and session_id = ? and snapshot_schema_version = ?`,
        parsed.userId,
        parsed.sessionId,
        parsed.snapshotSchemaVersion,
      );
      const previous = formalSessionFromRow(existing);
      if (previous && JSON.stringify(previous.plan) !== JSON.stringify(parsed.plan)) {
        throw new Error('Immutable formal Session snapshot conflict.');
      }
      const merged = {
        ...parsed,
        completedActivityIds:
          previous && previous.plan.contentManifestSha256 === parsed.plan.contentManifestSha256
            ? [...new Set([...previous.completedActivityIds, ...parsed.completedActivityIds])]
            : parsed.completedActivityIds,
        currentActivityPosition:
          previous && previous.plan.contentManifestSha256 === parsed.plan.contentManifestSha256
            ? Math.max(previous.currentActivityPosition, parsed.currentActivityPosition)
            : parsed.currentActivityPosition,
      };
      await database.runAsync(
        `insert into local_formal_session_snapshots (
           user_id, session_id, snapshot_schema_version, status, payload_json, updated_at
         ) values (?, ?, ?, ?, ?, ?)
         on conflict (user_id, session_id, snapshot_schema_version) do update set
           status = excluded.status,
           payload_json = excluded.payload_json,
           updated_at = excluded.updated_at`,
        merged.userId,
        merged.sessionId,
        merged.snapshotSchemaVersion,
        merged.status,
        JSON.stringify(merged),
        merged.updatedAt,
      );
    },
    async saveSessionSnapshot(snapshot) {
      const parsed = SessionSnapshotRecordSchema.parse(snapshot);
      await database.runAsync(
        `insert into local_session_snapshots (
           session_id, schema_version, payload_json, updated_at
         ) values (?, ?, ?, ?)
         on conflict (session_id) do update set
           schema_version = excluded.schema_version,
           payload_json = excluded.payload_json,
           updated_at = excluded.updated_at`,
        parsed.sessionId,
        parsed.schemaVersion,
        JSON.stringify(parsed.payload),
        parsed.updatedAt,
      );
    },
    async setSyncCursor(scope, cursor) {
      await database.runAsync(
        `insert into local_sync_cursors (scope, cursor, updated_at)
         values (?, ?, ?)
         on conflict (scope) do update set
           cursor = excluded.cursor,
           updated_at = excluded.updated_at`,
        scope,
        cursor,
        new Date().toISOString(),
      );
    },
  };
}

export async function openSqliteOfflineStore(): Promise<OfflineStore> {
  const database = await SQLite.openDatabaseAsync(SQLITE_DATABASE_NAME);
  const store = createSqliteOfflineStore(database);
  await store.initialize();
  return store;
}

export type { ContentCacheRecord, SessionSnapshotRecord };
