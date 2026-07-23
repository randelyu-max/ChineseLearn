import { type HumorContentPackage } from '@hanziquest/curriculum';
import { describe, expect, it } from 'vitest';

import { formatHumorValidationIssue, validateHumorContent } from './humor-validator.ts';

const validPackage: HumorContentPackage = {
  schemaVersion: 'humor-content-v1',
  contentVersion: '1.0.0',
  items: [
    {
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
    },
  ],
};

function copyFixture(): HumorContentPackage {
  return structuredClone(validPackage);
}

function errorCodes(input: unknown): string[] {
  const result = validateHumorContent(input, { source: 'humor-fixture.json' });
  return result.valid ? [] : result.errors.map((issue) => issue.code);
}

describe('validateHumorContent', () => {
  it('accepts static reviewed content with an equivalent neutral fallback', () => {
    expect(validateHumorContent(validPackage)).toEqual(expect.objectContaining({ valid: true }));
  });

  it('rejects changed learning targets and answers', () => {
    const targetChanged = copyFixture();
    targetChanged.items[0]!.neutralFallback.learningTargetDisplay = {
      simplified: '牛',
      traditional: '牛',
    };
    expect(errorCodes(targetChanged)).toContain('HUMOR_TARGET_MISMATCH');

    const answerChanged = copyFixture();
    answerChanged.items[0]!.neutralFallback.correctAnswerId = 'answer-niu2';
    answerChanged.items[0]!.neutralFallback.correctAnswer = {
      simplified: '牛',
      traditional: '牛',
    };
    expect(errorCodes(answerChanged)).toContain('HUMOR_ANSWER_MISMATCH');
  });

  it('requires the target to remain visible in both script variants and presentations', () => {
    const invalid = copyFixture();
    invalid.items[0]!.humorousVariant.prompt = {
      simplified: '今天先慢慢走。',
      traditional: '今天先慢慢走。',
    };
    invalid.items[0]!.humorousVariant.correctAnswer = {
      simplified: '动物',
      traditional: '動物',
    };
    expect(errorCodes(invalid)).toContain('HUMOR_TARGET_NOT_PRESENT');
  });

  it('requires a present and genuinely neutral fallback', () => {
    const missing = structuredClone(validPackage) as unknown as {
      items: Array<Record<string, unknown>>;
    };
    delete missing.items[0]!.neutralFallback;
    expect(errorCodes(missing)).toContain('HUMOR_SCHEMA_INVALID');

    const jokeFallback = copyFixture();
    jokeFallback.items[0]!.neutralFallback.prompt.simplified = '哈哈，请选择汉字马。';
    expect(errorCodes(jokeFallback)).toContain('HUMOR_NEUTRAL_FALLBACK_INVALID');
  });

  it.each([
    ['humiliation', '只有笨蛋才会选错马。'],
    ['error mockery', '这么简单还答错马。'],
    ['identity stereotype', '中国人天生都会写马。'],
  ])('rejects prohibited %s language', (_label, prompt) => {
    const invalid = copyFixture();
    invalid.items[0]!.humorousVariant.prompt.simplified = prompt;
    expect(errorCodes(invalid)).toContain('HUMOR_UNSAFE_LANGUAGE');
  });

  it('requires approved human editorial review', () => {
    const invalid = copyFixture();
    invalid.items[0]!.editorialStatus = 'draft';
    const result = validateHumorContent(invalid, { source: 'draft.json' });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const issue = result.errors.find(
        (candidate) => candidate.code === 'HUMOR_EDITORIAL_REVIEW_REQUIRED',
      );
      expect(formatHumorValidationIssue(issue!)).toContain('draft.json:items.0.editorialStatus');
    }
  });

  it('distinguishes mnemonic memory scenes from prohibited etymology claims', () => {
    const undisclosed = copyFixture();
    undisclosed.items[0]!.humorType = 'memory_scene';
    expect(errorCodes(undisclosed)).toContain('HUMOR_MEMORY_SCENE_DISCLOSURE_REQUIRED');

    const mnemonic = copyFixture();
    mnemonic.items[0]!.humorType = 'memory_scene';
    mnemonic.items[0]!.knowledgeClaim = {
      kind: 'mnemonic',
      disclosure: {
        simplified: '这是记忆联想，不是字源说明。',
        traditional: '這是記憶聯想，不是字源說明。',
      },
    };
    expect(validateHumorContent(mnemonic).valid).toBe(true);

    const etymology = copyFixture();
    etymology.items[0]!.knowledgeClaim = { kind: 'etymology' };
    expect(errorCodes(etymology)).toContain('HUMOR_ETYMOLOGY_CLAIM_NOT_ALLOWED');
  });

  it('rejects duplicate stable item IDs', () => {
    const invalid = copyFixture();
    invalid.items.push(structuredClone(invalid.items[0]!));
    expect(errorCodes(invalid)).toContain('HUMOR_DUPLICATE_ID');
  });
});
