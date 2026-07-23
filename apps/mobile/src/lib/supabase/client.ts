import 'react-native-url-polyfill/auto';

import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { loadSupabasePublicConfig } from './config';
import {
  ChunkedSecureSessionStorage,
  MemorySessionStorage,
  type AsyncKeyValueDriver,
} from './secure-session-storage';

const secureStoreDriver: AsyncKeyValueDriver = {
  deleteItem: (key) => SecureStore.deleteItemAsync(key),
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    }),
};

const sessionStorage =
  Platform.OS === 'web'
    ? new MemorySessionStorage()
    : new ChunkedSecureSessionStorage(secureStoreDriver, () => Crypto.randomUUID());

export const supabaseConfiguration = loadSupabasePublicConfig({
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
});

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseConfiguration.configured) return null;
  if (cachedClient) return cachedClient;

  cachedClient = createClient(
    supabaseConfiguration.value.url,
    supabaseConfiguration.value.publishableKey,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        lock: processLock,
        persistSession: true,
        storage: sessionStorage,
      },
    },
  );
  return cachedClient;
}
