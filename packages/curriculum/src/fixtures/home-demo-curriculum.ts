import type { CharacterConcept, ContentAsset, CurriculumPackage, Sentence } from '../schemas.ts';

const id = (suffix: string) => `10000000-0000-4000-8000-${suffix.padStart(12, '0')}`;

export const homeDemoIds = {
  track: id('1'),
  world: id('2'),
  unit: id('3'),
  lesson: id('4'),
  activities: [id('11'), id('12'), id('13'), id('14'), id('15')],
  story: id('301'),
  question: id('302'),
  sentences: [id('201'), id('202'), id('203')],
  assets: {
    familyAudio: id('401'),
    homeAudio: id('402'),
    wordAudio: id('403'),
    sentenceAudio: id('404'),
    storyAudio: id('405'),
    homeImage: id('411'),
    treeImage: id('412'),
    riceImage: id('413'),
  },
} as const;

const characterData = [
  ['我', '我', 'wǒ', '说话的人自己', 'I or me'],
  ['你', '你', 'nǐ', '正在听我说话的人', 'you'],
  ['他', '他', 'tā', '另一个男生或男人', 'he or him'],
  ['爸', '爸', 'bà', '爸爸', 'dad'],
  ['妈', '媽', 'mā', '妈妈', 'mom'],
  ['家', '家', 'jiā', '一起生活的地方和家人', 'home or family'],
  ['门', '門', 'mén', '进出房间的地方', 'door'],
  ['床', '床', 'chuáng', '睡觉用的家具', 'bed'],
  ['看', '看', 'kàn', '用眼睛注意', 'to look or read'],
  ['来', '來', 'lái', '向这里移动', 'to come'],
  ['有', '有', 'yǒu', '表示拥有或存在', 'to have'],
  ['书', '書', 'shū', '装着文字和图片的读物', 'book'],
  ['水', '水', 'shuǐ', '可以喝的透明液体', 'water'],
  ['吃', '吃', 'chī', '把食物放进嘴里', 'to eat'],
  ['饭', '飯', 'fàn', '一顿饭或煮熟的米', 'meal or cooked rice'],
  ['大', '大', 'dà', '大小比较中较大的', 'big'],
  ['小', '小', 'xiǎo', '大小比较中较小的', 'small'],
  ['好', '好', 'hǎo', '让人满意或舒服', 'good'],
  ['不', '不', 'bù', '表示否定', 'not'],
  ['人', '人', 'rén', '一个人', 'person'],
] as const;

export const homeDemoConceptIds = Object.fromEntries(
  characterData.map(([simplified], index) => [simplified, id(String(101 + index))]),
) as Record<string, string>;

function character(entry: (typeof characterData)[number]): CharacterConcept {
  const [simplified, traditional, pinyin, meaningZh, meaningEn] = entry;
  return {
    conceptId: homeDemoConceptIds[simplified]!,
    glyph: { simplified, traditional },
    pronunciations: { mandarin: [{ pinyin, isPrimary: true }] },
    meaningZh,
    meaningEn,
    difficulty: 1,
    prerequisiteConceptIds: [],
    confusableConceptIds: [],
    status: 'published',
  };
}

function sentence(
  idValue: string,
  simplified: string,
  traditional: string,
  canonicalPinyin: string,
  glyphs: string[],
  target: string,
): Sentence {
  return {
    id: idValue,
    text: { simplified, traditional },
    canonicalPinyin,
    meaningEn: 'A sentence from the My Home demo story.',
    characterConceptIds: glyphs.map((glyph) => homeDemoConceptIds[glyph]!),
    targetConceptIds: [homeDemoConceptIds[target]!],
    difficulty: 1,
    maxUnknownCharacters: 1,
    status: 'published',
  };
}

function ttsAsset(idValue: string, speechText: string): ContentAsset {
  return {
    id: idValue,
    kind: 'audio',
    delivery: 'system_tts',
    speechText,
    locale: 'zh-CN',
    licenseIdentifier: 'platform-provided',
    sourceName: 'Operating system speech synthesizer',
    sourceReference: 'platform://system-tts/zh-CN',
    attribution: 'Generated on device by the configured Mandarin system voice.',
  };
}

function originalImage(idValue: string, filename: string): ContentAsset {
  return {
    id: idValue,
    kind: 'image',
    delivery: 'bundled_file',
    localPath: `apps/mobile/assets/demo/${filename}`,
    licenseIdentifier: 'CC0-1.0',
    sourceName: 'Original HanziQuest demo placeholder art',
    sourceReference: 'project://hanziquest/task-1.5-demo-art',
    attribution: 'Original project asset dedicated to the public domain for the demo.',
  };
}

const words = [
  ['爸妈', '爸媽', 'bà mā', ['爸', '妈']],
  ['我家', '我家', 'wǒ jiā', ['我', '家']],
  ['家门', '家門', 'jiā mén', ['家', '门']],
  ['看书', '看書', 'kàn shū', ['看', '书']],
  ['你来', '你來', 'nǐ lái', ['你', '来']],
  ['他来', '他來', 'tā lái', ['他', '来']],
  ['大门', '大門', 'dà mén', ['大', '门']],
  ['小床', '小床', 'xiǎo chuáng', ['小', '床']],
  ['好书', '好書', 'hǎo shū', ['好', '书']],
  ['不看', '不看', 'bù kàn', ['不', '看']],
] as const;

export const homeDemoCurriculumPackage: CurriculumPackage = {
  schemaVersion: 'curriculum-package-v1',
  curriculumVersion: '1.0.0',
  minimumAppVersion: '1.0.0',
  track: {
    id: homeDemoIds.track,
    slug: 'mandarin-simplified-home-demo',
    title: { simplified: '普通话简体演示', traditional: '普通話簡體演示' },
    scriptVariant: 'simplified',
    primaryPronunciation: 'mandarin',
    worldIds: [homeDemoIds.world],
  },
  worlds: [
    {
      id: homeDemoIds.world,
      slug: 'my-home',
      title: { simplified: '我的家', traditional: '我的家' },
      theme: 'home-and-family',
      order: 0,
      prerequisiteWorldIds: [],
      unitIds: [homeDemoIds.unit],
    },
  ],
  units: [
    {
      id: homeDemoIds.unit,
      slug: 'meet-my-family',
      title: { simplified: '认识我的家', traditional: '認識我的家' },
      order: 0,
      prerequisiteUnitIds: [],
      lessonIds: [homeDemoIds.lesson],
    },
  ],
  lessons: [
    {
      id: homeDemoIds.lesson,
      slug: 'family-comes-home',
      title: { simplified: '爸妈来我家', traditional: '爸媽來我家' },
      order: 0,
      kind: 'story_challenge',
      prerequisiteLessonIds: [],
      activityIds: [...homeDemoIds.activities],
      expectedMinutes: 8,
    },
  ],
  activities: [
    {
      id: homeDemoIds.activities[0],
      type: 'audio_to_glyph',
      targetConceptIds: [homeDemoConceptIds['家']!],
      references: {
        characterConceptIds: ['家', '门', '床'].map((glyph) => homeDemoConceptIds[glyph]!),
        wordIds: [],
        sentenceIds: [],
        storyIds: [],
        assetIds: [homeDemoIds.assets.homeAudio],
      },
      supportLevel: 'none',
      difficulty: 1,
      estimatedSeconds: 75,
    },
    {
      id: homeDemoIds.activities[1],
      type: 'glyph_to_image',
      targetConceptIds: [homeDemoConceptIds['家']!],
      references: {
        characterConceptIds: [homeDemoConceptIds['家']!],
        wordIds: [],
        sentenceIds: [],
        storyIds: [],
        assetIds: [
          homeDemoIds.assets.homeAudio,
          homeDemoIds.assets.homeImage,
          homeDemoIds.assets.treeImage,
          homeDemoIds.assets.riceImage,
        ],
      },
      supportLevel: 'none',
      difficulty: 1,
      estimatedSeconds: 90,
    },
    {
      id: homeDemoIds.activities[2],
      type: 'word_build',
      targetConceptIds: [homeDemoConceptIds['家']!],
      references: {
        characterConceptIds: ['我', '家'].map((glyph) => homeDemoConceptIds[glyph]!),
        wordIds: [id('502')],
        sentenceIds: [],
        storyIds: [],
        assetIds: [homeDemoIds.assets.wordAudio],
      },
      supportLevel: 'visual_hint',
      difficulty: 1,
      estimatedSeconds: 105,
    },
    {
      id: homeDemoIds.activities[3],
      type: 'sentence_order',
      targetConceptIds: [homeDemoConceptIds['门']!],
      references: {
        characterConceptIds: ['我', '看', '家', '门'].map((glyph) => homeDemoConceptIds[glyph]!),
        wordIds: [],
        sentenceIds: [homeDemoIds.sentences[2]],
        storyIds: [],
        assetIds: [homeDemoIds.assets.sentenceAudio],
      },
      supportLevel: 'visual_hint',
      difficulty: 1,
      estimatedSeconds: 120,
    },
    {
      id: homeDemoIds.activities[4],
      type: 'story_comprehension',
      targetConceptIds: [homeDemoConceptIds['门']!],
      references: {
        characterConceptIds: ['我', '看', '家', '门'].map((glyph) => homeDemoConceptIds[glyph]!),
        wordIds: [],
        sentenceIds: [...homeDemoIds.sentences],
        storyIds: [homeDemoIds.story],
        assetIds: [homeDemoIds.assets.storyAudio],
      },
      supportLevel: 'none',
      difficulty: 1,
      estimatedSeconds: 90,
    },
  ],
  characters: characterData.map(character),
  words: words.map(([simplified, traditional, canonicalPinyin, glyphs], index) => ({
    id: id(String(501 + index)),
    text: { simplified, traditional },
    canonicalPinyin,
    meaningZh: simplified,
    meaningEn: `Demo word: ${simplified}`,
    characterConceptIds: glyphs.map((glyph) => homeDemoConceptIds[glyph]!),
    targetConceptIds: [homeDemoConceptIds[glyphs[glyphs.length - 1]!]!],
    spokenFrequency: 1,
    readingDifficulty: 1,
    contextTags: ['home-and-family'],
    status: 'published' as const,
  })),
  sentences: [
    sentence(
      homeDemoIds.sentences[0],
      '爸爸来我家。',
      '爸爸來我家。',
      'bà ba lái wǒ jiā',
      ['爸', '爸', '来', '我', '家'],
      '来',
    ),
    sentence(
      homeDemoIds.sentences[1],
      '妈妈来我家。',
      '媽媽來我家。',
      'mā ma lái wǒ jiā',
      ['妈', '妈', '来', '我', '家'],
      '来',
    ),
    sentence(
      homeDemoIds.sentences[2],
      '我看家门。',
      '我看家門。',
      'wǒ kàn jiā mén',
      ['我', '看', '家', '门'],
      '门',
    ),
  ],
  stories: [
    {
      id: homeDemoIds.story,
      title: { simplified: '爸妈来我家', traditional: '爸媽來我家' },
      sourceType: 'editorial',
      scriptTrack: 'simplified',
      ageBand: '5-6',
      interestTags: ['home-and-family'],
      sentenceIds: [...homeDemoIds.sentences],
      targetConceptIds: [homeDemoConceptIds['门']!],
      comprehensionQuestions: [
        {
          id: homeDemoIds.question,
          prompt: { simplified: '谁看家门？', traditional: '誰看家門？' },
          options: [
            { simplified: '我', traditional: '我' },
            { simplified: '爸爸', traditional: '爸爸' },
          ],
          correctOptionIndex: 0,
          evidenceSentenceIds: [homeDemoIds.sentences[2]],
        },
      ],
      transferPrompt: {
        simplified: '回家时，找一找门上的汉字。',
        traditional: '回家時，找一找門上的漢字。',
      },
      knownCharacterCoverage: 0.93,
      status: 'published',
    },
  ],
  assets: [
    ttsAsset(homeDemoIds.assets.familyAudio, '爸妈'),
    ttsAsset(homeDemoIds.assets.homeAudio, '家'),
    ttsAsset(homeDemoIds.assets.wordAudio, '我家'),
    ttsAsset(homeDemoIds.assets.sentenceAudio, '我看家门'),
    ttsAsset(homeDemoIds.assets.storyAudio, '爸爸来我家。妈妈来我家。我看家门。'),
    originalImage(homeDemoIds.assets.homeImage, 'home.svg'),
    originalImage(homeDemoIds.assets.treeImage, 'tree.svg'),
    originalImage(homeDemoIds.assets.riceImage, 'rice.svg'),
  ],
};
