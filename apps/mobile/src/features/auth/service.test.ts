import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  passwordResetToken,
  requestPasswordReset,
  signOut,
  signUp,
  updatePassword,
} from './service';

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  signInEmail: vi.fn(),
  signOut: vi.fn(),
  signUpEmail: vi.fn(),
}));

vi.mock('@/lib/api/auth-client', () => ({
  authClient: {
    requestPasswordReset: mocks.requestPasswordReset,
    resetPassword: mocks.resetPassword,
    signIn: { email: mocks.signInEmail },
    signOut: mocks.signOut,
    signUp: { email: mocks.signUpEmail },
  },
}));
vi.mock('expo-linking', () => ({ createURL: (path: string) => `hanziquest://${path}` }));

describe('single-user auth service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers a new user and requires email confirmation', async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: { token: null, user: { id: 'user-a' } },
      error: null,
    });
    await expect(signUp(' learner@example.com ', 'secure-pass')).resolves.toEqual({
      ok: true,
      value: { emailConfirmationRequired: true },
    });
    expect(mocks.signUpEmail).toHaveBeenCalledWith({
      callbackURL: 'hanziquest:///',
      email: 'learner@example.com',
      name: 'learner',
      password: 'secure-pass',
    });
  });

  it('restores the session immediately when local registration returns a token', async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: { token: 'local-session-token', user: { id: 'user-a' } },
      error: null,
    });
    await expect(signUp('learner@example.com', 'secure-pass')).resolves.toEqual({
      ok: true,
      value: { emailConfirmationRequired: false },
    });
  });

  it('requests and consumes password reset tokens without exposing account existence', async () => {
    mocks.requestPasswordReset.mockResolvedValue({ data: null, error: null });
    await expect(requestPasswordReset('learner@example.com')).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    expect(passwordResetToken('hanziquest:///update-password?token=secret')).toBe('secret');
    mocks.resetPassword.mockResolvedValue({ data: null, error: null });
    await expect(updatePassword('new-password', 'secret')).resolves.toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('reports sign-out failures rather than claiming the session was cleared', async () => {
    mocks.signOut.mockResolvedValue({ data: null, error: { message: 'network unavailable' } });
    await expect(signOut()).resolves.toEqual({
      ok: false,
      notice: '当前无法连接网络，请稍后重试。',
    });
  });
});
