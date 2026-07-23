import { normalizePinyinSyllable, type PinyinTone } from '@hanziquest/contracts';

export type PinyinToAudioCandidate = Readonly<{
  assetKey: string;
  numbered: string;
  optionId: string;
}>;

export type PinyinToAudioOption = Readonly<{
  assetKey: string;
  numbered: string;
  optionId: string;
  source: 'bundled';
}>;

export type PinyinToAudioExerciseDefinition = Readonly<{
  activityId: string;
  correctOptionId: string;
  options: readonly PinyinToAudioOption[];
  prompt: Readonly<{
    accessibilityLabel: string;
    display: string;
    numbered: string;
    tone: PinyinTone;
  }>;
}>;

export type PinyinToAudioState = Readonly<{
  listenCounts: Readonly<Record<string, number>>;
  retryCount: number;
  selectedOptionId: string | null;
  status: 'awaiting-answer' | 'correct-feedback' | 'incorrect-feedback';
}>;

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

export function buildPinyinToAudioExercise(
  input: Readonly<{
    activityId: string;
    candidates: readonly PinyinToAudioCandidate[];
    seed: string;
    targetOptionId: string;
  }>,
): PinyinToAudioExerciseDefinition {
  const candidates = [
    ...new Map(input.candidates.map((candidate) => [candidate.optionId, candidate])).values(),
  ];
  if (candidates.length < 3) {
    throw new Error('Pinyin-to-audio exercises require at least 3 distinct candidates.');
  }
  if (new Set(candidates.map((candidate) => candidate.assetKey)).size !== candidates.length) {
    throw new Error('Pinyin-to-audio candidates must use distinct bundled audio assets.');
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
    throw new Error('Pinyin-to-audio candidates must use distinct Pinyin readings.');
  }
  const target = candidates.find((candidate) => candidate.optionId === input.targetOptionId);
  if (!target) throw new Error('The target audio clip must be present in candidates.');
  const normalizedTarget = normalizedByOptionId.get(target.optionId)!;

  const options = candidates
    .map((candidate) => {
      return Object.freeze({
        assetKey: candidate.assetKey,
        numbered: candidate.numbered,
        optionId: candidate.optionId,
        source: 'bundled' as const,
      });
    })
    .sort(
      (left, right) =>
        seededRank(`${input.seed}:options`, left.optionId) -
          seededRank(`${input.seed}:options`, right.optionId) ||
        left.optionId.localeCompare(right.optionId),
    );

  return Object.freeze({
    activityId: input.activityId,
    correctOptionId: target.optionId,
    options: Object.freeze(options),
    prompt: Object.freeze({
      accessibilityLabel: `${normalizedTarget.display}，${TONE_LABELS[normalizedTarget.tone]}`,
      display: normalizedTarget.display,
      numbered: normalizedTarget.numbered,
      tone: normalizedTarget.tone,
    }),
  });
}

const demoCandidates: readonly PinyinToAudioCandidate[] = [
  {
    assetKey: 'pinyin-ma2-v1',
    numbered: 'ma2',
    optionId: '53000000-0000-4000-8000-000000000001',
  },
  {
    assetKey: 'pinyin-ma3-v1',
    numbered: 'ma3',
    optionId: '53000000-0000-4000-8000-000000000002',
  },
  {
    assetKey: 'pinyin-ma4-v1',
    numbered: 'ma4',
    optionId: '53000000-0000-4000-8000-000000000003',
  },
];

export const pinyinToAudioDemoExercise = buildPinyinToAudioExercise({
  activityId: '53000000-0000-4000-8000-000000000010',
  candidates: demoCandidates,
  seed: 'pinyin-to-audio-demo-v1',
  targetOptionId: demoCandidates[0]!.optionId,
});

export function createPinyinToAudioState(): PinyinToAudioState {
  return {
    listenCounts: {},
    retryCount: 0,
    selectedOptionId: null,
    status: 'awaiting-answer',
  };
}

export function recordPinyinToAudioPlayback(
  exercise: PinyinToAudioExerciseDefinition,
  state: PinyinToAudioState,
  optionId: string,
): PinyinToAudioState {
  if (!exercise.options.some((option) => option.optionId === optionId)) {
    throw new Error('Played option does not belong to this exercise.');
  }
  if (state.status === 'correct-feedback') return state;
  return {
    ...state,
    listenCounts: {
      ...state.listenCounts,
      [optionId]: (state.listenCounts[optionId] ?? 0) + 1,
    },
  };
}

export function pinyinToAudioReplayCount(state: PinyinToAudioState, optionId: string): number {
  return Math.max(0, (state.listenCounts[optionId] ?? 0) - 1);
}

export function selectPinyinToAudioOption(
  exercise: PinyinToAudioExerciseDefinition,
  state: PinyinToAudioState,
  optionId: string,
): PinyinToAudioState {
  if (state.status !== 'awaiting-answer') return state;
  if (!exercise.options.some((option) => option.optionId === optionId)) {
    throw new Error('Selected option does not belong to this exercise.');
  }
  if ((state.listenCounts[optionId] ?? 0) === 0) {
    throw new Error('Listen to an audio option before selecting it.');
  }
  return {
    ...state,
    selectedOptionId: optionId,
    status: optionId === exercise.correctOptionId ? 'correct-feedback' : 'incorrect-feedback',
  };
}

export function retryPinyinToAudio(state: PinyinToAudioState): PinyinToAudioState {
  return state.status !== 'incorrect-feedback'
    ? state
    : {
        ...state,
        retryCount: state.retryCount + 1,
        selectedOptionId: null,
        status: 'awaiting-answer',
      };
}

export function pinyinToAudioLayout(viewportWidth: number): {
  columns: 1 | 3;
  minimumOptionHeight: 132;
} {
  return { columns: viewportWidth < 600 ? 1 : 3, minimumOptionHeight: 132 };
}
