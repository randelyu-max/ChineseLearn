import type { LearningExerciseV2 } from './exercise-v2.ts';

const header = (activityId: string) =>
  ({
    schemaVersion: 'learning-exercise-v2',
    activityId,
    instructionZh: '请选择正确答案。',
    instructionAccessibilityLabel: '请听题或阅读题目，然后选择正确答案。',
  }) as const;

const pinyinPrompt = (display: string, numbered: string) => ({
  display,
  numbered,
  accessibilityLabel: `拼音 ${display}`,
});

export const learningExerciseV2Fixtures = [
  {
    ...header('exercise.audio-to-glyph.1'),
    type: 'audio_to_glyph',
    promptAudioAssetKey: 'audio.shui.v1',
    options: [
      { optionId: 'option.shui', glyph: '水', accessibilityLabel: '水，喝水的水' },
      { optionId: 'option.mu', glyph: '木', accessibilityLabel: '木，木头的木' },
    ],
    correctOptionId: 'option.shui',
    visualHintZh: '找一找有三点水的字。',
  },
  {
    ...header('exercise.glyph-to-image.1'),
    type: 'glyph_to_image',
    promptGlyph: '水',
    promptAccessibilityLabel: '汉字水',
    options: [
      {
        optionId: 'option.water-image',
        imageAssetKey: 'image.water.v1',
        accessibilityLabel: '一杯水',
      },
      {
        optionId: 'option.tree-image',
        imageAssetKey: 'image.tree.v1',
        accessibilityLabel: '一棵树',
      },
    ],
    correctOptionId: 'option.water-image',
    visualHintZh: null,
  },
  {
    ...header('exercise.word-build.1'),
    type: 'word_build',
    promptZh: '组成“吃饭”。',
    promptAudioAssetKey: 'audio.chifan.v1',
    targetWord: '吃饭',
    tiles: [
      { tileId: 'tile.chi', glyph: '吃', accessibilityLabel: '吃字' },
      { tileId: 'tile.fan', glyph: '饭', accessibilityLabel: '饭字' },
    ],
    correctTileOrder: ['tile.chi', 'tile.fan'],
    visualHintZh: null,
  },
  {
    ...header('exercise.sentence-order.1'),
    type: 'sentence_order',
    promptZh: '组成“我喝水”。',
    promptAudioAssetKey: null,
    targetSentence: '我喝水。',
    tiles: [
      { tileId: 'tile.wo', text: '我', accessibilityLabel: '词语我' },
      { tileId: 'tile.heshui', text: '喝水', accessibilityLabel: '词语喝水' },
      { tileId: 'tile.stop', text: '。', accessibilityLabel: '句号' },
    ],
    correctTileOrder: ['tile.wo', 'tile.heshui', 'tile.stop'],
    visualHintZh: '先说谁，再说做什么。',
  },
  {
    ...header('exercise.audio-to-pinyin.1'),
    type: 'audio_to_pinyin',
    promptAudioAssetKey: 'audio.ma3.v1',
    options: [
      {
        optionId: 'option.ma3',
        display: 'mǎ',
        numbered: 'ma3',
        accessibilityLabel: 'mǎ，第三声',
      },
      {
        optionId: 'option.ma1',
        display: 'mā',
        numbered: 'ma1',
        accessibilityLabel: 'mā，第一声',
      },
      {
        optionId: 'option.ma4',
        display: 'mà',
        numbered: 'ma4',
        accessibilityLabel: 'mà，第四声',
      },
    ],
    correctOptionId: 'option.ma3',
  },
  {
    ...header('exercise.pinyin-to-audio.1'),
    type: 'pinyin_to_audio',
    prompt: pinyinPrompt('má', 'ma2'),
    options: [
      {
        optionId: 'option.audio-ma1',
        audioAssetKey: 'audio.ma1.v1',
        numbered: 'ma1',
        accessibilityLabel: '发音选项 A',
      },
      {
        optionId: 'option.audio-ma2',
        audioAssetKey: 'audio.ma2.v1',
        numbered: 'ma2',
        accessibilityLabel: '发音选项 B',
      },
      {
        optionId: 'option.audio-ma3',
        audioAssetKey: 'audio.ma3.v1',
        numbered: 'ma3',
        accessibilityLabel: '发音选项 C',
      },
    ],
    correctOptionId: 'option.audio-ma2',
  },
  {
    ...header('exercise.pinyin-to-glyph.1'),
    type: 'pinyin_to_glyph',
    prompt: pinyinPrompt('mǎ', 'ma3'),
    contextHintZh: '这个字出现在“骑___”里。',
    options: [
      {
        optionId: 'option.glyph-ma',
        glyph: '马',
        numbered: 'ma3',
        accessibilityLabel: '马，骑马的马',
      },
      {
        optionId: 'option.glyph-code',
        glyph: '码',
        numbered: 'ma3',
        accessibilityLabel: '码，号码的码',
      },
      {
        optionId: 'option.glyph-mother',
        glyph: '妈',
        numbered: 'ma1',
        accessibilityLabel: '妈，妈妈的妈',
      },
    ],
    correctOptionId: 'option.glyph-ma',
  },
  {
    ...header('exercise.glyph-to-pinyin.1'),
    type: 'glyph_to_pinyin',
    targetGlyph: '行',
    targetAccessibilityLabel: '行，银行的行',
    contextZh: '银行',
    knownReadings: ['hang2', 'xing2'],
    options: [
      {
        optionId: 'option.hang2',
        display: 'háng',
        numbered: 'hang2',
        accessibilityLabel: 'háng，第二声',
      },
      {
        optionId: 'option.xing2',
        display: 'xíng',
        numbered: 'xing2',
        accessibilityLabel: 'xíng，第二声',
      },
      {
        optionId: 'option.hang4',
        display: 'hàng',
        numbered: 'hang4',
        accessibilityLabel: 'hàng，第四声',
      },
    ],
    acceptedOptionIds: ['option.hang2'],
    hintZh: '这里说的是和钱有关的机构。',
  },
  {
    ...header('exercise.tone-choice.1'),
    type: 'tone_choice',
    promptAudioAssetKey: 'audio.ma5.v1',
    baseSyllable: 'ma',
    targetSyllable: 'ma5',
    contextZh: '你好吗？',
    options: [
      { optionId: 'tone.1', tone: 1, display: 'mā', accessibilityLabel: 'mā，第一声' },
      { optionId: 'tone.2', tone: 2, display: 'má', accessibilityLabel: 'má，第二声' },
      { optionId: 'tone.3', tone: 3, display: 'mǎ', accessibilityLabel: 'mǎ，第三声' },
      { optionId: 'tone.4', tone: 4, display: 'mà', accessibilityLabel: 'mà，第四声' },
      { optionId: 'tone.5', tone: 5, display: 'ma', accessibilityLabel: 'ma，轻声' },
    ],
    correctOptionId: 'tone.5',
  },
  {
    ...header('exercise.pinyin-syllable-build.1'),
    type: 'pinyin_syllable_build',
    targetSyllable: 'xue2',
    initialOptions: [
      { optionId: 'initial.x', value: 'x', accessibilityLabel: '声母 x' },
      { optionId: 'initial.q', value: 'q', accessibilityLabel: '声母 q' },
    ],
    finalOptions: [
      { optionId: 'final.ue', value: 'üe', accessibilityLabel: '韵母 üe' },
      { optionId: 'final.ie', value: 'ie', accessibilityLabel: '韵母 ie' },
      { optionId: 'final.ong', value: 'ong', accessibilityLabel: '韵母 ong' },
    ],
    toneOptions: [
      { optionId: 'build-tone.1', value: 1, accessibilityLabel: '第一声' },
      { optionId: 'build-tone.2', value: 2, accessibilityLabel: '第二声' },
      { optionId: 'build-tone.3', value: 3, accessibilityLabel: '第三声' },
    ],
    correctInitialOptionId: 'initial.x',
    correctFinalOptionId: 'final.ue',
    correctToneOptionId: 'build-tone.2',
  },
] as const satisfies readonly LearningExerciseV2[];
