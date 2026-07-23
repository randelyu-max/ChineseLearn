import { describe, expect, it } from 'vitest';

import type { Profile } from '@/features/profile';
import { authReducer, initialAuthState } from './model';

const profile: Profile = {
  id: 'user-a',
  displayName: '学习者',
  chineseName: null,
  interfaceLocale: 'zh-CN',
  scriptPreference: 'simplified',
  pinyinSupportMode: 'adaptive',
  humorPreference: 'light',
  dailyGoalMinutes: 10,
};

describe('single-user auth state machine', () => {
  it('routes a new user to onboarding', () => {
    const loading = authReducer(initialAuthState, {
      type: 'SESSION_FOUND',
      userId: 'user-a',
      email: 'a@example.com',
    });
    expect(loading.status).toBe('authenticated_profile_loading');
    expect(authReducer(loading, { type: 'PROFILE_MISSING' }).status).toBe('onboarding_required');
  });

  it('routes a user with a profile to the app', () => {
    const loading = authReducer(initialAuthState, {
      type: 'SESSION_FOUND',
      userId: 'user-a',
      email: null,
    });
    expect(authReducer(loading, { type: 'PROFILE_LOADED', profile }).status).toBe('ready');
  });

  it('handles restored or expired sessions', () => {
    expect(authReducer(initialAuthState, { type: 'NO_SESSION' }).status).toBe('unauthenticated');
  });

  it('exposes a retryable profile loading failure', () => {
    const loading = authReducer(initialAuthState, {
      type: 'SESSION_FOUND',
      userId: 'user-a',
      email: null,
    });
    expect(
      authReducer(loading, { type: 'PROFILE_FAILED', notice: '暂时无法读取个人设置。' }).status,
    ).toBe('profile_error');
  });
});
