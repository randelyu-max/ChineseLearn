import type { HumorContentPackage } from '../humor.ts';

const reviewedAt = '2026-07-23T20:55:17.680Z';
const review = {
  errorMockery: 'passed',
  etymologyAccuracy: 'passed',
  humiliation: 'passed',
  identityStereotypes: 'passed',
  learningTargetAccuracy: 'passed',
  reviewedAt,
  reviewedBy: '于永',
} as const;

export const approvedHumorContentFixture = {
  schemaVersion: 'humor-content-v1',
  contentVersion: '1.0.0',
  items: [
    {
      id: '71000000-0000-4000-8000-000000000001',
      audience: 'age_neutral_13_plus',
      authoring: 'human_editorial',
      delivery: 'bundled',
      editorialStatus: 'published',
      humorLevel: 'light',
      humorType: 'tone_wordplay',
      humorousVariant: {
        kind: 'humorous',
        correctAnswerId: 'answer.tone.ma.mother',
        correctAnswer: { simplified: '妈', traditional: '媽' },
        learningTargetDisplay: { simplified: '妈', traditional: '媽' },
        prompt: {
          simplified: '哪个字表示“妈妈”的“妈”？\n我想叫妈妈，声调说错以后，一匹马回头看了我一眼。',
          traditional:
            '哪個字表示「媽媽」的「媽」？\n我想叫媽媽，聲調說錯以後，一匹馬回頭看了我一眼。',
        },
      },
      knowledgeClaim: { kind: 'none' },
      learningTarget: {
        domain: 'pinyin',
        targetId: 'tone.ma.mother_vs_horse',
        display: { simplified: '妈', traditional: '媽' },
      },
      locale: 'zh-CN',
      neutralFallback: {
        kind: 'neutral',
        correctAnswerId: 'answer.tone.ma.mother',
        correctAnswer: { simplified: '妈', traditional: '媽' },
        learningTargetDisplay: { simplified: '妈', traditional: '媽' },
        prompt: {
          simplified: '哪个字表示“妈妈”的“妈”？\n“妈”读 mā，是第一声；“马”读 mǎ，是第三声。',
          traditional:
            '哪個字表示「媽媽」的「媽」？\n「媽」讀 mā，是第一聲；「馬」讀 mǎ，是第三聲。',
        },
      },
      safetyReview: review,
    },
    {
      id: '71000000-0000-4000-8000-000000000002',
      audience: 'age_neutral_13_plus',
      authoring: 'human_editorial',
      delivery: 'bundled',
      editorialStatus: 'published',
      humorLevel: 'light',
      humorType: 'character_dialogue',
      humorousVariant: {
        kind: 'humorous',
        correctAnswerId: 'answer.hanzi.ren',
        correctAnswer: { simplified: '人', traditional: '人' },
        learningTargetDisplay: { simplified: '人', traditional: '人' },
        prompt: {
          simplified:
            '“一个___”中应该填哪个字？\n“人”和“入”长得很像，但一个还在门外，一个已经进去了。',
          traditional:
            '「一個___」中應該填哪個字？\n「人」和「入」長得很像，但一個還在門外，一個已經進去了。',
        },
      },
      knowledgeClaim: { kind: 'none' },
      learningTarget: {
        domain: 'hanzi',
        targetId: 'hanzi.similar.ren_ru',
        display: { simplified: '人', traditional: '人' },
      },
      locale: 'zh-CN',
      neutralFallback: {
        kind: 'neutral',
        correctAnswerId: 'answer.hanzi.ren',
        correctAnswer: { simplified: '人', traditional: '人' },
        learningTargetDisplay: { simplified: '人', traditional: '人' },
        prompt: {
          simplified: '“一个___”中应该填哪个字？\n“人”表示人；“入”表示进入。这里应该选择“人”。',
          traditional:
            '「一個___」中應該填哪個字？\n「人」表示人；「入」表示進入。這裡應該選擇「人」。',
        },
      },
      safetyReview: review,
    },
    {
      id: '71000000-0000-4000-8000-000000000003',
      audience: 'age_neutral_13_plus',
      authoring: 'human_editorial',
      delivery: 'bundled',
      editorialStatus: 'published',
      humorLevel: 'light',
      humorType: 'situational',
      humorousVariant: {
        kind: 'humorous',
        correctAnswerId: 'answer.verb.chi',
        correctAnswer: { simplified: '吃', traditional: '吃' },
        learningTargetDisplay: { simplified: '吃', traditional: '吃' },
        prompt: {
          simplified: '我在___面条。\n面条刚上桌，我的筷子已经开始上班了。',
          traditional: '我在___麵條。\n麵條剛上桌，我的筷子已經開始上班了。',
        },
      },
      knowledgeClaim: { kind: 'none' },
      learningTarget: {
        domain: 'hanzi',
        targetId: 'verb.chi',
        display: { simplified: '吃', traditional: '吃' },
      },
      locale: 'zh-CN',
      neutralFallback: {
        kind: 'neutral',
        correctAnswerId: 'answer.verb.chi',
        correctAnswer: { simplified: '吃', traditional: '吃' },
        learningTargetDisplay: { simplified: '吃', traditional: '吃' },
        prompt: {
          simplified: '我在___面条。\n我在吃面条。',
          traditional: '我在___麵條。\n我在吃麵條。',
        },
      },
      safetyReview: review,
    },
    {
      id: '71000000-0000-4000-8000-000000000004',
      audience: 'age_neutral_13_plus',
      authoring: 'human_editorial',
      delivery: 'bundled',
      editorialStatus: 'published',
      humorLevel: 'light',
      humorType: 'exaggeration',
      humorousVariant: {
        kind: 'humorous',
        correctAnswerId: 'answer.food.fan',
        correctAnswer: { simplified: '饭', traditional: '飯' },
        learningTargetDisplay: { simplified: '饭', traditional: '飯' },
        prompt: {
          simplified: '我饿了，想吃___。\n我太饿了，连菜单都看起来有一点香。',
          traditional: '我餓了，想吃___。\n我太餓了，連菜單都看起來有一點香。',
        },
      },
      knowledgeClaim: { kind: 'none' },
      learningTarget: {
        domain: 'hanzi',
        targetId: 'food.fan',
        display: { simplified: '饭', traditional: '飯' },
      },
      locale: 'zh-CN',
      neutralFallback: {
        kind: 'neutral',
        correctAnswerId: 'answer.food.fan',
        correctAnswer: { simplified: '饭', traditional: '飯' },
        learningTargetDisplay: { simplified: '饭', traditional: '飯' },
        prompt: {
          simplified: '我饿了，想吃___。\n我饿了，想吃饭。',
          traditional: '我餓了，想吃___。\n我餓了，想吃飯。',
        },
      },
      safetyReview: review,
    },
    {
      id: '71000000-0000-4000-8000-000000000005',
      audience: 'age_neutral_13_plus',
      authoring: 'human_editorial',
      delivery: 'bundled',
      editorialStatus: 'published',
      humorLevel: 'light',
      humorType: 'situational',
      humorousVariant: {
        kind: 'humorous',
        correctAnswerId: 'answer.self_intro.jiao',
        correctAnswer: { simplified: '叫', traditional: '叫' },
        learningTargetDisplay: { simplified: '叫', traditional: '叫' },
        prompt: {
          simplified: '“我___小雨”中应该填哪个字？\n我叫小雨，不是天气预报里的小雨。',
          traditional: '「我___小雨」中應該填哪個字？\n我叫小雨，不是天氣預報裡的小雨。',
        },
      },
      knowledgeClaim: { kind: 'none' },
      learningTarget: {
        domain: 'hanzi',
        targetId: 'self_intro.wo_jiao',
        display: { simplified: '叫', traditional: '叫' },
      },
      locale: 'zh-CN',
      neutralFallback: {
        kind: 'neutral',
        correctAnswerId: 'answer.self_intro.jiao',
        correctAnswer: { simplified: '叫', traditional: '叫' },
        learningTargetDisplay: { simplified: '叫', traditional: '叫' },
        prompt: {
          simplified: '“我___小雨”中应该填哪个字？\n我叫小雨。这是我的名字。',
          traditional: '「我___小雨」中應該填哪個字？\n我叫小雨。這是我的名字。',
        },
      },
      safetyReview: review,
    },
    {
      id: '71000000-0000-4000-8000-000000000006',
      audience: 'age_neutral_13_plus',
      authoring: 'human_editorial',
      delivery: 'bundled',
      editorialStatus: 'published',
      humorLevel: 'playful',
      humorType: 'surprise_ending',
      humorousVariant: {
        kind: 'humorous',
        correctAnswerId: 'answer.location.office',
        correctAnswer: { simplified: '办公室', traditional: '辦公室' },
        learningTargetDisplay: { simplified: '办公室', traditional: '辦公室' },
        prompt: {
          simplified: '钥匙在哪里？\n小林下班后回家。到了门口，他发现钥匙还在办公室“加班”。',
          traditional: '鑰匙在哪裡？\n小林下班後回家。到了門口，他發現鑰匙還在辦公室「加班」。',
        },
      },
      knowledgeClaim: { kind: 'none' },
      learningTarget: {
        domain: 'hanzi',
        targetId: 'reading.location.office',
        display: { simplified: '办公室', traditional: '辦公室' },
      },
      locale: 'zh-CN',
      neutralFallback: {
        kind: 'neutral',
        correctAnswerId: 'answer.location.office',
        correctAnswer: { simplified: '办公室', traditional: '辦公室' },
        learningTargetDisplay: { simplified: '办公室', traditional: '辦公室' },
        prompt: {
          simplified: '钥匙在哪里？\n小林下班后回家。到了门口，他发现钥匙还在办公室。',
          traditional: '鑰匙在哪裡？\n小林下班後回家。到了門口，他發現鑰匙還在辦公室。',
        },
      },
      safetyReview: review,
    },
  ],
} as const satisfies HumorContentPackage;
