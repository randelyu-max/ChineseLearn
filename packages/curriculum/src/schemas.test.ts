import { describe, expect, it } from 'vitest';

import { demoCurriculumPackage } from './fixtures/demo-curriculum.ts';
import {
  CharacterConceptSchema,
  ContentAssetSchema,
  CurriculumPackageSchema,
  ScriptTextSchema,
} from './schemas.ts';

describe('curriculum domain schemas', () => {
  it('accepts the synthetic example curriculum package', () => {
    const result = CurriculumPackageSchema.safeParse(demoCurriculumPackage);
    expect(result.success).toBe(true);
  });

  it('preserves distinct simplified and traditional forms', () => {
    expect(ScriptTextSchema.parse({ simplified: '饭', traditional: '飯' })).toEqual({
      simplified: '饭',
      traditional: '飯',
    });
  });

  it('rejects an unstable character concept identifier', () => {
    const invalidCharacter = {
      ...demoCurriculumPackage.characters[0],
      conceptId: '吃',
    };
    expect(CharacterConceptSchema.safeParse(invalidCharacter).success).toBe(false);
  });

  it('rejects unsupported schema and malformed semantic versions', () => {
    expect(
      CurriculumPackageSchema.safeParse({
        ...demoCurriculumPackage,
        schemaVersion: 'curriculum-package-v2',
      }).success,
    ).toBe(false);
    expect(
      CurriculumPackageSchema.safeParse({
        ...demoCurriculumPackage,
        minimumAppVersion: 'latest',
      }).success,
    ).toBe(false);
  });

  it('carries explicit prerequisite relationships', () => {
    const prerequisiteId = '00000000-0000-4000-8000-000000009999';
    const parsed = CurriculumPackageSchema.parse({
      ...demoCurriculumPackage,
      worlds: [
        {
          ...demoCurriculumPackage.worlds[0],
          prerequisiteWorldIds: [prerequisiteId],
        },
      ],
    });
    expect(parsed.worlds[0]?.prerequisiteWorldIds).toEqual([prerequisiteId]);
  });

  it('rejects undeclared fields at the package boundary', () => {
    expect(
      CurriculumPackageSchema.safeParse({
        ...demoCurriculumPackage,
        childNickname: 'not-allowed',
      }).success,
    ).toBe(false);
  });

  it('requires license/source metadata and delivery-specific asset fields', () => {
    const ttsAsset = {
      id: '00000000-0000-4000-8000-000000000901',
      kind: 'audio',
      delivery: 'system_tts',
      speechText: '家',
      locale: 'zh-CN',
      licenseIdentifier: 'platform-provided',
      sourceName: 'Operating system speech synthesizer',
      sourceReference: 'platform://system-tts',
      attribution: 'Generated on device by the configured system voice.',
    };
    expect(ContentAssetSchema.safeParse(ttsAsset).success).toBe(true);
    expect(ContentAssetSchema.safeParse({ ...ttsAsset, sourceName: '' }).success).toBe(false);
    expect(ContentAssetSchema.safeParse({ ...ttsAsset, delivery: 'bundled_file' }).success).toBe(
      false,
    );
  });

  it('keeps canonical and surface Pinyin explicit instead of guessing tone sandhi', () => {
    const word = demoCurriculumPackage.words[0]!;
    const sentence = demoCurriculumPackage.sentences[0]!;
    expect(word.canonicalPinyin).toBeTruthy();
    expect(word.surfacePinyin).toBeUndefined();
    expect(sentence.canonicalPinyin).toBeTruthy();
    expect(sentence.surfacePinyin).toBeUndefined();
  });
});
