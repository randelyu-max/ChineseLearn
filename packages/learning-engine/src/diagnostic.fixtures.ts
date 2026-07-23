import {
  diagnosticAxes,
  type DiagnosticAxis,
  type DiagnosticItem,
  type DiagnosticLevel,
  type DiagnosticPresentation,
} from './diagnostic.ts';

const presentationByAxis: Readonly<Record<DiagnosticAxis, DiagnosticPresentation>> = Object.freeze({
  spoken_audio_comprehension: 'audio_choice',
  pinyin_recognition: 'pinyin_choice',
  tone_discrimination: 'audio_tone_choice',
  hanzi_recognition: 'hanzi_choice',
  word_reading: 'word_reading',
  sentence_reading: 'sentence_reading',
});

export const diagnosticFixtureItems: readonly DiagnosticItem[] = Object.freeze(
  diagnosticAxes.flatMap((axis) =>
    ([0, 1, 2, 3, 4] as const).flatMap((level) =>
      ([1, 2] as const).map((variant) =>
        Object.freeze({
          axis,
          id: `${axis}-${level}-${variant}`,
          level,
          presentation: presentationByAxis[axis],
        }),
      ),
    ),
  ),
);

export type DiagnosticProfileFixture = Readonly<{
  id: string;
  maximumCorrectLevel: Readonly<Record<DiagnosticAxis, DiagnosticLevel>>;
}>;

function profile(
  id: string,
  levels: Readonly<Record<DiagnosticAxis, DiagnosticLevel>>,
): DiagnosticProfileFixture {
  return Object.freeze({ id, maximumCorrectLevel: Object.freeze(levels) });
}

export const diagnosticProfileFixtures = Object.freeze({
  beginner: profile('beginner', {
    spoken_audio_comprehension: 0,
    pinyin_recognition: 0,
    tone_discrimination: 0,
    hanzi_recognition: 0,
    word_reading: 0,
    sentence_reading: 0,
  }),
  hanziReadingAdvanced: profile('hanzi-reading-advanced', {
    spoken_audio_comprehension: 4,
    pinyin_recognition: 3,
    tone_discrimination: 3,
    hanzi_recognition: 4,
    word_reading: 4,
    sentence_reading: 4,
  }),
  pinyinAdvancedHanziDeveloping: profile('pinyin-advanced-hanzi-developing', {
    spoken_audio_comprehension: 3,
    pinyin_recognition: 4,
    tone_discrimination: 4,
    hanzi_recognition: 2,
    word_reading: 2,
    sentence_reading: 1,
  }),
  spokenAdvancedPinyinAdvancedHanziStarting: profile(
    'spoken-advanced-pinyin-advanced-hanzi-starting',
    {
      spoken_audio_comprehension: 4,
      pinyin_recognition: 4,
      tone_discrimination: 3,
      hanzi_recognition: 0,
      word_reading: 0,
      sentence_reading: 0,
    },
  ),
  spokenAdvancedPinyinStartingHanziStarting: profile(
    'spoken-advanced-pinyin-starting-hanzi-starting',
    {
      spoken_audio_comprehension: 4,
      pinyin_recognition: 0,
      tone_discrimination: 1,
      hanzi_recognition: 0,
      word_reading: 0,
      sentence_reading: 0,
    },
  ),
} satisfies Record<string, DiagnosticProfileFixture>);

export const diagnosticStopFixtures = Object.freeze({
  consecutiveErrors: Object.freeze({
    config: Object.freeze({ consecutiveErrorLimit: 3 }),
    id: 'consecutive-errors',
  }),
  itemLimit: Object.freeze({
    config: Object.freeze({ consecutiveErrorLimit: 99, maxItems: 5 }),
    id: 'item-limit',
  }),
  timeLimit: Object.freeze({
    config: Object.freeze({ consecutiveErrorLimit: 99, maxDurationMs: 5_000 }),
    id: 'time-limit',
  }),
});

export function fixtureAnswer(fixture: DiagnosticProfileFixture, item: DiagnosticItem): boolean {
  return item.level <= fixture.maximumCorrectLevel[item.axis];
}
