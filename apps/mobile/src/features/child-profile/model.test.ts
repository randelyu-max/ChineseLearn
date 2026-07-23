import { describe, expect, it } from 'vitest';

import {
  applyOptionalConsentWithdrawal,
  consentVersions,
  toChildProfileInsert,
  validateChildProfileDraft,
  type ChildProfileDraft,
} from './model';

const validDraft: ChildProfileDraft = {
  ageBand: '6-7',
  consent: {
    aiPersonalization: true,
    childData: true,
    cloudSpeech: false,
    privacy: true,
    terms: true,
  },
  interests: ['animals', 'space'],
  nickname: '小星',
  scriptTrack: 'simplified',
  spokenProfile: 'understands_more',
  targetDaysPerWeek: 4,
  targetMinutes: 8,
};

describe('child profile privacy model', () => {
  it('accepts the privacy-minimized default profile', () => {
    expect(validateChildProfileDraft(validDraft)).toEqual([]);
  });

  it('blocks profile creation until every required consent is checked', () => {
    expect(
      validateChildProfileDraft({
        ...validDraft,
        consent: { ...validDraft.consent, childData: false },
      }),
    ).toContain('required_consent_missing');
  });

  it('limits interests to three approved unique values', () => {
    expect(
      validateChildProfileDraft({
        ...validDraft,
        interests: ['animals', 'space', 'science', 'music'],
      }),
    ).toContain('interests_invalid');
  });

  it('never creates precise birthday, school, child email, or real-name fields', () => {
    const payload = toChildProfileInsert(validDraft, 'household-1');
    expect(Object.keys(payload)).not.toEqual(
      expect.arrayContaining(['birthday', 'school', 'email', 'real_name']),
    );
  });

  it('uses explicit versions for required and optional choices', () => {
    expect(new Set(Object.values(consentVersions)).size).toBe(5);
  });

  it('withdraws AI and speech independently', () => {
    const initial = { aiPersonalizationEnabled: true, cloudSpeechEnabled: true };
    const withoutAi = applyOptionalConsentWithdrawal(initial, 'ai_personalization');
    expect(withoutAi).toEqual({
      aiPersonalizationEnabled: false,
      cloudSpeechEnabled: true,
    });
    expect(applyOptionalConsentWithdrawal(withoutAi, 'cloud_speech')).toEqual({
      aiPersonalizationEnabled: false,
      cloudSpeechEnabled: false,
    });
  });
});
