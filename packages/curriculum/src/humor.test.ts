import { describe, expect, it } from 'vitest';

import { HumorContentItemSchema, HumorContentPackageSchema, HumorTypeSchema } from './humor.ts';

const baseItem = {
  id: '70000000-0000-4000-8000-000000000001',
  audience: 'age_neutral_13_plus',
  authoring: 'human_editorial',
  delivery: 'bundled',
  editorialStatus: 'approved',
  humorLevel: 'light',
  humorType: 'situational',
  humorousVariant: {
    kind: 'humorous',
    correctAnswerId: 'answer-ma3',
    correctAnswer: { simplified: '马', traditional: '馬' },
    learningTargetDisplay: { simplified: '马', traditional: '馬' },
    prompt: { simplified: '马今天先学会慢慢走。', traditional: '馬今天先學會慢慢走。' },
  },
  knowledgeClaim: { kind: 'none' },
  learningTarget: {
    domain: 'hanzi',
    targetId: 'hanzi-ma',
    display: { simplified: '马', traditional: '馬' },
  },
  locale: 'zh-CN',
  neutralFallback: {
    kind: 'neutral',
    correctAnswerId: 'answer-ma3',
    correctAnswer: { simplified: '马', traditional: '馬' },
    learningTargetDisplay: { simplified: '马', traditional: '馬' },
    prompt: { simplified: '请选择汉字马。', traditional: '請選擇漢字馬。' },
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
} as const;

describe('static humor curriculum schema', () => {
  it('accepts each of the six approved humor types', () => {
    HumorTypeSchema.options.forEach((humorType, index) => {
      expect(
        HumorContentItemSchema.safeParse({
          ...baseItem,
          id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          humorType,
          knowledgeClaim:
            humorType === 'memory_scene'
              ? {
                  kind: 'mnemonic',
                  disclosure: {
                    simplified: '这是记忆联想，不是字源说明。',
                    traditional: '這是記憶聯想，不是字源說明。',
                  },
                }
              : { kind: 'none' },
        }).success,
      ).toBe(true);
    });
  });

  it('defines a versioned, bundled, human-editorial package', () => {
    expect(
      HumorContentPackageSchema.safeParse({
        schemaVersion: 'humor-content-v1',
        contentVersion: '1.0.0',
        items: [baseItem],
      }).success,
    ).toBe(true);
  });

  it('rejects off as content, machine authoring, remote delivery, and unknown fields', () => {
    expect(HumorContentItemSchema.safeParse({ ...baseItem, humorLevel: 'off' }).success).toBe(
      false,
    );
    expect(
      HumorContentItemSchema.safeParse({ ...baseItem, authoring: 'machine_generated' }).success,
    ).toBe(false);
    expect(HumorContentItemSchema.safeParse({ ...baseItem, delivery: 'remote' }).success).toBe(
      false,
    );
    expect(
      HumorContentItemSchema.safeParse({ ...baseItem, personalizationProfile: {} }).success,
    ).toBe(false);
  });
});
