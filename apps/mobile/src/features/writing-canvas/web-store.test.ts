import { describe, expect, it } from 'vitest';

import { normalizeStrokePoint } from './model';
import { createWritingDraftRecord } from './storage-model';
import { createWebWritingDraftStore, WRITING_WEB_STORAGE_KEY } from './web-store';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

function record(ownerUserId: string, chineseName: string) {
  return createWritingDraftRecord({
    chineseName,
    ownerUserId,
    strokes: [
      {
        points: [
          normalizeStrokePoint({
            height: 100,
            timestamp: 1,
            width: 100,
            x: 50,
            y: 50,
          }),
        ],
      },
    ],
    updatedAt: '2026-07-23T12:00:00.000Z',
  });
}

describe('web writing draft store', () => {
  it('persists normalized traces across store instances', async () => {
    const storage = createStorage();
    await createWebWritingDraftStore(storage).save(record('user-a', '王家豪'));
    expect(await createWebWritingDraftStore(storage).load('user-a')).toEqual(
      record('user-a', '王家豪'),
    );
  });

  it('isolates drafts by the authenticated user id', async () => {
    const storage = createStorage();
    const store = createWebWritingDraftStore(storage);
    await store.save(record('user-a', '王家豪'));
    await store.save(record('user-b', '李明'));
    expect((await store.load('user-a'))?.chineseName).toBe('王家豪');
    expect((await store.load('user-b'))?.chineseName).toBe('李明');
    await store.clear('user-a');
    expect(await store.load('user-a')).toBeNull();
    expect((await store.load('user-b'))?.chineseName).toBe('李明');
  });

  it('does not return corrupt or cross-key raw data', async () => {
    const storage = createStorage();
    storage.setItem(
      WRITING_WEB_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        drafts: { 'user-a': record('user-b', '李明') },
      }),
    );
    expect(await createWebWritingDraftStore(storage).load('user-a')).toBeNull();
  });

  it('upgrades an existing V1 draft in place when it is read', async () => {
    const storage = createStorage();
    storage.setItem(
      WRITING_WEB_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        drafts: {
          'user-a': {
            schemaVersion: 'writing-draft-v1',
            modelVersion: 'writing-canvas-v1',
            ownerUserId: 'user-a',
            chineseName: '王',
            strokes: [{ points: [{ timestamp: 1, x: 0.5, y: 0.5 }] }],
            updatedAt: '2026-07-23T12:00:00.000Z',
          },
        },
      }),
    );
    expect(await createWebWritingDraftStore(storage).load('user-a')).toMatchObject({
      schemaVersion: 'writing-draft-v2',
      chineseName: '王',
      selectedStyle: 'clear',
    });
  });
});
