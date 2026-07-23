import {
  AudioToGlyphExerciseSchema,
  GlyphToImageExerciseSchema,
  SentenceOrderExerciseSchema,
  WordBuildExerciseSchema,
} from '@hanziquest/contracts';
import { homeDemoConceptIds, homeDemoCurriculumPackage, homeDemoIds } from '@hanziquest/curriculum';

const optionId = (suffix: string) => `20000000-0000-4000-8000-${suffix.padStart(12, '0')}` as const;

export const homeAudioToGlyphExercise = AudioToGlyphExerciseSchema.parse({
  activityId: homeDemoIds.activities[0],
  type: 'audio_to_glyph',
  promptAudioAssetId: homeDemoIds.assets.homeAudio,
  targetConceptIds: [homeDemoConceptIds['家']],
  options: [
    { optionId: optionId('1'), glyph: '门', accessibilityLabel: '门，家门的门' },
    { optionId: optionId('2'), glyph: '家', accessibilityLabel: '家，我家的家' },
    { optionId: optionId('3'), glyph: '床', accessibilityLabel: '床，小床的床' },
  ],
  correctOptionId: optionId('2'),
  visualHintZh: '这个字的上面像一座房子的屋顶。',
});

export const homeGlyphToImageExercise = GlyphToImageExerciseSchema.parse({
  activityId: homeDemoIds.activities[1],
  type: 'glyph_to_image',
  promptGlyph: '家',
  promptAudioAssetId: homeDemoIds.assets.homeAudio,
  targetConceptIds: [homeDemoConceptIds['家']],
  options: [
    {
      optionId: optionId('11'),
      imageAssetId: homeDemoIds.assets.treeImage,
      accessibilityLabel: '一棵树',
    },
    {
      optionId: optionId('12'),
      imageAssetId: homeDemoIds.assets.homeImage,
      accessibilityLabel: '一座温暖的家',
    },
    {
      optionId: optionId('13'),
      imageAssetId: homeDemoIds.assets.riceImage,
      accessibilityLabel: '一碗米饭',
    },
  ],
  correctOptionId: optionId('12'),
  visualHintZh: '家是我们和家人一起生活的地方。',
});

const wordTiles = { me: optionId('21'), home: optionId('22') } as const;

export const homeWordBuildExercise = WordBuildExerciseSchema.parse({
  activityId: homeDemoIds.activities[2],
  type: 'word_build',
  promptZh: '把字排成“我家”。',
  promptAudioAssetId: homeDemoIds.assets.wordAudio,
  targetConceptIds: [homeDemoConceptIds['家']],
  targetWord: '我家',
  tiles: [
    { tileId: wordTiles.home, glyph: '家', accessibilityLabel: '家字，点击加入答案' },
    { tileId: wordTiles.me, glyph: '我', accessibilityLabel: '我字，点击加入答案' },
  ],
  correctTileOrder: [wordTiles.me, wordTiles.home],
  visualHintZh: '先放表示自己的“我”，再放“家”。',
});

const sentenceTiles = {
  me: optionId('31'),
  look: optionId('32'),
  homeDoor: optionId('33'),
  stop: optionId('34'),
} as const;

export const homeSentenceOrderExercise = SentenceOrderExerciseSchema.parse({
  activityId: homeDemoIds.activities[3],
  type: 'sentence_order',
  promptZh: '把词语排成故事里的句子。',
  promptAudioAssetId: homeDemoIds.assets.sentenceAudio,
  targetConceptIds: [homeDemoConceptIds['门']],
  targetSentence: '我看家门。',
  tiles: [
    { tileId: sentenceTiles.homeDoor, text: '家门', accessibilityLabel: '词语：家门' },
    { tileId: sentenceTiles.stop, text: '。', accessibilityLabel: '句号' },
    { tileId: sentenceTiles.me, text: '我', accessibilityLabel: '词语：我' },
    { tileId: sentenceTiles.look, text: '看', accessibilityLabel: '词语：看' },
  ],
  correctTileOrder: [
    sentenceTiles.me,
    sentenceTiles.look,
    sentenceTiles.homeDoor,
    sentenceTiles.stop,
  ],
  visualHintZh: '先说谁，再说做什么，最后说看哪里。',
});

export const homeDemoStory = {
  title: homeDemoCurriculumPackage.stories[0]!.title.simplified,
  sentences: homeDemoCurriculumPackage.stories[0]!.sentenceIds.map(
    (sentenceId) =>
      homeDemoCurriculumPackage.sentences.find((sentence) => sentence.id === sentenceId)!.text
        .simplified,
  ),
  question: homeDemoCurriculumPackage.stories[0]!.comprehensionQuestions[0]!,
  speechText: homeDemoCurriculumPackage.assets.find(
    (asset) => asset.id === homeDemoIds.assets.storyAudio,
  )!.speechText!,
  transferPrompt: homeDemoCurriculumPackage.stories[0]!.transferPrompt.simplified,
} as const;

export const homeDemoVisualByAssetId: Record<string, string> = {
  [homeDemoIds.assets.homeImage]: '🏠',
  [homeDemoIds.assets.treeImage]: '🌳',
  [homeDemoIds.assets.riceImage]: '🍚',
};
