export const ageBands = ['6-7', '8-10', '11-13'] as const;
export type AgeBand = (typeof ageBands)[number];

export const spokenProfiles = [
  'home_primary',
  'understands_more',
  'limited_speaking',
  'beginner',
] as const;
export type SpokenProfile = (typeof spokenProfiles)[number];

export const approvedInterests = [
  'animals',
  'dinosaurs',
  'food',
  'music',
  'myths',
  'nature',
  'science',
  'space',
  'sports',
  'vehicles',
] as const;
export type ApprovedInterest = (typeof approvedInterests)[number];

export const targetMinuteOptions = [5, 8, 10, 15] as const;
export const targetDayOptions = [1, 2, 3, 4, 5, 6, 7] as const;

export const consentVersions = {
  aiPersonalization: 'ai-personalization-2026-01',
  childData: 'child-data-2026-01',
  cloudSpeech: 'cloud-speech-2026-01',
  privacy: 'privacy-2026-01',
  terms: 'terms-2026-01',
} as const;

export type ConsentChoices = Readonly<{
  aiPersonalization: boolean;
  childData: boolean;
  cloudSpeech: boolean;
  privacy: boolean;
  terms: boolean;
}>;

export type ChildProfileDraft = Readonly<{
  ageBand: AgeBand;
  consent: ConsentChoices;
  interests: readonly ApprovedInterest[];
  nickname: string;
  scriptTrack: 'simplified' | 'traditional';
  spokenProfile: SpokenProfile;
  targetDaysPerWeek: (typeof targetDayOptions)[number];
  targetMinutes: (typeof targetMinuteOptions)[number];
}>;

export type ChildProfileIssue =
  'nickname_required' | 'nickname_too_long' | 'interests_invalid' | 'required_consent_missing';

export function validateChildProfileDraft(draft: ChildProfileDraft): ChildProfileIssue[] {
  const issues: ChildProfileIssue[] = [];
  const nickname = draft.nickname.trim();
  if (!nickname) issues.push('nickname_required');
  if (nickname.length > 40) issues.push('nickname_too_long');

  const interests = new Set(draft.interests);
  if (
    interests.size !== draft.interests.length ||
    interests.size > 3 ||
    draft.interests.some((interest) => !approvedInterests.includes(interest as ApprovedInterest))
  ) {
    issues.push('interests_invalid');
  }

  if (!draft.consent.terms || !draft.consent.privacy || !draft.consent.childData) {
    issues.push('required_consent_missing');
  }
  return issues;
}

export function toChildProfileInsert(draft: ChildProfileDraft, householdId: string) {
  return {
    age_band: draft.ageBand,
    ai_personalization_enabled: draft.consent.aiPersonalization,
    cloud_speech_enabled: draft.consent.cloudSpeech,
    display_name: draft.nickname.trim(),
    household_id: householdId,
    interests: [...draft.interests],
    script_track: draft.scriptTrack,
    spoken_profile: draft.spokenProfile,
    target_days_per_week: draft.targetDaysPerWeek,
    target_minutes: draft.targetMinutes,
  } as const;
}

export type ChildCapabilityState = Readonly<{
  aiPersonalizationEnabled: boolean;
  cloudSpeechEnabled: boolean;
}>;

export function applyOptionalConsentWithdrawal(
  state: ChildCapabilityState,
  type: 'ai_personalization' | 'cloud_speech',
): ChildCapabilityState {
  return type === 'ai_personalization'
    ? { ...state, aiPersonalizationEnabled: false }
    : { ...state, cloudSpeechEnabled: false };
}

export const childProfileLabels = {
  ageBands: {
    '6-7': '6–7 岁',
    '8-10': '8–10 岁',
    '11-13': '11–13 岁',
  },
  interests: {
    animals: '动物',
    dinosaurs: '恐龙',
    food: '美食',
    music: '音乐',
    myths: '神话',
    nature: '自然',
    science: '科学',
    space: '太空',
    sports: '运动',
    vehicles: '交通工具',
  },
  spokenProfiles: {
    beginner: '刚开始接触中文',
    home_primary: '家中主要使用中文',
    limited_speaking: '会听一些，较少开口',
    understands_more: '听懂的比会说的多',
  },
} as const;
