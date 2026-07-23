import type { HumorContentItem } from '@hanziquest/curriculum';
import { describe, expect, it } from 'vitest';

import { selectHumorPresentation } from './humor-selection';

const item = {
  audience: 'age_neutral_13_plus',
  authoring: 'human_editorial',
  delivery: 'bundled',
  editorialStatus: 'approved',
  humorLevel: 'playful',
  humorType: 'surprise_ending',
  humorousVariant: {
    correctAnswer: { simplified: '马', traditional: '馬' },
    correctAnswerId: 'answer-ma3',
    kind: 'humorous',
    learningTargetDisplay: { simplified: '马', traditional: '馬' },
    prompt: { simplified: '马慢慢走进了最后一题。', traditional: '馬慢慢走進了最後一題。' },
  },
  id: '70000000-0000-4000-8000-000000000001',
  knowledgeClaim: { kind: 'none' },
  learningTarget: {
    display: { simplified: '马', traditional: '馬' },
    domain: 'hanzi',
    targetId: 'hanzi-ma',
  },
  locale: 'zh-CN',
  neutralFallback: {
    correctAnswer: { simplified: '马', traditional: '馬' },
    correctAnswerId: 'answer-ma3',
    kind: 'neutral',
    learningTargetDisplay: { simplified: '马', traditional: '馬' },
    prompt: { simplified: '请选择汉字“马”。', traditional: '請選擇漢字「馬」。' },
  },
  safetyReview: {
    errorMockery: 'passed',
    etymologyAccuracy: 'passed',
    humiliation: 'passed',
    identityStereotypes: 'passed',
    learningTargetAccuracy: 'passed',
    reviewedAt: '2026-07-23T12:00:00.000Z',
    reviewedBy: 'fixture-editor',
  },
} as const satisfies HumorContentItem;

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
    const lightItem = { ...item, humorLevel: 'light' } as const;

    expect(selectHumorPresentation(lightItem, 'light').presentation.kind).toBe('humorous');
    expect(selectHumorPresentation(lightItem, 'playful').presentation.kind).toBe('humorous');
  });
});
