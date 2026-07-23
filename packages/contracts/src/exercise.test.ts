import { describe, expect, it } from 'vitest';

import {
  AudioToGlyphExerciseSchema,
  GlyphToImageExerciseSchema,
  SentenceOrderExerciseSchema,
  WordBuildExerciseSchema,
} from './exercise.ts';

const optionOne = '00000000-0000-4000-8000-000000000011';
const optionTwo = '00000000-0000-4000-8000-000000000012';
const exercise = {
  activityId: '00000000-0000-4000-8000-000000000001',
  type: 'audio_to_glyph',
  promptAudioAssetId: '00000000-0000-4000-8000-000000000002',
  targetConceptIds: ['00000000-0000-4000-8000-000000000003'],
  options: [
    { optionId: optionOne, glyph: '水', accessibilityLabel: '水，喝水的水' },
    { optionId: optionTwo, glyph: '木', accessibilityLabel: '木，木头的木' },
  ],
  correctOptionId: optionOne,
  visualHintZh: '找一找有三点水的字。',
} as const;

describe('AudioToGlyphExerciseSchema', () => {
  it('accepts a valid exercise', () => {
    expect(AudioToGlyphExerciseSchema.parse(exercise)).toEqual(exercise);
  });

  it('requires two to four single-glyph options', () => {
    expect(
      AudioToGlyphExerciseSchema.safeParse({ ...exercise, options: [exercise.options[0]] }).success,
    ).toBe(false);
    expect(
      AudioToGlyphExerciseSchema.safeParse({
        ...exercise,
        options: [{ ...exercise.options[0], glyph: '喝水' }, exercise.options[1]],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate options and a missing correct option', () => {
    expect(
      AudioToGlyphExerciseSchema.safeParse({
        ...exercise,
        options: [exercise.options[0], { ...exercise.options[1], optionId: optionOne }],
      }).success,
    ).toBe(false);
    expect(
      AudioToGlyphExerciseSchema.safeParse({
        ...exercise,
        correctOptionId: '00000000-0000-4000-8000-000000000099',
      }).success,
    ).toBe(false);
  });
});

describe('SentenceOrderExerciseSchema', () => {
  const me = '00000000-0000-4000-8000-000000000041';
  const want = '00000000-0000-4000-8000-000000000042';
  const eatRice = '00000000-0000-4000-8000-000000000043';
  const stop = '00000000-0000-4000-8000-000000000044';
  const sentenceExercise = {
    activityId: '00000000-0000-4000-8000-000000000045',
    type: 'sentence_order',
    promptZh: '把词语排成一句话。',
    promptAudioAssetId: '00000000-0000-4000-8000-000000000046',
    targetConceptIds: ['00000000-0000-4000-8000-000000000047'],
    targetSentence: '我要吃饭。',
    tiles: [
      { tileId: eatRice, text: '吃饭', accessibilityLabel: '词语：吃饭' },
      { tileId: me, text: '我', accessibilityLabel: '词语：我' },
      { tileId: stop, text: '。', accessibilityLabel: '句号' },
      { tileId: want, text: '要', accessibilityLabel: '词语：要' },
    ],
    correctTileOrder: [me, want, eatRice, stop],
    visualHintZh: '一句话通常先说“谁”，再说做什么。',
  } as const;

  it('accepts a complete sentence permutation', () => {
    expect(SentenceOrderExerciseSchema.parse(sentenceExercise)).toEqual(sentenceExercise);
  });

  it('rejects missing tiles and an order that forms different text', () => {
    expect(
      SentenceOrderExerciseSchema.safeParse({ ...sentenceExercise, correctTileOrder: [me, want] })
        .success,
    ).toBe(false);
    expect(
      SentenceOrderExerciseSchema.safeParse({
        ...sentenceExercise,
        correctTileOrder: [want, me, eatRice, stop],
      }).success,
    ).toBe(false);
  });
});

describe('GlyphToImageExerciseSchema', () => {
  const imageExercise = {
    activityId: '00000000-0000-4000-8000-000000000021',
    type: 'glyph_to_image',
    promptGlyph: '水',
    promptAudioAssetId: '00000000-0000-4000-8000-000000000022',
    targetConceptIds: ['00000000-0000-4000-8000-000000000023'],
    options: [
      {
        optionId: '00000000-0000-4000-8000-000000000024',
        imageAssetId: '00000000-0000-4000-8000-000000000025',
        accessibilityLabel: '一杯水',
      },
      {
        optionId: '00000000-0000-4000-8000-000000000026',
        imageAssetId: '00000000-0000-4000-8000-000000000027',
        accessibilityLabel: '一棵树',
      },
    ],
    correctOptionId: '00000000-0000-4000-8000-000000000024',
    visualHintZh: '想一想喝水时会看到什么。',
  } as const;

  it('accepts distinct local asset options', () => {
    expect(GlyphToImageExerciseSchema.parse(imageExercise)).toEqual(imageExercise);
  });

  it('rejects duplicate assets, missing answers and multi-character prompts', () => {
    expect(
      GlyphToImageExerciseSchema.safeParse({
        ...imageExercise,
        options: [
          imageExercise.options[0],
          { ...imageExercise.options[1], imageAssetId: imageExercise.options[0].imageAssetId },
        ],
      }).success,
    ).toBe(false);
    expect(
      GlyphToImageExerciseSchema.safeParse({
        ...imageExercise,
        correctOptionId: '00000000-0000-4000-8000-000000000099',
      }).success,
    ).toBe(false);
    expect(
      GlyphToImageExerciseSchema.safeParse({ ...imageExercise, promptGlyph: '喝水' }).success,
    ).toBe(false);
  });
});

describe('WordBuildExerciseSchema', () => {
  const eatTile = '00000000-0000-4000-8000-000000000031';
  const riceTile = '00000000-0000-4000-8000-000000000032';
  const wordExercise = {
    activityId: '00000000-0000-4000-8000-000000000033',
    type: 'word_build',
    promptZh: '把字排成“吃饭”。',
    promptAudioAssetId: '00000000-0000-4000-8000-000000000034',
    targetConceptIds: ['00000000-0000-4000-8000-000000000035'],
    targetWord: '吃饭',
    tiles: [
      { tileId: riceTile, glyph: '饭', accessibilityLabel: '饭字' },
      { tileId: eatTile, glyph: '吃', accessibilityLabel: '吃字' },
    ],
    correctTileOrder: [eatTile, riceTile],
    visualHintZh: '先找表示动作的“吃”。',
  } as const;

  it('accepts a complete tile permutation that forms the word', () => {
    expect(WordBuildExerciseSchema.parse(wordExercise)).toEqual(wordExercise);
  });

  it('rejects missing, duplicate and wrongly assembled tile orders', () => {
    expect(
      WordBuildExerciseSchema.safeParse({ ...wordExercise, correctTileOrder: [eatTile] }).success,
    ).toBe(false);
    expect(
      WordBuildExerciseSchema.safeParse({ ...wordExercise, correctTileOrder: [eatTile, eatTile] })
        .success,
    ).toBe(false);
    expect(
      WordBuildExerciseSchema.safeParse({ ...wordExercise, correctTileOrder: [riceTile, eatTile] })
        .success,
    ).toBe(false);
  });
});
