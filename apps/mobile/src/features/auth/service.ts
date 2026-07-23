import * as Linking from 'expo-linking';

import { authClient } from '@/lib/api/auth-client';

export type AuthResult<T = undefined> = { ok: true; value: T } | { ok: false; notice: string };

function authFailure(error: unknown): AuthResult<never> {
  const message =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message.toLowerCase()
      : '';
  if (message.includes('invalid') || message.includes('password')) {
    return { ok: false, notice: '邮箱或密码不正确。' };
  }
  if (message.includes('network') || message.includes('fetch')) {
    return { ok: false, notice: '当前无法连接网络，请稍后重试。' };
  }
  return { ok: false, notice: '暂时无法完成此操作，请稍后重试。' };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const result = await authClient.signIn.email({ email: email.trim(), password });
    return result.error ? authFailure(result.error) : { ok: true, value: undefined };
  } catch (error) {
    return authFailure(error);
  }
}

export async function signUp(
  email: string,
  password: string,
): Promise<AuthResult<{ emailConfirmationRequired: boolean }>> {
  try {
    const normalizedEmail = email.trim();
    const result = await authClient.signUp.email({
      callbackURL: Linking.createURL('/'),
      email: normalizedEmail,
      name: normalizedEmail.split('@')[0] || 'HanziQuest learner',
      password,
    });
    if (result.error) return authFailure(result.error);
    return {
      ok: true,
      value: { emailConfirmationRequired: !result.data?.token },
    };
  } catch (error) {
    return authFailure(error);
  }
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  try {
    const result = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: Linking.createURL('/update-password'),
    });
    return result.error ? authFailure(result.error) : { ok: true, value: undefined };
  } catch (error) {
    return authFailure(error);
  }
}

export async function updatePassword(password: string, token: string): Promise<AuthResult> {
  try {
    const result = await authClient.resetPassword({ newPassword: password, token });
    return result.error ? authFailure(result.error) : { ok: true, value: undefined };
  } catch (error) {
    return authFailure(error);
  }
}

export async function signOut(): Promise<AuthResult> {
  try {
    const result = await authClient.signOut();
    return result.error ? authFailure(result.error) : { ok: true, value: undefined };
  } catch (error) {
    return authFailure(error);
  }
}

export function passwordResetToken(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('token');
  } catch {
    return null;
  }
}
