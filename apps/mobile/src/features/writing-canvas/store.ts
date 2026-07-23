import { Platform } from 'react-native';

import type { WritingDraftStore } from './storage-model';
import { createWebWritingDraftStore } from './web-store';

const fallbackValues = new Map<string, string>();
const fallbackStorage = {
  getItem(key: string) {
    return fallbackValues.get(key) ?? null;
  },
  removeItem(key: string) {
    fallbackValues.delete(key);
  },
  setItem(key: string, value: string) {
    fallbackValues.set(key, value);
  },
};

let storePromise: Promise<WritingDraftStore> | null = null;

export function getWritingDraftStore(): Promise<WritingDraftStore> {
  storePromise ??=
    Platform.OS === 'web'
      ? Promise.resolve(
          createWebWritingDraftStore(
            typeof localStorage === 'undefined' ? fallbackStorage : localStorage,
          ),
        )
      : import('./sqlite-store').then(({ openSqliteWritingDraftStore }) =>
          openSqliteWritingDraftStore(),
        );
  return storePromise;
}
