import { describe, expect, it } from 'vitest';

import { learningExerciseV2Fixtures } from './exercise-v2.fixtures.ts';
import { PinyinLessonExerciseV1Schema } from './pinyin-session-material.ts';

const pinyinToGlyph = learningExerciseV2Fixtures[6]!;
const source = {
  schemaVersion: 'pinyin-lesson-exercise-v1',
  minimumClientCapability: 'pinyin-exercises-v1',
  exercise: pinyinToGlyph,
  evidenceTargets: [
    {
      schemaVersion: 'evidence-target-v1',
      conceptType: 'pinyin',
      conceptId: 'pinyin.syllable.ma3',
      skill: 'pinyin_to_glyph',
      abilityAxis: 'pinyin_recognition',
      role: 'primary',
    },
    {
      schemaVersion: 'evidence-target-v1',
      conceptType: 'character',
      conceptId: 'character.ma',
      skill: 'pinyin_to_glyph',
      abilityAxis: 'hanzi_recognition',
      role: 'transfer',
    },
  ],
  pinyinSkillType: 'syllable',
  pinyinSupportApplicable: false,
  estimatedSeconds: 60,
} as const;

describe('Pinyin Lesson exercise source', () => {
  it('requires explicit cross-domain Evidence and a client capability', () => {
    expect(PinyinLessonExerciseV1Schema.parse(source)).toEqual(source);
  });

  it('rejects a mismatched skill or missing Hanzi transfer target', () => {
    expect(
      PinyinLessonExerciseV1Schema.safeParse({
        ...source,
        evidenceTargets: [source.evidenceTargets[0]],
      }).success,
    ).toBe(false);
    expect(
      PinyinLessonExerciseV1Schema.safeParse({
        ...source,
        evidenceTargets: [
          { ...source.evidenceTargets[0], skill: 'audio_to_pinyin' },
          source.evidenceTargets[1],
        ],
      }).success,
    ).toBe(false);
  });
});
