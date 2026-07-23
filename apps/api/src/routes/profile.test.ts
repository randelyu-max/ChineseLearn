import { describe, expect, it } from 'vitest';

import { readProfileInput } from './profile.js';

const valid = {
  chineseName: ' 小林 ',
  dailyGoalMinutes: 10,
  displayName: ' Learner ',
  humorPreference: 'light',
  interfaceLocale: 'zh-CN',
  pinyinSupportMode: 'adaptive',
  scriptPreference: 'simplified',
};

describe('profile input boundary', () => {
  it('accepts and normalizes the documented profile fields', () => {
    expect(readProfileInput(valid)).toMatchObject({
      chineseName: '小林',
      displayName: 'Learner',
    });
  });

  it('rejects invalid ranges, enum values, and unknown fields', () => {
    expect(readProfileInput({ ...valid, dailyGoalMinutes: 2 })).toBeNull();
    expect(readProfileInput({ ...valid, pinyinSupportMode: 'sometimes' })).toBeNull();
    expect(readProfileInput({ ...valid, userId: 'forged' })).toBeNull();
  });
});
