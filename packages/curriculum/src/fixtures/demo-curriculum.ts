import type { CharacterConcept, CurriculumPackage, Sentence } from '../schemas.ts';

const ids = {
  track: '00000000-0000-4000-8000-000000000001',
  world: '00000000-0000-4000-8000-000000000002',
  unit: '00000000-0000-4000-8000-000000000003',
  lesson: '00000000-0000-4000-8000-000000000004',
  activity: '00000000-0000-4000-8000-000000000005',
  eat: '00000000-0000-4000-8000-000000000101',
  rice: '00000000-0000-4000-8000-000000000102',
  me: '00000000-0000-4000-8000-000000000103',
  want: '00000000-0000-4000-8000-000000000104',
  no: '00000000-0000-4000-8000-000000000105',
  word: '00000000-0000-4000-8000-000000000201',
  sentenceOne: '00000000-0000-4000-8000-000000000301',
  sentenceTwo: '00000000-0000-4000-8000-000000000302',
  sentenceThree: '00000000-0000-4000-8000-000000000303',
  story: '00000000-0000-4000-8000-000000000401',
  question: '00000000-0000-4000-8000-000000000402',
} as const;

function createCharacter(
  conceptId: string,
  simplified: string,
  traditional: string,
  pinyin: string,
  meaningZhChild: string,
  meaningEnParent: string,
): CharacterConcept {
  return {
    conceptId,
    glyph: { simplified, traditional },
    pronunciations: {
      mandarin: [{ isPrimary: true, pinyin }],
    },
    meaningZhChild,
    meaningEnParent,
    difficulty: 1,
    prerequisiteConceptIds: [],
    confusableConceptIds: [],
    status: 'published',
  };
}

function createSentence(
  id: string,
  simplified: string,
  traditional: string,
  pinyin: string,
  characterConceptIds: string[],
  targetConceptIds: string[],
): Sentence {
  return {
    id,
    text: { simplified, traditional },
    pinyin,
    meaningEnParent: 'A short sentence about eating rice.',
    characterConceptIds,
    targetConceptIds,
    difficulty: 1,
    maxUnknownCharacters: 1,
    status: 'published',
  };
}

export const demoCurriculumPackage: CurriculumPackage = {
  schemaVersion: 'curriculum-package-v1',
  curriculumVersion: '1.0.0',
  minimumAppVersion: '1.0.0',
  track: {
    id: ids.track,
    slug: 'mandarin-simplified',
    title: { simplified: '普通话简体课程', traditional: '普通話簡體課程' },
    scriptVariant: 'simplified',
    primaryPronunciation: 'mandarin',
    worldIds: [ids.world],
  },
  worlds: [
    {
      id: ids.world,
      slug: 'food-town',
      title: { simplified: '美食小镇', traditional: '美食小鎮' },
      theme: 'food-and-family',
      order: 0,
      prerequisiteWorldIds: [],
      unitIds: [ids.unit],
    },
  ],
  units: [
    {
      id: ids.unit,
      slug: 'everyday-meals',
      title: { simplified: '每天吃饭', traditional: '每天吃飯' },
      order: 0,
      prerequisiteUnitIds: [],
      lessonIds: [ids.lesson],
    },
  ],
  lessons: [
    {
      id: ids.lesson,
      slug: 'eat-rice',
      title: { simplified: '我要吃饭', traditional: '我要吃飯' },
      order: 0,
      kind: 'standard',
      prerequisiteLessonIds: [],
      activityIds: [ids.activity],
      expectedMinutes: 5,
    },
  ],
  activities: [
    {
      id: ids.activity,
      type: 'audio_to_glyph',
      targetConceptIds: [ids.rice],
      references: {
        characterConceptIds: [ids.eat, ids.rice],
        wordIds: [ids.word],
        sentenceIds: [],
        storyIds: [],
        assetIds: [],
      },
      supportLevel: 'none',
      difficulty: 1,
      estimatedSeconds: 30,
    },
  ],
  characters: [
    createCharacter(ids.eat, '吃', '吃', 'chī', '把食物放进嘴里', 'to eat'),
    createCharacter(ids.rice, '饭', '飯', 'fàn', '煮熟后吃的食物', 'meal or cooked rice'),
    createCharacter(ids.me, '我', '我', 'wǒ', '说话的人自己', 'I or me'),
    createCharacter(ids.want, '要', '要', 'yào', '想得到或准备做', 'to want'),
    createCharacter(ids.no, '不', '不', 'bù', '表示否定', 'not or no'),
  ],
  words: [
    {
      id: ids.word,
      text: { simplified: '吃饭', traditional: '吃飯' },
      pinyin: 'chī fàn',
      meaningZhChild: '吃一顿饭',
      meaningEnParent: 'to eat a meal',
      characterConceptIds: [ids.eat, ids.rice],
      targetConceptIds: [ids.rice],
      spokenFrequency: 1,
      readingDifficulty: 1,
      contextTags: ['food-and-family'],
      status: 'published',
    },
  ],
  sentences: [
    createSentence(
      ids.sentenceOne,
      '我要吃饭。',
      '我要吃飯。',
      'wǒ yào chī fàn',
      [ids.me, ids.want, ids.eat, ids.rice],
      [ids.rice],
    ),
    createSentence(
      ids.sentenceTwo,
      '我要吃。',
      '我要吃。',
      'wǒ yào chī',
      [ids.me, ids.want, ids.eat],
      [ids.eat],
    ),
    createSentence(
      ids.sentenceThree,
      '我不要吃。',
      '我不要吃。',
      'wǒ bù yào chī',
      [ids.me, ids.no, ids.want, ids.eat],
      [ids.eat],
    ),
  ],
  stories: [
    {
      id: ids.story,
      title: { simplified: '吃饭时间', traditional: '吃飯時間' },
      sourceType: 'editorial',
      scriptTrack: 'simplified',
      ageBand: '5-6',
      interestTags: ['food-and-family'],
      sentenceIds: [ids.sentenceOne, ids.sentenceTwo, ids.sentenceThree],
      targetConceptIds: [ids.rice],
      comprehensionQuestions: [
        {
          id: ids.question,
          prompt: { simplified: '谁吃饭？', traditional: '誰吃飯？' },
          options: [
            { simplified: '我', traditional: '我' },
            { simplified: '小猫', traditional: '小貓' },
          ],
          correctOptionIndex: 0,
          evidenceSentenceIds: [ids.sentenceOne],
        },
      ],
      transferPrompt: {
        simplified: '吃饭时，找一找“饭”字。',
        traditional: '吃飯時，找一找「飯」字。',
      },
      knownCharacterCoverage: 0.91,
      status: 'published',
    },
  ],
  assets: [],
};
