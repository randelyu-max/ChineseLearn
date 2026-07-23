import type { HumorContentItem } from '@hanziquest/curriculum';

import type { HumorPreference } from './model';

export type HumorSelectionReason =
  'level_allowed' | 'level_above_preference' | 'preference_off' | 'preference_unavailable';

export type HumorSelection = Readonly<{
  presentation: HumorContentItem['humorousVariant'] | HumorContentItem['neutralFallback'];
  reason: HumorSelectionReason;
}>;

function allowsHumor(preference: HumorPreference, level: HumorContentItem['humorLevel']): boolean {
  if (preference === 'playful') return true;
  return preference === 'light' && level === 'light';
}

/**
 * Selects between two bundled, previously reviewed variants.
 * This function intentionally has no storage, clock, network, or remote-service dependency.
 */
export function selectHumorPresentation(
  item: HumorContentItem,
  preference: HumorPreference | null | undefined,
): HumorSelection {
  if (preference == null) {
    return {
      presentation: item.neutralFallback,
      reason: 'preference_unavailable',
    };
  }
  if (preference === 'off') {
    return {
      presentation: item.neutralFallback,
      reason: 'preference_off',
    };
  }
  if (!allowsHumor(preference, item.humorLevel)) {
    return {
      presentation: item.neutralFallback,
      reason: 'level_above_preference',
    };
  }
  return {
    presentation: item.humorousVariant,
    reason: 'level_allowed',
  };
}
