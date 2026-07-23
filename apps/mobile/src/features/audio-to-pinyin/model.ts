import { normalizePinyinSyllable, type PinyinTone } from '@hanziquest/contracts';

export type PinyinChoiceCandidate = Readonly<{
  numbered: string;
  syllableId: string;
}>;

export type AudioToPinyinOption = Readonly<{
  accessibilityLabel: string;
  display: string;
  numbered: string;
  optionId: string;
  tone: PinyinTone;
}>;

export type AudioToPinyinExerciseDefinition = Readonly<{
  activityId: string;
  audioAsset: Readonly<{
    assetKey: string;
    source: 'bundled';
  }>;
  correctOptionId: string;
  options: readonly AudioToPinyinOption[];
  targetSyllableId: string;
}>;

export type AudioToPinyinState = Readonly<{
  playCount: number;
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

function optionFromCandidate(candidate: PinyinChoiceCandidate): AudioToPinyinOption {
  const normalized = normalizePinyinSyllable(candidate.numbered);
  if (!normalized) throw new Error(`Invalid Pinyin candidate: ${candidate.numbered}`);
  return Object.freeze({
    accessibilityLabel: `${normalized.display}，${TONE_LABELS[normalized.tone]}`,
    display: normalized.display,
    numbered: normalized.numbered,
    optionId: candidate.syllableId,
    tone: normalized.tone,
  });
}

function distractorDistance(
  target: ReturnType<typeof normalizePinyinSyllable> & object,
  candidate: ReturnType<typeof normalizePinyinSyllable> & object,
): number {
  if (candidate.base === target.base) return 0;
  if (candidate.initial === target.initial || candidate.final === target.final) return 1;
  if (candidate.tone === target.tone) return 2;
  return 3;
}

export function pinyinToneLabel(tone: PinyinTone): string {
  return TONE_LABELS[tone];
}

export function buildAudioToPinyinExercise(
  input: Readonly<{
    activityId: string;
    audioAssetKey: string;
    candidates: readonly PinyinChoiceCandidate[];
    optionCount?: 2 | 3 | 4;
    seed: string;
    targetSyllableId: string;
  }>,
): AudioToPinyinExerciseDefinition {
  const optionCount = input.optionCount ?? 4;
  const deduplicated = [
    ...new Map(input.candidates.map((candidate) => [candidate.syllableId, candidate])).values(),
  ];
  const target = deduplicated.find((candidate) => candidate.syllableId === input.targetSyllableId);
  if (!target) throw new Error('The target Pinyin syllable must be present in candidates.');
  const normalizedTarget = normalizePinyinSyllable(target.numbered);
  if (!normalizedTarget) throw new Error(`Invalid target Pinyin syllable: ${target.numbered}`);
  if (deduplicated.length < optionCount) {
    throw new Error(`Audio-to-Pinyin exercises require at least ${optionCount} candidates.`);
  }

  const distractors = deduplicated
    .filter((candidate) => candidate.syllableId !== input.targetSyllableId)
    .map((candidate) => {
      const normalized = normalizePinyinSyllable(candidate.numbered);
      if (!normalized) throw new Error(`Invalid Pinyin candidate: ${candidate.numbered}`);
      return {
        candidate,
        distance: distractorDistance(normalizedTarget, normalized),
        rank: seededRank(input.seed, candidate.syllableId),
      };
    })
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.rank - right.rank ||
        left.candidate.syllableId.localeCompare(right.candidate.syllableId),
    )
    .slice(0, optionCount - 1)
    .map(({ candidate }) => candidate);

  const options = [target, ...distractors]
    .map(optionFromCandidate)
    .sort(
      (left, right) =>
        seededRank(`${input.seed}:options`, left.optionId) -
          seededRank(`${input.seed}:options`, right.optionId) ||
        left.optionId.localeCompare(right.optionId),
    );
  return Object.freeze({
    activityId: input.activityId,
    audioAsset: Object.freeze({ assetKey: input.audioAssetKey, source: 'bundled' as const }),
    correctOptionId: input.targetSyllableId,
    options: Object.freeze(options),
    targetSyllableId: input.targetSyllableId,
  });
}

const demoCandidates: readonly PinyinChoiceCandidate[] = [
  { syllableId: '52000000-0000-4000-8000-000000000001', numbered: 'ma3' },
  { syllableId: '52000000-0000-4000-8000-000000000002', numbered: 'ma1' },
  { syllableId: '52000000-0000-4000-8000-000000000003', numbered: 'ma2' },
  { syllableId: '52000000-0000-4000-8000-000000000004', numbered: 'ma4' },
  { syllableId: '52000000-0000-4000-8000-000000000005', numbered: 'ma5' },
];

export const audioToPinyinDemoExercise = buildAudioToPinyinExercise({
  activityId: '52000000-0000-4000-8000-000000000010',
  audioAssetKey: 'pinyin-ma3-v1',
  candidates: demoCandidates,
  seed: 'audio-to-pinyin-demo-v1',
  targetSyllableId: demoCandidates[0]!.syllableId,
});

export function createAudioToPinyinState(): AudioToPinyinState {
  return {
    playCount: 0,
    retryCount: 0,
    selectedOptionId: null,
    status: 'awaiting-answer',
  };
}

export function recordAudioToPinyinPlayback(state: AudioToPinyinState): AudioToPinyinState {
  return state.status === 'correct-feedback' ? state : { ...state, playCount: state.playCount + 1 };
}

export function audioToPinyinReplayCount(state: AudioToPinyinState): number {
  return Math.max(0, state.playCount - 1);
}

export function selectAudioToPinyinOption(
  exercise: AudioToPinyinExerciseDefinition,
  state: AudioToPinyinState,
  optionId: string,
): AudioToPinyinState {
  if (state.status !== 'awaiting-answer') return state;
  if (!exercise.options.some((option) => option.optionId === optionId)) {
    throw new Error('Selected option does not belong to this exercise.');
  }
  return {
    ...state,
    selectedOptionId: optionId,
    status: optionId === exercise.correctOptionId ? 'correct-feedback' : 'incorrect-feedback',
  };
}

export function retryAudioToPinyin(state: AudioToPinyinState): AudioToPinyinState {
  return state.status !== 'incorrect-feedback'
    ? state
    : {
        ...state,
        retryCount: state.retryCount + 1,
        selectedOptionId: null,
        status: 'awaiting-answer',
      };
}

export function audioToPinyinLayout(viewportWidth: number): {
  columns: 1 | 2;
  minimumOptionHeight: 88;
} {
  return { columns: viewportWidth < 360 ? 1 : 2, minimumOptionHeight: 88 };
}
