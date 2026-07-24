import type { LearningExercise, PinyinLessonExerciseV1 } from '@hanziquest/contracts';

export const PRODUCTION_CURRICULUM_RELEASE_SCHEMA_VERSION =
  'production-curriculum-release-v1' as const;
export const PRODUCTION_CURRICULUM_VERSION_ID = '81000000-0000-4000-8000-000000000001';
export const PRODUCTION_CURRICULUM_VERSION = '1.0.0';

const id = (suffix: number) => `81000000-0000-4000-8000-${suffix.toString().padStart(12, '0')}`;

const characterIds = {
  home: id(101),
  me: id(102),
  study: id(103),
  middle: id(104),
  writing: id(105),
  water: id(106),
} as const;

const wordIds = {
  chinese: id(201),
  goHome: id(202),
  study: id(203),
  drinkWater: id(204),
} as const;

const sentenceIds = {
  learnChinese: id(301),
  writeChinese: id(302),
  goHome: id(303),
} as const;

const ttsAssetId = id(401);
const neutralToneConceptId = '82000000-0000-4000-8000-000000000305';

const audioToGlyph: LearningExercise = {
  activityId: id(501),
  type: 'audio_to_glyph',
  promptAudioAssetId: ttsAssetId,
  targetConceptIds: [characterIds.home],
  options: [
    { optionId: id(511), glyph: '家', accessibilityLabel: '家' },
    { optionId: id(512), glyph: '水', accessibilityLabel: '水' },
  ],
  correctOptionId: id(511),
  visualHintZh: '想一想“回家”的“家”。',
};

const wordBuild: LearningExercise = {
  activityId: id(502),
  type: 'word_build',
  promptZh: '按顺序组成“中文”。',
  promptAudioAssetId: ttsAssetId,
  targetConceptIds: [wordIds.chinese],
  targetWord: '中文',
  tiles: [
    { tileId: id(521), glyph: '中', accessibilityLabel: '中' },
    { tileId: id(522), glyph: '文', accessibilityLabel: '文' },
  ],
  correctTileOrder: [id(521), id(522)],
  visualHintZh: '先选“中”，再选“文”。',
};

const sentenceOrder: LearningExercise = {
  activityId: id(503),
  type: 'sentence_order',
  promptZh: '把词语排成一句自然的话。',
  promptAudioAssetId: ttsAssetId,
  targetConceptIds: [sentenceIds.learnChinese],
  targetSentence: '我学习中文',
  tiles: [
    { tileId: id(531), text: '我', accessibilityLabel: '我' },
    { tileId: id(532), text: '学习', accessibilityLabel: '学习' },
    { tileId: id(533), text: '中文', accessibilityLabel: '中文' },
  ],
  correctTileOrder: [id(531), id(532), id(533)],
  visualHintZh: '先说人物，再说动作和内容。',
};

const toneChoice: PinyinLessonExerciseV1 = {
  schemaVersion: 'pinyin-lesson-exercise-v1',
  minimumClientCapability: 'pinyin-exercises-v1',
  exercise: {
    schemaVersion: 'learning-exercise-v2',
    activityId: 'production.pinyin.tone.neutral.v1',
    instructionZh: '请选择“吗”在问句中的声调。',
    instructionAccessibilityLabel: '请选择“吗”在问句中的正确声调。',
    type: 'tone_choice',
    promptAudioAssetKey: null,
    baseSyllable: 'ma',
    targetSyllable: 'ma5',
    contextZh: '你学习中文吗？',
    options: [
      { optionId: id(541), tone: 1, display: 'mā', accessibilityLabel: 'mā，第一声' },
      { optionId: id(542), tone: 2, display: 'má', accessibilityLabel: 'má，第二声' },
      { optionId: id(543), tone: 3, display: 'mǎ', accessibilityLabel: 'mǎ，第三声' },
      { optionId: id(544), tone: 4, display: 'mà', accessibilityLabel: 'mà，第四声' },
      { optionId: id(545), tone: 5, display: 'ma', accessibilityLabel: 'ma，轻声' },
    ],
    correctOptionId: id(545),
  },
  evidenceTargets: [
    {
      schemaVersion: 'evidence-target-v1',
      conceptType: 'pinyin',
      conceptId: neutralToneConceptId,
      skill: 'tone_choice',
      abilityAxis: 'tone_discrimination',
      role: 'primary',
    },
  ],
  pinyinSkillType: 'tone',
  pinyinSupportApplicable: false,
  estimatedSeconds: 45,
};

export const productionCurriculumReleaseV1 = Object.freeze({
  schemaVersion: PRODUCTION_CURRICULUM_RELEASE_SCHEMA_VERSION,
  releaseId: PRODUCTION_CURRICULUM_VERSION_ID,
  version: PRODUCTION_CURRICULUM_VERSION,
  minimumAppVersion: '1.0.0',
  spokenTrack: 'mandarin',
  scriptTrack: 'simplified',
  editorialReview: Object.freeze({
    status: 'approved',
    checklistId: 'production-v1-editorial-checklist-2026-07-24',
    scope: 'starter release pipeline content',
  }),
  coverage: Object.freeze({
    characters: { actual: 6, target: 100 },
    words: { actual: 4, target: 200 },
    sentencePatterns: { actual: 3, target: 30 },
    shortStories: { actual: 1, target: 10 },
    pinyinFoundationIncluded: true,
  }),
  media: Object.freeze([
    Object.freeze({
      id: ttsAssetId,
      assetKey: 'production-v1-system-tts-zh-cn',
      delivery: 'system_tts',
      locale: 'zh-CN',
      authorized: true,
      licenseIdentifier: 'operating-system-runtime',
      sourceReference: 'device:system-tts',
    }),
  ]),
  previousVersionMappings: Object.freeze([]),
  world: Object.freeze({
    id: id(2),
    slug: 'everyday-chinese',
    titleZh: '日常中文',
    titleEn: 'Everyday Chinese',
  }),
  unit: Object.freeze({
    id: id(3),
    slug: 'start-reading',
    titleZh: '开始阅读',
    titleEn: 'Start reading',
  }),
  lessons: Object.freeze([
    Object.freeze({
      id: id(4),
      slug: 'home-and-study',
      titleZh: '家与学习',
      exercises: Object.freeze([audioToGlyph, wordBuild, sentenceOrder]),
      concepts: Object.freeze([
        { conceptType: 'character', conceptId: characterIds.home, role: 'target' },
        { conceptType: 'word', conceptId: wordIds.chinese, role: 'target' },
        { conceptType: 'sentence', conceptId: sentenceIds.learnChinese, role: 'target' },
      ]),
    }),
    Object.freeze({
      id: id(5),
      slug: 'first-tone-review',
      titleZh: '声调入门',
      exercises: Object.freeze([toneChoice]),
      concepts: Object.freeze([
        { conceptType: 'pinyin', conceptId: neutralToneConceptId, role: 'target' },
      ]),
    }),
  ]),
  characters: Object.freeze([
    {
      id: characterIds.home,
      code: 'v1.character.jia',
      simplified: '家',
      traditional: '家',
      pinyin: 'jiā',
      meaningZh: '居住的地方',
      meaningEn: 'home',
    },
    {
      id: characterIds.me,
      code: 'v1.character.wo',
      simplified: '我',
      traditional: '我',
      pinyin: 'wǒ',
      meaningZh: '说话的人自己',
      meaningEn: 'I; me',
    },
    {
      id: characterIds.study,
      code: 'v1.character.xue',
      simplified: '学',
      traditional: '學',
      pinyin: 'xué',
      meaningZh: '学习',
      meaningEn: 'to learn',
    },
    {
      id: characterIds.middle,
      code: 'v1.character.zhong',
      simplified: '中',
      traditional: '中',
      pinyin: 'zhōng',
      meaningZh: '中间',
      meaningEn: 'middle',
    },
    {
      id: characterIds.writing,
      code: 'v1.character.wen',
      simplified: '文',
      traditional: '文',
      pinyin: 'wén',
      meaningZh: '文字或文章',
      meaningEn: 'writing; language',
    },
    {
      id: characterIds.water,
      code: 'v1.character.shui',
      simplified: '水',
      traditional: '水',
      pinyin: 'shuǐ',
      meaningZh: '供饮用的液体',
      meaningEn: 'water',
    },
  ]),
  words: Object.freeze([
    {
      id: wordIds.chinese,
      code: 'v1.word.zhongwen',
      simplified: '中文',
      traditional: '中文',
      pinyin: 'zhōng wén',
      characterIds: [characterIds.middle, characterIds.writing],
    },
    {
      id: wordIds.goHome,
      code: 'v1.word.huijia',
      simplified: '回家',
      traditional: '回家',
      pinyin: 'huí jiā',
      characterIds: [characterIds.home],
    },
    {
      id: wordIds.study,
      code: 'v1.word.xuexi',
      simplified: '学习',
      traditional: '學習',
      pinyin: 'xué xí',
      characterIds: [characterIds.study],
    },
    {
      id: wordIds.drinkWater,
      code: 'v1.word.heshui',
      simplified: '喝水',
      traditional: '喝水',
      pinyin: 'hē shuǐ',
      characterIds: [characterIds.water],
    },
  ]),
  sentences: Object.freeze([
    {
      id: sentenceIds.learnChinese,
      code: 'v1.sentence.learn-chinese',
      simplified: '我学习中文。',
      traditional: '我學習中文。',
      pinyin: 'wǒ xué xí zhōng wén',
      wordIds: [wordIds.study, wordIds.chinese],
      targetCharacterIds: [characterIds.study, characterIds.middle, characterIds.writing],
    },
    {
      id: sentenceIds.writeChinese,
      code: 'v1.sentence.write-chinese',
      simplified: '我写中文。',
      traditional: '我寫中文。',
      pinyin: 'wǒ xiě zhōng wén',
      wordIds: [wordIds.chinese],
      targetCharacterIds: [characterIds.middle, characterIds.writing],
    },
    {
      id: sentenceIds.goHome,
      code: 'v1.sentence.go-home',
      simplified: '我回家学习。',
      traditional: '我回家學習。',
      pinyin: 'wǒ huí jiā xué xí',
      wordIds: [wordIds.goHome, wordIds.study],
      targetCharacterIds: [characterIds.home, characterIds.study],
    },
  ]),
  stories: Object.freeze([
    {
      id: id(601),
      code: 'v1.story.first-study-plan',
      titleZh: '今天的学习计划',
      titleEn: 'Today’s study plan',
      sentenceIds: [sentenceIds.goHome, sentenceIds.learnChinese, sentenceIds.writeChinese],
      targetCharacterIds: [
        characterIds.home,
        characterIds.study,
        characterIds.middle,
        characterIds.writing,
      ],
      questions: [
        {
          promptZh: '故事中的人学习什么？',
          optionsZh: ['中文', '音乐'],
          correctOptionIndex: 0,
        },
      ],
    },
  ]),
} as const);

export type ProductionCurriculumRelease = typeof productionCurriculumReleaseV1;
