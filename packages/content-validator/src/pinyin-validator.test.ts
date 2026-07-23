import { approvedPinyinContentFixture, type PinyinContentPackage } from '@hanziquest/curriculum';
import { describe, expect, it } from 'vitest';

import { validatePinyinContent } from './pinyin-validator.ts';

function copyFixture(): PinyinContentPackage {
  return structuredClone(approvedPinyinContentFixture);
}

function errorCodes(input: unknown): string[] {
  const result = validatePinyinContent(input, { source: 'pinyin.json' });
  return result.valid ? [] : result.errors.map((error) => error.code);
}

describe('validatePinyinContent', () => {
  it('accepts the approved Pinyin content fixture', () => {
    expect(validatePinyinContent(copyFixture(), { source: 'approved' })).toEqual(
      expect.objectContaining({ valid: true }),
    );
  });

  it('rejects illegal initial-final combinations', () => {
    const invalid = copyFixture();
    invalid.syllables[0]!.numbered = 'biong1';
    expect(errorCodes(invalid)).toContain('PINYIN_ILLEGAL_COMBINATION');
  });

  it('rejects mismatched tone and display normalization', () => {
    const wrongTone = copyFixture();
    wrongTone.syllables[0]!.tone = 2;
    expect(errorCodes(wrongTone)).toContain('PINYIN_NORMALIZATION_MISMATCH');

    const wrongDisplay = copyFixture();
    wrongDisplay.syllables[0]!.display = 'má';
    expect(errorCodes(wrongDisplay)).toContain('PINYIN_NORMALIZATION_MISMATCH');

    const nonCanonicalNumbered = copyFixture();
    nonCanonicalNumbered.syllables[0]!.numbered = 'mā';
    expect(errorCodes(nonCanonicalNumbered)).toContain('PINYIN_NORMALIZATION_MISMATCH');
  });

  it('rejects missing component and asset references', () => {
    const missingInitial = copyFixture();
    missingInitial.syllables[0]!.initialId = '50000000-0000-4000-8000-999999999999';
    expect(errorCodes(missingInitial)).toContain('PINYIN_MISSING_REFERENCE');

    const missingAsset = copyFixture();
    missingAsset.syllables[0]!.audioAssetId = '50000000-0000-4000-8000-999999999998';
    expect(errorCodes(missingAsset)).toContain('PINYIN_MISSING_REFERENCE');
  });

  it('rejects duplicate values and an incomplete tone table', () => {
    const duplicateInitial = copyFixture();
    duplicateInitial.initials[1]!.value = duplicateInitial.initials[0]!.value;
    expect(errorCodes(duplicateInitial)).toContain('PINYIN_DUPLICATE_VALUE');

    const duplicateTone = copyFixture();
    duplicateTone.tones[4]!.tone = 4;
    expect(errorCodes(duplicateTone)).toContain('PINYIN_TONE_TABLE_INCOMPLETE');
  });
});
