import { DIAGNOSTIC_CONTENT_VERSION } from '@hanziquest/contracts';
import { type DiagnosticAxis, type DiagnosticItem } from '@hanziquest/learning-engine';

export type DiagnosticContentItem = Readonly<{
  item: DiagnosticItem;
  prompt: string;
  speechText: string | null;
  options: readonly Readonly<{ id: 'a' | 'b'; label: string }>[];
  correctOptionId: 'a' | 'b';
}>;

const samples: Readonly<Record<DiagnosticAxis, readonly [string, string, string | null][]>> = {
  spoken_audio_comprehension: [
    ['听一听，选择你听到的内容', '你好 / 再见', '你好'],
    ['听一听，选择你听到的内容', '谢谢 / 对不起', '谢谢'],
    ['听一听，选择你听到的内容', '我喜欢喝茶 / 我喜欢咖啡', '我喜欢喝茶'],
    ['听一听，选择你听到的内容', '明天下午见 / 今天上午见', '明天下午见'],
    [
      '听一听，选择你听到的内容',
      '虽然下雨，但是我还是出门了 / 因为下雨，所以我没出门',
      '虽然下雨，但是我还是出门了',
    ],
    [
      '听一听，选择你听到的内容',
      '这件事让我重新考虑原来的计划 / 这个计划从来没有改变',
      '这件事让我重新考虑原来的计划',
    ],
  ],
  pinyin_recognition: [
    ['选择“妈”的拼音', 'mā / má', null],
    ['选择“好”的拼音', 'hǎo / hào', null],
    ['选择“学”的拼音', 'xué / xuě', null],
    ['选择“朋友”的拼音', 'péng you / pèn you', null],
    ['选择“了解”的拼音', 'liǎo jiě / liào jié', null],
    ['选择“环境”的拼音', 'huán jìng / huáng jìn', null],
  ],
  tone_discrimination: [
    ['听一听，选择声调', 'mā / má', '妈'],
    ['听一听，选择声调', 'mǎ / mà', '马'],
    ['听一听，选择声调', 'shū / shù', '书'],
    ['听一听，选择声调', 'míng / mǐng', '明'],
    ['听一听，选择声调', 'qíng / qìng', '情'],
    ['听一听，选择声调', 'jiě / jiè', '解'],
  ],
  hanzi_recognition: [
    ['选择与拼音 shuǐ 对应的汉字', '水 / 木', null],
    ['选择与拼音 rén 对应的汉字', '人 / 入', null],
    ['选择与拼音 xué 对应的汉字', '学 / 字', null],
    ['选择与拼音 jiā 对应的汉字', '家 / 室', null],
    ['选择与拼音 huán jìng 对应的词', '环境 / 情况', null],
    ['选择与拼音 jī huì 对应的词', '机会 / 机器', null],
  ],
  word_reading: [
    ['选择“今天”的读音', 'jīn tiān / jīng tián', null],
    ['选择“朋友”的读音', 'péng you / píng yǒu', null],
    ['选择“工作”的读音', 'gōng zuò / gǒng zhuō', null],
    ['选择“已经”的读音', 'yǐ jīng / yì jìn', null],
    ['选择“参加”的读音', 'cān jiā / chān jiǎ', null],
    ['选择“理解”的读音', 'lǐ jiě / lì jiè', null],
  ],
  sentence_reading: [
    ['选择“我今天很忙”的读音', 'wǒ jīn tiān hěn máng / wǒ jīng tián hèn māng', null],
    ['选择“你什么时候到”的读音', 'nǐ shén me shí hou dào / nǐ shēn me sì hòu dāo', null],
    ['选择“我们一起吃饭吧”的读音', 'wǒ men yì qǐ chī fàn ba / wǒ mén yī qì cī fǎn bā', null],
    ['选择“这本书很有意思”的读音', 'zhè běn shū hěn yǒu yì si / zè běng sū hèn yòu yí shì', null],
    [
      '选择“如果有时间，我会参加”的读音',
      'rú guǒ yǒu shí jiān, wǒ huì cān jiā / rù guó yòu sí jiǎn, wǒ huí chān jiǎ',
      null,
    ],
    [
      '选择“虽然有点困难，但是值得尝试”的读音',
      'suī rán yǒu diǎn kùn nan, dàn shì zhí de cháng shì / shuì rǎn yòu tiān kūn nán, tán sì zí de cāng sì',
      null,
    ],
  ],
};

const presentationByAxis = {
  spoken_audio_comprehension: 'audio_choice',
  pinyin_recognition: 'pinyin_choice',
  tone_discrimination: 'audio_tone_choice',
  hanzi_recognition: 'hanzi_choice',
  word_reading: 'word_reading',
  sentence_reading: 'sentence_reading',
} as const;

export const diagnosticContentItems: readonly DiagnosticContentItem[] = Object.freeze(
  Object.entries(samples).flatMap(([axis, axisSamples]) =>
    axisSamples.map(([prompt, choices, speechText], index) => {
      const [correct, distractor] = choices.split(' / ');
      const correctOptionId = index % 2 === 0 ? ('a' as const) : ('b' as const);
      return Object.freeze({
        item: Object.freeze({
          axis: axis as DiagnosticAxis,
          id: `${DIAGNOSTIC_CONTENT_VERSION}.${axis}.${index}`,
          level: Math.min(index, 4) as 0 | 1 | 2 | 3 | 4,
          presentation: presentationByAxis[axis as DiagnosticAxis],
        }),
        prompt,
        speechText,
        options: Object.freeze([
          Object.freeze({
            id: 'a' as const,
            label: correctOptionId === 'a' ? correct! : distractor!,
          }),
          Object.freeze({
            id: 'b' as const,
            label: correctOptionId === 'b' ? correct! : distractor!,
          }),
        ]),
        correctOptionId,
      });
    }),
  ),
);
