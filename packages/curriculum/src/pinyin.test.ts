import { describe, expect, it } from 'vitest';

import { approvedPinyinContentFixture } from './fixtures/pinyin-content.ts';
import {
  PINYIN_CONTENT_SCHEMA_VERSION,
  PinyinContentPackageSchema,
  PinyinSyllableContentSchema,
} from './pinyin.ts';

describe('Pinyin content schemas', () => {
  it('accepts the approved initials, finals, tones, and syllables fixture', () => {
    expect(PinyinContentPackageSchema.parse(approvedPinyinContentFixture)).toEqual(
      approvedPinyinContentFixture,
    );
  });

  it('keeps the Pinyin content boundary explicitly versioned', () => {
    expect(PINYIN_CONTENT_SCHEMA_VERSION).toBe('pinyin-content-v1');
    expect(
      PinyinContentPackageSchema.safeParse({
        ...approvedPinyinContentFixture,
        schemaVersion: 'pinyin-content-v2',
      }).success,
    ).toBe(false);
  });

  it('requires all five tones and rejects undeclared syllable fields', () => {
    expect(
      PinyinContentPackageSchema.safeParse({
        ...approvedPinyinContentFixture,
        tones: approvedPinyinContentFixture.tones.slice(0, 4),
      }).success,
    ).toBe(false);
    expect(
      PinyinSyllableContentSchema.safeParse({
        ...approvedPinyinContentFixture.syllables[0],
        englishLetterName: 'em',
      }).success,
    ).toBe(false);
  });
});
