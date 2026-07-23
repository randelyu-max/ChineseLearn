import { Platform } from 'react-native';

import type { OfflineStore } from './model';
import { createWebOfflineStore } from './web-store';

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

let storePromise: Promise<OfflineStore> | null = null;

export function getOfflineStore(): Promise<OfflineStore> {
  storePromise ??=
    Platform.OS === 'web'
      ? Promise.resolve(
          createWebOfflineStore(
            typeof localStorage === 'undefined' ? fallbackStorage : localStorage,
          ),
        ).then(async (store) => {
          await store.initialize();
          return store;
        })
      : import('./sqlite-store').then(({ openSqliteOfflineStore }) => openSqliteOfflineStore());
  return storePromise;
}

export * from './model';
export * from './sync';
export * from './sync-with-api';
export { createWebOfflineStore } from './web-store';
