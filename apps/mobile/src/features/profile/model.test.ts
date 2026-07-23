import { describe, expect, it } from 'vitest';

import { createProfileDraft, validateProfileDraft } from './model';

describe('profile onboarding model', () => {
  it('uses the required adaptive and light defaults', () => {
    expect(createProfileDraft()).toMatchObject({
      pinyinSupportMode: 'adaptive',
      humorPreference: 'light',
    });
  });

  it('requires a display name and a bounded daily goal', () => {
    expect(validateProfileDraft(createProfileDraft())).toContain('display_name_required');
    expect(
      validateProfileDraft({ ...createProfileDraft(), displayName: '林', dailyGoalMinutes: 10 }),
    ).toEqual([]);
  });
});
