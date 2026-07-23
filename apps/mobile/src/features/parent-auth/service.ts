import type { SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';

import { parseAuthCallback } from '../../lib/supabase/auth-callback';

import { safeAuthNotice, type AuthNoticeCode } from './model';

export type AuthActionResult<T = undefined> =
  { ok: true; value: T } | { ok: false; notice: AuthNoticeCode };

function failure(error: unknown): AuthActionResult<never> {
  return { ok: false, notice: safeAuthNotice(error) };
}

export async function signInParent(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<AuthActionResult<{ email: string | null }>> {
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return failure(error);
    return { ok: true, value: { email: data.user?.email ?? null } };
  } catch (error) {
    return failure(error);
  }
}

export async function requestParentPasswordReset(
  client: SupabaseClient,
  email: string,
): Promise<AuthActionResult> {
  try {
    const redirectTo = Linking.createURL('/parent-update-password');
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (error) return failure(error);
    return { ok: true, value: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function updateParentPassword(
  client: SupabaseClient,
  password: string,
): Promise<AuthActionResult> {
  try {
    const { error } = await client.auth.updateUser({ password });
    if (error) return failure(error);
    return { ok: true, value: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function signOutParent(client: SupabaseClient): Promise<AuthActionResult> {
  try {
    const { error } = await client.auth.signOut();
    if (error) {
      const { error: localError } = await client.auth.signOut({ scope: 'local' });
      if (localError) return failure(localError);
    }
    return { ok: true, value: undefined };
  } catch (error) {
    try {
      const { error: localError } = await client.auth.signOut({ scope: 'local' });
      if (localError) return failure(localError);
      return { ok: true, value: undefined };
    } catch (localError) {
      return failure(localError ?? error);
    }
  }
}

export async function consumeAuthCallback(
  client: SupabaseClient,
  url: string,
): Promise<AuthActionResult<{ recovery: boolean } | null>> {
  const callback = parseAuthCallback(url);
  if (callback.kind === 'ignored') return { ok: true, value: null };

  try {
    if (callback.kind === 'code') {
      const { error } = await client.auth.exchangeCodeForSession(callback.code);
      if (error) return failure(error);
      return { ok: true, value: { recovery: callback.recovery } };
    }

    const { error } = await client.auth.setSession({
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken,
    });
    if (error) return failure(error);
    return { ok: true, value: { recovery: callback.recovery } };
  } catch (error) {
    return failure(error);
  }
}
