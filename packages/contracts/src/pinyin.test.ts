import { describe, expect, it } from 'vitest';

import {
  canonicalPinyinBase,
  isLegalPinyinCombination,
  LEGAL_PINYIN_BASE_SYLLABLES,
  normalizePinyinSyllable,
  PinyinSyllableInputSchema,
} from './pinyin.ts';

describe('Pinyin normalization contract', () => {
  it.each([
    [
      'ma1',
      {
        base: 'ma',
        display: 'mā',
        numbered: 'ma1',
        tone: 1,
        initial: 'm',
        final: 'a',
      },
    ],
    [
      'mǎ',
      {
        base: 'ma',
        display: 'mǎ',
        numbered: 'ma3',
        tone: 3,
        initial: 'm',
        final: 'a',
      },
    ],
    [
      'ma',
      {
        base: 'ma',
        display: 'ma',
        numbered: 'ma5',
        tone: 5,
        initial: 'm',
        final: 'a',
      },
    ],
    [
      'nu:3',
      {
        base: 'nü',
        display: 'nǚ',
        numbered: 'nü3',
        tone: 3,
        initial: 'n',
        final: 'ü',
      },
    ],
    [
      'nv3',
      {
        base: 'nü',
        display: 'nǚ',
        numbered: 'nü3',
        tone: 3,
        initial: 'n',
        final: 'ü',
      },
    ],
    [
      'yue4',
      {
        base: 'yue',
        display: 'yuè',
        numbered: 'yue4',
        tone: 4,
        initial: 'none',
        final: 'üe',
      },
    ],
  ])('normalizes %s deterministically', (input, expected) => {
    expect(normalizePinyinSyllable(input)).toEqual(
      expect.objectContaining({
        ...expected,
        normalizationVersion: 'pinyin-normalization-v1',
      }),
    );
  });

  it('places tone marks on the later vowel in contracted iu and ui finals', () => {
    expect(normalizePinyinSyllable('liu2')?.display).toBe('liú');
    expect(normalizePinyinSyllable('gui3')?.display).toBe('guǐ');
  });

  it('rejects illegal combinations, phrases, and conflicting tone notation', () => {
    expect(normalizePinyinSyllable('biong1')).toBeNull();
    expect(normalizePinyinSyllable('ma ma')).toBeNull();
    expect(normalizePinyinSyllable('mǎ4')).toBeNull();
    expect(PinyinSyllableInputSchema.safeParse('fing2').success).toBe(false);
  });

  it('distinguishes zero initials and orthographic ü spellings', () => {
    expect(canonicalPinyinBase('none', 'i')).toBe('yi');
    expect(canonicalPinyinBase('j', 'üan')).toBe('juan');
    expect(normalizePinyinSyllable('juan4')).toEqual(
      expect.objectContaining({ initial: 'j', final: 'üan', display: 'juàn' }),
    );
  });

  it('exposes legal initial-final combinations without accepting impossible pairs', () => {
    expect(isLegalPinyinCombination('m', 'a')).toBe(true);
    expect(isLegalPinyinCombination('b', 'iong')).toBe(false);
  });

  it('round-trips every declared legal base across all five tones', () => {
    expect(new Set(LEGAL_PINYIN_BASE_SYLLABLES).size).toBe(LEGAL_PINYIN_BASE_SYLLABLES.length);
    for (const base of LEGAL_PINYIN_BASE_SYLLABLES) {
      for (const tone of [1, 2, 3, 4, 5] as const) {
        const numbered = `${base}${tone}`;
        const normalized = normalizePinyinSyllable(numbered);
        expect(normalized, numbered).not.toBeNull();
        expect(normalized?.numbered).toBe(numbered);
        expect(normalizePinyinSyllable(normalized!.display)?.numbered).toBe(numbered);
      }
    }
  });
});
