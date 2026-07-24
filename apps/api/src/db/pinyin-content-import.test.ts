import { resolve } from 'node:path';

import { approvedPinyinContentFixture, type PinyinContentPackage } from '@hanziquest/curriculum';
import { describe, expect, it } from 'vitest';

import { buildPinyinConceptImportRows, verifyPinyinBundledAudio } from './pinyin-content-import.ts';

function fixture(): PinyinContentPackage {
  return structuredClone(approvedPinyinContentFixture);
}

describe('formal Pinyin content import', () => {
  it('creates deterministic rows for every initial, final, tone, and syllable', () => {
    const first = buildPinyinConceptImportRows(fixture());
    const second = buildPinyinConceptImportRows(fixture());
    expect(second).toEqual(first);
    expect(new Set(first.map((row) => row.id)).size).toBe(first.length);
    expect(new Set(first.map((row) => row.conceptCode)).size).toBe(first.length);
    expect(new Set(first.map((row) => row.kind))).toEqual(
      new Set(['initial', 'final', 'tone', 'syllable']),
    );
    expect(first.find((row) => row.conceptCode === 'pinyin.syllable.ma3')).toMatchObject({
      canonicalValue: 'ma',
      displayValue: 'mǎ',
      numberedValue: 'ma3',
      toneNumber: 3,
    });
  });

  it('fails closed before producing rows for an illegal component mapping', () => {
    const invalid = fixture();
    invalid.syllables[0]!.finalId = invalid.finals[1]!.id;
    expect(() => buildPinyinConceptImportRows(invalid)).toThrow(/PINYIN_ILLEGAL_COMBINATION/);
  });

  it('verifies the packaged bytes against the editorial SHA-256 metadata', async () => {
    await expect(
      verifyPinyinBundledAudio(fixture(), resolve(process.cwd(), '../..')),
    ).resolves.toBeUndefined();

    const invalid = fixture();
    invalid.assets[0]!.sha256 = '0'.repeat(64);
    await expect(
      verifyPinyinBundledAudio(invalid, resolve(process.cwd(), '../..')),
    ).rejects.toThrow(/SHA-256 mismatch/);
  });
});
