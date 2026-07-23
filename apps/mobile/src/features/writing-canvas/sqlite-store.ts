import * as SQLite from 'expo-sqlite';

import {
  WritingDraftRecordSchema,
  type WritingDraftRecord,
  type WritingDraftStore,
} from './storage-model';

export const WRITING_SQLITE_DATABASE_NAME = 'hanziquest-writing.db';

type WritingDraftRow = {
  owner_user_id: string;
  payload_json: string;
};

async function initialize(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    pragma journal_mode = wal;
    create table if not exists local_writing_drafts (
      owner_user_id text primary key not null,
      payload_json text not null,
      updated_at text not null
    );
  `);
}

function parseRow(row: WritingDraftRow | null): WritingDraftRecord | null {
  if (!row) return null;
  try {
    const parsed = WritingDraftRecordSchema.parse(JSON.parse(row.payload_json));
    return parsed.ownerUserId === row.owner_user_id ? parsed : null;
  } catch {
    return null;
  }
}

export function createSqliteWritingDraftStore(database: SQLite.SQLiteDatabase): WritingDraftStore {
  return {
    async clear(ownerUserId) {
      await database.runAsync(
        'delete from local_writing_drafts where owner_user_id = ?',
        ownerUserId,
      );
    },
    async load(ownerUserId) {
      const row = await database.getFirstAsync<WritingDraftRow>(
        `select owner_user_id, payload_json
         from local_writing_drafts where owner_user_id = ?`,
        ownerUserId,
      );
      const parsed = parseRow(row);
      if (!parsed && row) {
        await database.runAsync(
          'delete from local_writing_drafts where owner_user_id = ?',
          ownerUserId,
        );
      }
      return parsed;
    },
    async save(record) {
      const parsed = WritingDraftRecordSchema.parse(record);
      await database.runAsync(
        `insert into local_writing_drafts (owner_user_id, payload_json, updated_at)
         values (?, ?, ?)
         on conflict (owner_user_id) do update set
           payload_json = excluded.payload_json,
           updated_at = excluded.updated_at`,
        parsed.ownerUserId,
        JSON.stringify(parsed),
        parsed.updatedAt,
      );
    },
  };
}

export async function openSqliteWritingDraftStore(): Promise<WritingDraftStore> {
  const database = await SQLite.openDatabaseAsync(WRITING_SQLITE_DATABASE_NAME);
  await initialize(database);
  return createSqliteWritingDraftStore(database);
}
