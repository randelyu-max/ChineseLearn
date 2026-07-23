import { Platform } from 'react-native';

import { getAuthCookie } from './auth-client';
import { apiConfiguration } from './config';

export type ApiResult<T> = { ok: true; value: T } | { ok: false; status: number; code: string };

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  if (!apiConfiguration.configured) {
    return { ok: false, status: 0, code: 'not_configured' };
  }
  try {
    const headers = new Headers(init.headers);
    headers.set('accept', 'application/json');
    if (init.body) headers.set('content-type', 'application/json');
    if (Platform.OS !== 'web') {
      const cookie = getAuthCookie();
      if (cookie) headers.set('cookie', cookie);
    }
    const response = await fetch(`${apiConfiguration.value.baseUrl}${path}`, {
      ...init,
      credentials: Platform.OS === 'web' ? 'include' : 'omit',
      headers,
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
      return {
        ok: false,
        status: response.status,
        code: typeof body?.code === 'string' ? body.code : 'request_failed',
      };
    }
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, status: 0, code: 'network_unavailable' };
  }
}
