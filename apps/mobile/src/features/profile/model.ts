export const interfaceLocales = ['zh-CN', 'zh-TW', 'en-US'] as const;
export const scriptPreferences = ['simplified', 'traditional'] as const;
export const pinyinSupportModes = ['always', 'adaptive', 'tap_to_reveal', 'hidden'] as const;
export const humorPreferences = ['off', 'light', 'playful'] as const;

export type InterfaceLocale = (typeof interfaceLocales)[number];
export type ScriptPreference = (typeof scriptPreferences)[number];
export type PinyinSupportMode = (typeof pinyinSupportModes)[number];
export type HumorPreference = (typeof humorPreferences)[number];

export type Profile = Readonly<{
  id: string;
  displayName: string | null;
  chineseName: string | null;
  interfaceLocale: InterfaceLocale;
  scriptPreference: ScriptPreference;
  pinyinSupportMode: PinyinSupportMode;
  humorPreference: HumorPreference;
  dailyGoalMinutes: number;
}>;

export type ProfileDraft = Omit<Profile, 'id'>;

export function createProfileDraft(): ProfileDraft {
  return {
    displayName: '',
    chineseName: null,
    interfaceLocale: 'zh-CN',
    scriptPreference: 'simplified',
    pinyinSupportMode: 'adaptive',
    humorPreference: 'light',
    dailyGoalMinutes: 10,
  };
}

export function validateProfileDraft(draft: ProfileDraft): string[] {
  const issues: string[] = [];
  if (!draft.displayName?.trim()) issues.push('display_name_required');
  if ((draft.displayName?.trim().length ?? 0) > 80) issues.push('display_name_too_long');
  if ((draft.chineseName?.trim().length ?? 0) > 24) issues.push('chinese_name_too_long');
  if (!interfaceLocales.includes(draft.interfaceLocale)) issues.push('interface_locale_invalid');
  if (!scriptPreferences.includes(draft.scriptPreference)) issues.push('script_preference_invalid');
  if (!pinyinSupportModes.includes(draft.pinyinSupportMode)) issues.push('pinyin_support_invalid');
  if (!humorPreferences.includes(draft.humorPreference)) issues.push('humor_preference_invalid');
  if (
    !Number.isInteger(draft.dailyGoalMinutes) ||
    draft.dailyGoalMinutes < 3 ||
    draft.dailyGoalMinutes > 60
  ) {
    issues.push('daily_goal_invalid');
  }
  return issues;
}
