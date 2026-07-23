import { approvedHumorContentFixture } from '@hanziquest/curriculum';
import { describe, expect, it } from 'vitest';

import { selectHumorPresentation } from './humor-selection';

const item = approvedHumorContentFixture.items[5]!;

describe('offline humor preference selection', () => {
  it('always returns the neutral fallback when the preference is off', () => {
    expect(selectHumorPresentation(item, 'off')).toEqual({
      presentation: item.neutralFallback,
      reason: 'preference_off',
    });
  });

  it('fails closed to neutral when an offline caller has no loaded preference', () => {
    expect(selectHumorPresentation(item, null)).toEqual({
      presentation: item.neutralFallback,
      reason: 'preference_unavailable',
    });
  });

  it('does not show playful content to a light preference', () => {
    expect(selectHumorPresentation(item, 'light')).toEqual({
      presentation: item.neutralFallback,
      reason: 'level_above_preference',
    });
  });

  it('selects an allowed bundled variant deterministically without network access', () => {
    const first = selectHumorPresentation(item, 'playful');
    const second = selectHumorPresentation(item, 'playful');

    expect(first).toEqual({
      presentation: item.humorousVariant,
      reason: 'level_allowed',
    });
    expect(second).toEqual(first);
    expect(item.humorousVariant.correctAnswerId).toBe(item.neutralFallback.correctAnswerId);
  });

  it('allows light content for both enabled preference levels', () => {
    const lightItem = approvedHumorContentFixture.items[0]!;

    expect(selectHumorPresentation(lightItem, 'light').presentation.kind).toBe('humorous');
    expect(selectHumorPresentation(lightItem, 'playful').presentation.kind).toBe('humorous');
  });
});
