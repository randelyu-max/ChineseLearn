import type { SupabaseClient } from '@supabase/supabase-js';

import { validateChildProfileDraft, type ChildProfileDraft } from './model';

export type ChildProfileNotice =
  | 'configuration_missing'
  | 'not_authenticated'
  | 'managed_household_missing'
  | 'invalid_profile'
  | 'network_unavailable'
  | 'generic';

export type ChildProfileResult<T> =
  { ok: true; value: T } | { ok: false; notice: ChildProfileNotice };

export type CreatedChildProfile = {
  aiPersonalizationEnabled: boolean;
  cloudSpeechEnabled: boolean;
  id: string;
  nickname: string;
};

function noticeFor(error: unknown): ChildProfileNotice {
  const message =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message.toLowerCase()
      : '';
  return message.includes('network') || message.includes('fetch')
    ? 'network_unavailable'
    : 'generic';
}

function parseCreatedProfile(value: unknown): CreatedChildProfile | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    !('display_name' in value) ||
    typeof value.id !== 'string' ||
    typeof value.display_name !== 'string'
  ) {
    return null;
  }
  return {
    aiPersonalizationEnabled:
      'ai_personalization_enabled' in value && value.ai_personalization_enabled === true,
    cloudSpeechEnabled: 'cloud_speech_enabled' in value && value.cloud_speech_enabled === true,
    id: value.id,
    nickname: value.display_name,
  };
}

export async function findManagedHousehold(
  client: SupabaseClient,
): Promise<ChildProfileResult<string>> {
  try {
    const { data, error } = await client
      .from('household_members')
      .select('household_id, role')
      .eq('status', 'active')
      .in('role', ['owner', 'parent'])
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, notice: noticeFor(error) };
    if (!data?.household_id) return { ok: false, notice: 'managed_household_missing' };
    return { ok: true, value: String(data.household_id) };
  } catch (error) {
    return { ok: false, notice: noticeFor(error) };
  }
}

export async function createChildProfile(
  client: SupabaseClient,
  householdId: string,
  draft: ChildProfileDraft,
): Promise<ChildProfileResult<CreatedChildProfile>> {
  if (validateChildProfileDraft(draft).length > 0) {
    return { ok: false, notice: 'invalid_profile' };
  }

  try {
    const { data, error } = await client
      .rpc('create_child_profile_with_consents', {
        p_age_band: draft.ageBand,
        p_ai_personalization_granted: draft.consent.aiPersonalization,
        p_cloud_speech_granted: draft.consent.cloudSpeech,
        p_country_code: null,
        p_display_name: draft.nickname.trim(),
        p_household_id: householdId,
        p_interests: [...draft.interests],
        p_script_track: draft.scriptTrack,
        p_spoken_profile: draft.spokenProfile,
        p_target_days_per_week: draft.targetDaysPerWeek,
        p_target_minutes: draft.targetMinutes,
      })
      .single();
    if (error) return { ok: false, notice: noticeFor(error) };
    const profile = parseCreatedProfile(data);
    return profile ? { ok: true, value: profile } : { ok: false, notice: 'generic' };
  } catch (error) {
    return { ok: false, notice: noticeFor(error) };
  }
}

export async function withdrawOptionalConsent(
  client: SupabaseClient,
  householdId: string,
  childId: string,
  type: 'ai_personalization' | 'cloud_speech',
): Promise<ChildProfileResult<undefined>> {
  const documentVersion =
    type === 'ai_personalization' ? 'ai-personalization-2026-01' : 'cloud-speech-2026-01';
  try {
    const { error } = await client.rpc('record_consent_choice', {
      p_child_id: childId,
      p_consent_type: type,
      p_country_code: null,
      p_document_version: documentVersion,
      p_granted: false,
      p_household_id: householdId,
    });
    if (error) return { ok: false, notice: noticeFor(error) };
    return { ok: true, value: undefined };
  } catch (error) {
    return { ok: false, notice: noticeFor(error) };
  }
}

export const CHILD_PROFILE_NOTICE_MESSAGES: Record<ChildProfileNotice, string> = {
  configuration_missing: '家长账户服务尚未配置，请稍后再试。',
  generic: '暂时无法保存儿童档案，请稍后再试。',
  invalid_profile: '请检查昵称、兴趣和必要同意后再继续。',
  managed_household_missing: '当前账户没有可管理的家庭。',
  network_unavailable: '当前无法连接网络，请检查网络后重试。',
  not_authenticated: '请先完成家长登录。',
};
