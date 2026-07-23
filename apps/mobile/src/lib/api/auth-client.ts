import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { createAuthClient } from 'better-auth/react';

import { apiConfiguration } from './config';

const baseURL = apiConfiguration.configured
  ? apiConfiguration.value.baseUrl
  : 'http://127.0.0.1:3001';

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: 'hanziquest',
      storage: SecureStore,
      storagePrefix: 'hanziquest',
    }) as never,
  ],
});

export function getAuthCookie(): string {
  return (authClient as unknown as { getCookie(): string }).getCookie();
}

export function accountServiceConfigured(): boolean {
  return apiConfiguration.configured;
}
