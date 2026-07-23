import { AttemptDraftSchema, type AttemptDraft } from '@hanziquest/contracts';
import * as SQLite from 'expo-sqlite';

import {
  ContentCacheRecordSchema,
  OutboxRecordSchema,
  SessionSnapshotRecordSchema,
  parseAttemptPayload,
  type ContentCacheRecord,
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
          delete from local_attempt_outbox;
          delete from local_session_snapshots;
          delete from local_content_cache;
          delete from local_sync_cursors;
        `);
      });
    },
    async exportForRecovery() {
      const [content, sessions, attempts, cursors] = await Promise.all([
        database.getAllAsync('select * from local_content_cache order by content_version'),
        database.getAllAsync('select * from local_session_snapshots order by session_id'),
        database.getAllAsync(
          `select attempt_id, session_id, offline_sequence, payload_json, state,
             retry_count, created_at, updated_at, last_error_code
           from local_attempt_outbox order by offline_sequence, attempt_id`,
        ),
        database.getAllAsync('select * from local_sync_cursors order by scope'),
      ]);
      return JSON.stringify({
        schemaVersion: SQLITE_SCHEMA_VERSION,
        attempts,
        content,
        cursors,
        sessions,
      });
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
    async markAttemptPending(attemptId) {
      await database.runAsync(
        `update local_attempt_outbox
         set state = 'pending', retry_count = retry_count + 1, updated_at = ?
         where attempt_id = ?`,
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
