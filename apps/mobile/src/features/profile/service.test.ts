import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadProfile, saveProfile } from './service';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/client', () => ({ apiRequest }));

describe('profile service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('treats a 404 profile as onboarding required', async () => {
    apiRequest.mockResolvedValue({ ok: false, status: 404, code: 'not_found' });
    await expect(loadProfile()).resolves.toEqual({ ok: true, value: null });
  });

  it('maps a valid API profile and uses only the authenticated endpoint', async () => {
    apiRequest.mockResolvedValue({
      ok: true,
      value: {
        id: 'user-a',
        displayName: 'Learner',
        chineseName: null,
        interfaceLocale: 'zh-CN',
        scriptPreference: 'simplified',
        pinyinSupportMode: 'adaptive',
        humorPreference: 'light',
        dailyGoalMinutes: 10,
      },
    });
    await expect(loadProfile()).resolves.toMatchObject({
      ok: true,
      value: { id: 'user-a', displayName: 'Learner' },
    });
    expect(apiRequest).toHaveBeenCalledWith('/api/profile');
  });

  it('rejects invalid drafts before making a network request', async () => {
    await expect(
      saveProfile({
        displayName: '',
        chineseName: null,
        interfaceLocale: 'zh-CN',
        scriptPreference: 'simplified',
        pinyinSupportMode: 'adaptive',
        humorPreference: 'light',
        dailyGoalMinutes: 10,
      }),
    ).resolves.toEqual({ ok: false, notice: 'invalid' });
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
