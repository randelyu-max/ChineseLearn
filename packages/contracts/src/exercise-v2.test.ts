import { describe, expect, it } from 'vitest';

import { LearningExerciseV2Schema } from './exercise-v2.ts';
import { learningExerciseV2Fixtures } from './exercise-v2.fixtures.ts';

describe('LearningExerciseV2Schema', () => {
  it('accepts one strict fixture for each of the ten supported exercise types', () => {
    expect(learningExerciseV2Fixtures).toHaveLength(10);
    expect(new Set(learningExerciseV2Fixtures.map((exercise) => exercise.type)).size).toBe(10);
    for (const fixture of learningExerciseV2Fixtures) {
      expect(LearningExerciseV2Schema.parse(fixture)).toEqual(fixture);
    }
  });

  it('rejects invalid answer references and duplicate stable IDs', () => {
    const audio = learningExerciseV2Fixtures[0];
    expect(
      LearningExerciseV2Schema.safeParse({
        ...audio,
        correctOptionId: 'option.not-in-exercise',
      }).success,
    ).toBe(false);
    expect(
      LearningExerciseV2Schema.safeParse({
        ...audio,
        options: [audio.options[0], { ...audio.options[1], optionId: audio.options[0].optionId }],
      }).success,
    ).toBe(false);
  });

  it('rejects ambiguous visible answers', () => {
    const word = learningExerciseV2Fixtures[2];
    expect(
      LearningExerciseV2Schema.safeParse({
        ...word,
        tiles: [word.tiles[0], { ...word.tiles[1], glyph: word.tiles[0].glyph }],
      }).success,
    ).toBe(false);

    const pinyinToGlyph = learningExerciseV2Fixtures[6];
    expect(
      LearningExerciseV2Schema.safeParse({
        ...pinyinToGlyph,
        contextHintZh: null,
      }).success,
    ).toBe(false);
  });

  it('rejects illegal Pinyin assemblies and inconsistent normalized display', () => {
    const build = learningExerciseV2Fixtures[9];
    expect(
      LearningExerciseV2Schema.safeParse({
        ...build,
        correctFinalOptionId: 'final.ong',
      }).success,
    ).toBe(false);

    const audioToPinyin = learningExerciseV2Fixtures[4];
    expect(
      LearningExerciseV2Schema.safeParse({
        ...audioToPinyin,
        options: [
          { ...audioToPinyin.options[0], display: 'má' },
          ...audioToPinyin.options.slice(1),
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects ownership and server-authority fields at the exercise boundary', () => {
    const fixture = learningExerciseV2Fixtures[0];
    expect(
      LearningExerciseV2Schema.safeParse({
        ...fixture,
        userId: '00000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(false);
    expect(
      LearningExerciseV2Schema.safeParse({
        ...fixture,
        mastery: 0.9,
      }).success,
    ).toBe(false);
  });
});
