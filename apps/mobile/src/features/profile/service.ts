import { apiRequest } from '@/lib/api/client';
import {
  humorPreferences,
  interfaceLocales,
  pinyinSupportModes,
  scriptPreferences,
  validateProfileDraft,
  type Profile,
  type ProfileDraft,
} from './model';

export type ProfileResult<T> =
  { ok: true; value: T } | { ok: false; notice: 'invalid' | 'network_unavailable' | 'unavailable' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseProfile(value: unknown): Profile | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string' ||
    !interfaceLocales.includes(value.interfaceLocale as never) ||
    !scriptPreferences.includes(value.scriptPreference as never) ||
    !pinyinSupportModes.includes(value.pinyinSupportMode as never) ||
    !humorPreferences.includes(value.humorPreference as never) ||
    !Number.isInteger(value.dailyGoalMinutes)
  ) {
    return null;
  }
  return {
    id: value.id,
    displayName: typeof value.displayName === 'string' ? value.displayName : null,
    chineseName: typeof value.chineseName === 'string' ? value.chineseName : null,
    interfaceLocale: value.interfaceLocale as Profile['interfaceLocale'],
    scriptPreference: value.scriptPreference as Profile['scriptPreference'],
    pinyinSupportMode: value.pinyinSupportMode as Profile['pinyinSupportMode'],
    humorPreference: value.humorPreference as Profile['humorPreference'],
    dailyGoalMinutes: value.dailyGoalMinutes as number,
  };
}

export async function loadProfile(): Promise<ProfileResult<Profile | null>> {
  const result = await apiRequest<unknown>('/api/profile');
  if (!result.ok) {
    if (result.status === 404) return { ok: true, value: null };
    return {
      ok: false,
      notice: result.code === 'network_unavailable' ? 'network_unavailable' : 'unavailable',
    };
  }
  const profile = parseProfile(result.value);
  return profile ? { ok: true, value: profile } : { ok: false, notice: 'unavailable' };
}

export async function saveProfile(draft: ProfileDraft): Promise<ProfileResult<Profile>> {
  if (validateProfileDraft(draft).length > 0) return { ok: false, notice: 'invalid' };
  const result = await apiRequest<unknown>('/api/profile', {
    body: JSON.stringify(draft),
    method: 'PUT',
  });
  if (!result.ok) {
    return {
      ok: false,
      notice: result.code === 'network_unavailable' ? 'network_unavailable' : 'unavailable',
    };
  }
  const profile = parseProfile(result.value);
  return profile ? { ok: true, value: profile } : { ok: false, notice: 'unavailable' };
}
