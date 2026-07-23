import { normalizePinyinSyllable, type PinyinTone } from '@hanziquest/contracts';

export type GlyphToPinyinCandidate = Readonly<{
  numbered: string;
  optionId: string;
}>;

export type GlyphToPinyinOption = Readonly<{
  accessibilityLabel: string;
  display: string;
  numbered: string;
  optionId: string;
  tone: PinyinTone;
}>;

export type GlyphToPinyinExerciseDefinition = Readonly<{
  acceptedOptionIds: readonly string[];
  acceptedReadings: readonly string[];
  activityId: string;
  contextZh: string | null;
  hintZh: string | null;
  knownGlyphReadings: readonly string[];
  options: readonly GlyphToPinyinOption[];
  targetGlyph: string;
}>;

export type GlyphToPinyinState = Readonly<{
  hintVisible: boolean;
  retryCount: number;
  selectedOptionId: string | null;
  status: 'awaiting-answer' | 'correct-feedback' | 'incorrect-feedback';
}>;

const HAN_GLYPH_PATTERN = /^\p{Script=Han}$/u;
const TONE_LABELS: Readonly<Record<PinyinTone, string>> = {
  1: '第一声',
  2: '第二声',
  3: '第三声',
  4: '第四声',
  5: '轻声',
};

function seededRank(seed: string, value: string): number {
  let hash = 2166136261;
  for (const character of `${seed}:${value}`) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function glyphToPinyinToneLabel(tone: PinyinTone): string {
  return TONE_LABELS[tone];
}

export function buildGlyphToPinyinExercise(
  input: Readonly<{
    acceptedReadings: readonly string[];
    activityId: string;
    candidates: readonly GlyphToPinyinCandidate[];
    contextZh?: string;
    hintZh?: string;
    knownGlyphReadings: readonly string[];
    optionCount?: 3 | 4 | 5;
    seed: string;
    targetGlyph: string;
  }>,
): GlyphToPinyinExerciseDefinition {
  const optionCount = input.optionCount ?? 4;
  if (!HAN_GLYPH_PATTERN.test(input.targetGlyph)) {
    throw new Error('Glyph-to-Pinyin exercises require exactly one Han glyph.');
  }
  const candidates = [
    ...new Map(input.candidates.map((candidate) => [candidate.optionId, candidate])).values(),
  ];
  if (candidates.length < optionCount) {
    throw new Error(`Glyph-to-Pinyin exercises require at least ${optionCount} candidates.`);
  }

  const normalizedByOptionId = new Map(
    candidates.map((candidate) => {
      const normalized = normalizePinyinSyllable(candidate.numbered);
      if (!normalized) throw new Error(`Invalid Pinyin candidate: ${candidate.numbered}`);
      return [candidate.optionId, normalized] as const;
    }),
  );
  if (
    new Set([...normalizedByOptionId.values()].map((normalized) => normalized.numbered)).size !==
    candidates.length
  ) {
    throw new Error('Glyph-to-Pinyin candidates must use distinct readings.');
  }

  const normalizeReadingList = (readings: readonly string[], label: string) => {
    const normalized = readings.map((reading) => {
      const value = normalizePinyinSyllable(reading);
      if (!value) throw new Error(`Invalid ${label}: ${reading}`);
      return value.numbered;
    });
    return [...new Set(normalized)];
  };
  const acceptedReadings = normalizeReadingList(input.acceptedReadings, 'accepted reading');
  const knownGlyphReadings = normalizeReadingList(input.knownGlyphReadings, 'known glyph reading');
  if (acceptedReadings.length === 0) {
    throw new Error('At least one accepted reading must be declared explicitly.');
  }
  if (!acceptedReadings.every((reading) => knownGlyphReadings.includes(reading))) {
    throw new Error('Every accepted reading must be a declared reading of the target glyph.');
  }

  const contextZh = input.contextZh?.trim() || null;
  if (knownGlyphReadings.length > 1 && (!contextZh || !contextZh.includes(input.targetGlyph))) {
    throw new Error('Polyphonic glyph exercises require context containing the target glyph.');
  }
  const hintZh = input.hintZh?.trim() || null;

  const candidateByReading = new Map(
    [...normalizedByOptionId.entries()].map(([optionId, normalized]) => [
      normalized.numbered,
      { optionId, normalized },
    ]),
  );
  if (!acceptedReadings.every((reading) => candidateByReading.has(reading))) {
    throw new Error('Every accepted reading must have a selectable option.');
  }
  const acceptedOptionIds = acceptedReadings.map(
    (reading) => candidateByReading.get(reading)!.optionId,
  );
  if (acceptedOptionIds.length > optionCount) {
    throw new Error('The option count must include every accepted reading.');
  }

  const acceptedBases = new Set(
    acceptedReadings.map((reading) => candidateByReading.get(reading)!.normalized.base),
  );
  const alternateGlyphReadings = new Set(
    knownGlyphReadings.filter((reading) => !acceptedReadings.includes(reading)),
  );
  const distractors = [...normalizedByOptionId.entries()]
    .filter(([optionId]) => !acceptedOptionIds.includes(optionId))
    .map(([optionId, normalized]) => {
      const distance = alternateGlyphReadings.has(normalized.numbered)
        ? 0
        : acceptedBases.has(normalized.base)
          ? 1
          : acceptedReadings.some(
                (reading) => candidateByReading.get(reading)!.normalized.tone === normalized.tone,
              )
            ? 2
            : 3;
      return { distance, normalized, optionId, rank: seededRank(input.seed, optionId) };
    })
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.rank - right.rank ||
        left.optionId.localeCompare(right.optionId),
    )
    .slice(0, optionCount - acceptedOptionIds.length);

  const selectedOptionIds = [
    ...acceptedOptionIds,
    ...distractors.map((distractor) => distractor.optionId),
  ];
  const options = selectedOptionIds
    .map((optionId) => {
      const normalized = normalizedByOptionId.get(optionId)!;
      return Object.freeze({
        accessibilityLabel: `${normalized.display}，${TONE_LABELS[normalized.tone]}`,
        display: normalized.display,
        numbered: normalized.numbered,
        optionId,
        tone: normalized.tone,
      });
    })
    .sort(
      (left, right) =>
        seededRank(`${input.seed}:options`, left.optionId) -
          seededRank(`${input.seed}:options`, right.optionId) ||
        left.optionId.localeCompare(right.optionId),
    );

  return Object.freeze({
    acceptedOptionIds: Object.freeze(acceptedOptionIds),
    acceptedReadings: Object.freeze(acceptedReadings),
    activityId: input.activityId,
    contextZh,
    hintZh,
    knownGlyphReadings: Object.freeze(knownGlyphReadings),
    options: Object.freeze(options),
    targetGlyph: input.targetGlyph,
  });
}

const demoCandidates: readonly GlyphToPinyinCandidate[] = [
  { numbered: 'hang2', optionId: '55000000-0000-4000-8000-000000000001' },
  { numbered: 'xing2', optionId: '55000000-0000-4000-8000-000000000002' },
  { numbered: 'hang4', optionId: '55000000-0000-4000-8000-000000000003' },
  { numbered: 'hen3', optionId: '55000000-0000-4000-8000-000000000004' },
  { numbered: 'xin4', optionId: '55000000-0000-4000-8000-000000000005' },
];

export const glyphToPinyinDemoExercise = buildGlyphToPinyinExercise({
  acceptedReadings: ['hang2'],
  activityId: '55000000-0000-4000-8000-000000000010',
  candidates: demoCandidates,
  contextZh: '银行',
  hintZh: '这里说的是和钱有关的机构。',
  knownGlyphReadings: ['xing2', 'hang2'],
  seed: 'glyph-to-pinyin-demo-v1',
  targetGlyph: '行',
});

export function createGlyphToPinyinState(): GlyphToPinyinState {
  return {
    hintVisible: false,
    retryCount: 0,
    selectedOptionId: null,
    status: 'awaiting-answer',
  };
}

export function requestGlyphToPinyinHint(state: GlyphToPinyinState): GlyphToPinyinState {
  return state.status === 'correct-feedback' ? state : { ...state, hintVisible: true };
}

export function selectGlyphToPinyinOption(
  exercise: GlyphToPinyinExerciseDefinition,
  state: GlyphToPinyinState,
  optionId: string,
): GlyphToPinyinState {
  if (state.status !== 'awaiting-answer') return state;
  if (!exercise.options.some((option) => option.optionId === optionId)) {
    throw new Error('Selected option does not belong to this exercise.');
  }
  return {
    ...state,
    hintVisible: state.hintVisible || !exercise.acceptedOptionIds.includes(optionId),
    selectedOptionId: optionId,
    status: exercise.acceptedOptionIds.includes(optionId)
      ? 'correct-feedback'
      : 'incorrect-feedback',
  };
}

export function retryGlyphToPinyin(state: GlyphToPinyinState): GlyphToPinyinState {
  return state.status !== 'incorrect-feedback'
    ? state
    : {
        ...state,
        retryCount: state.retryCount + 1,
        selectedOptionId: null,
        status: 'awaiting-answer',
      };
}

export function glyphToPinyinLayout(viewportWidth: number): {
  columns: 1 | 2;
  minimumOptionHeight: 88;
} {
  return { columns: viewportWidth < 360 ? 1 : 2, minimumOptionHeight: 88 };
}
