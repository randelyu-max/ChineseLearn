import { describe, expect, it } from 'vitest';

import {
  ACTIVE_DEMO_SESSION_ID,
  createSessionSnapshot,
  migrateWebDocument,
  type WebStoreDocument,
} from './model';
import { SQLITE_MIGRATIONS, SQLITE_SCHEMA_VERSION } from './sqlite-migrations';
import { createWebOfflineStore } from './web-store';

const attempt = {
  attemptId: '60000000-0000-4000-8000-000000000001',
  activityId: '60000000-0000-4000-8000-000000000002',
  answer: { optionId: '60000000-0000-4000-8000-000000000003' },
  isCorrectClient: true,
  responseMs: 1200,
  hintLevel: 'none',
  replayCount: 0,
  retryCount: 0,
  occurredAt: '2026-07-23T10:00:00.000Z',
  offlineSequence: 2,
} as const;

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe('versioned offline store', () => {
  it('atomically recovers a completed attempt and session after restart', async () => {
    const storage = memoryStorage();
    const firstProcess = createWebOfflineStore(storage);
    await firstProcess.initialize();
    const snapshot = createSessionSnapshot(
      ACTIVE_DEMO_SESSION_ID,
      { completedStageCount: 1 },
      '2026-07-23T10:00:01.000Z',
    );
    await expect(firstProcess.saveAttemptAndSession(attempt, snapshot)).resolves.toBe('inserted');

    const restartedProcess = createWebOfflineStore(storage);
    await restartedProcess.initialize();
    await expect(restartedProcess.listPendingAttempts()).resolves.toMatchObject([
      { attempt: { attemptId: attempt.attemptId }, state: 'pending' },
    ]);
    await expect(restartedProcess.getSessionSnapshot(ACTIVE_DEMO_SESSION_ID)).resolves.toEqual(
      snapshot,
    );
  });

  it('deduplicates attempts and returns them in offline sequence order', async () => {
    const storage = memoryStorage();
    const store = createWebOfflineStore(storage);
    await store.initialize();
    const snapshot = createSessionSnapshot(ACTIVE_DEMO_SESSION_ID, {}, '2026-07-23T10:00:01.000Z');
    await store.saveAttemptAndSession(attempt, snapshot);
    await expect(store.saveAttemptAndSession(attempt, snapshot)).resolves.toBe('duplicate');
    await store.saveAttemptAndSession(
      {
        ...attempt,
        attemptId: '60000000-0000-4000-8000-000000000004',
        offlineSequence: 1,
      },
      snapshot,
    );
    const pending = await store.listPendingAttempts();
    expect(pending.map((item) => item.attempt.offlineSequence)).toEqual([1, 2]);
  });

  it('isolates corrupted queue entries without losing valid attempts', async () => {
    const storage = memoryStorage();
    const store = createWebOfflineStore(storage);
    await store.initialize();
    await store.saveAttemptAndSession(
      attempt,
      createSessionSnapshot(ACTIVE_DEMO_SESSION_ID, {}, '2026-07-23T10:00:01.000Z'),
    );
    const [key, raw] = [...storage.values.entries()][0] ?? [];
    expect(key).toBeTruthy();
    const document = JSON.parse(raw ?? '') as WebStoreDocument;
    document.attempts.corrupt = { broken: true } as never;
    storage.setItem(key ?? '', JSON.stringify(document));
    await expect(store.listPendingAttempts()).resolves.toHaveLength(1);
    expect(JSON.parse(storage.getItem(key ?? '') ?? '').attempts.corrupt).toBeUndefined();
  });

  it('migrates the legacy queue document and preserves valid attempts', () => {
    const timestamp = '2026-07-23T10:00:01.000Z';
    const migrated = migrateWebDocument({
      schemaVersion: 1,
      queue: [
        {
          schemaVersion: 'attempt-outbox-v1',
          attempt,
          sessionId: ACTIVE_DEMO_SESSION_ID,
          state: 'pending',
          retryCount: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        { broken: true },
      ],
    });
    expect(migrated.schemaVersion).toBe(3);
    expect(Object.keys(migrated.attempts)).toEqual([attempt.attemptId]);
    expect(migrated.formalSessions).toEqual({});
    expect(migrated.legacySessions).toEqual({});
  });

  it('persists content and cursors and supports export/clear recovery', async () => {
    const storage = memoryStorage();
    const store = createWebOfflineStore(storage);
    await store.initialize();
    await store.cacheContent({
      schemaVersion: 'content-cache-v1',
      contentVersion: '1.0.0',
      contentSchemaVersion: 'curriculum-package-v1',
      payload: { lesson: '家' },
      cachedAt: '2026-07-23T10:00:00.000Z',
    });
    await store.setSyncCursor('attempts', 'cursor-2');
    await expect(store.getContent('1.0.0')).resolves.toMatchObject({
      payload: { lesson: '家' },
    });
    await expect(store.getSyncCursor('attempts')).resolves.toBe('cursor-2');
    expect(JSON.parse(await store.exportForRecovery()).schemaVersion).toBe(3);
    await store.clearAll();
    await expect(store.getSyncCursor('attempts')).resolves.toBeNull();
  });
});

describe('SQLite migration plan', () => {
  it('is contiguous, versioned, and contains only the required local data', () => {
    expect(SQLITE_MIGRATIONS.map(({ from, to }) => [from, to])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
    expect(SQLITE_MIGRATIONS.at(-1)?.to).toBe(SQLITE_SCHEMA_VERSION);
    const sql = SQLITE_MIGRATIONS.map((migration) => migration.sql)
      .join('\n')
      .toLowerCase();
    for (const table of [
      'local_content_cache',
      'local_session_snapshots',
      'local_attempt_outbox',
      'local_sync_cursors',
      'local_formal_session_snapshots',
      'local_attempt_outbox_v2',
      'local_formal_session_quarantine',
    ]) {
      expect(sql).toContain(table);
    }
    expect(sql).not.toContain('signature');
    expect(sql).not.toContain('profile');
  });
});
