import {
  AttemptDraftSchema,
  type AttemptDraft,
  type HintLevel,
  type SentenceOrderExercise,
} from '@hanziquest/contracts';

export type SentenceOrderState = Readonly<{
  status: 'building' | 'incorrect-feedback' | 'correct-feedback';
  selectedTileIds: readonly string[];
  hintLevel: HintLevel;
  replayCount: number;
  retryCount: number;
  activeStartedAtMs: number | null;
  accumulatedResponseMs: number;
}>;

export type SentenceOrderAttemptContext = {
  attemptId: () => string;
  nowIso: () => string;
  nowMs: () => number;
  offlineSequence: number;
};

const tileIds = {
  me: '00000000-0000-4000-8000-000000000041',
  want: '00000000-0000-4000-8000-000000000042',
  eatRice: '00000000-0000-4000-8000-000000000043',
  stop: '00000000-0000-4000-8000-000000000044',
} as const;

export const sentenceOrderDemoExercise: SentenceOrderExercise = {
  activityId: '00000000-0000-4000-8000-000000000045',
  type: 'sentence_order',
  promptZh: '把词语排成一句话。',
  promptAudioAssetId: '00000000-0000-4000-8000-000000000046',
  targetConceptIds: ['00000000-0000-4000-8000-000000000047'],
  targetSentence: '我要吃饭。',
  tiles: [
    { tileId: tileIds.eatRice, text: '吃饭', accessibilityLabel: '词语：吃饭' },
    { tileId: tileIds.me, text: '我', accessibilityLabel: '词语：我' },
    { tileId: tileIds.stop, text: '。', accessibilityLabel: '句号' },
    { tileId: tileIds.want, text: '要', accessibilityLabel: '词语：要' },
  ],
  correctTileOrder: [tileIds.me, tileIds.want, tileIds.eatRice, tileIds.stop],
  visualHintZh: '一句话通常先说“谁”，再说想做什么。',
};

export function createSentenceOrderState(startedAtMs = 0): SentenceOrderState {
  return {
    status: 'building',
    selectedTileIds: [],
    hintLevel: 'none',
    replayCount: 0,
    retryCount: 0,
    activeStartedAtMs: startedAtMs,
    accumulatedResponseMs: 0,
  };
}

export function sentenceOrderLayout(viewportWidth: number): {
  compact: boolean;
  minimumTileHeight: 56;
} {
  return { compact: viewportWidth < 360, minimumTileHeight: 56 };
}

export function toggleSentenceTile(
  exercise: SentenceOrderExercise,
  state: SentenceOrderState,
  tileId: string,
): SentenceOrderState {
  if (state.status !== 'building') return state;
  if (!exercise.tiles.some((tile) => tile.tileId === tileId))
    throw new Error('Unknown sentence tile.');
  return {
    ...state,
    selectedTileIds: state.selectedTileIds.includes(tileId)
      ? state.selectedTileIds.filter((selectedId) => selectedId !== tileId)
      : [...state.selectedTileIds, tileId],
  };
}

export function recordSentenceReplay(state: SentenceOrderState): SentenceOrderState {
  if (state.status === 'correct-feedback') return state;
  return {
    ...state,
    replayCount: state.replayCount + 1,
    hintLevel: state.hintLevel === 'none' ? 'audio_repeat' : state.hintLevel,
  };
}

export function requestSentenceOrderHint(state: SentenceOrderState): SentenceOrderState {
  return state.status === 'correct-feedback' ? state : { ...state, hintLevel: 'visual_hint' };
}

export function retrySentenceOrder(
  state: SentenceOrderState,
  startedAtMs: number,
): SentenceOrderState {
  return state.status !== 'incorrect-feedback'
    ? state
    : { ...state, status: 'building', selectedTileIds: [], activeStartedAtMs: startedAtMs };
}

export function submitSentenceOrder(
  exercise: SentenceOrderExercise,
  state: SentenceOrderState,
  context: SentenceOrderAttemptContext,
): { state: SentenceOrderState; attempt: AttemptDraft | null } {
  if (state.status !== 'building' || state.selectedTileIds.length !== exercise.tiles.length) {
    return { state, attempt: null };
  }
  const nowMs = context.nowMs();
  const responseMs =
    state.accumulatedResponseMs +
    (state.activeStartedAtMs === null ? 0 : Math.max(0, nowMs - state.activeStartedAtMs));
  const correct = state.selectedTileIds.every(
    (tileId, index) => tileId === exercise.correctTileOrder[index],
  );
  if (!correct) {
    return {
      state: {
        ...state,
        status: 'incorrect-feedback',
        hintLevel: 'visual_hint',
        retryCount: state.retryCount + 1,
        activeStartedAtMs: null,
        accumulatedResponseMs: responseMs,
      },
      attempt: null,
    };
  }
  const attempt = AttemptDraftSchema.parse({
    attemptId: context.attemptId(),
    activityId: exercise.activityId,
    answer: { tileIds: state.selectedTileIds },
    isCorrectClient: true,
    responseMs: Math.round(responseMs),
    hintLevel: state.hintLevel,
    replayCount: state.replayCount,
    retryCount: state.retryCount,
    occurredAt: context.nowIso(),
    offlineSequence: context.offlineSequence,
  });
  return {
    state: {
      ...state,
      status: 'correct-feedback',
      activeStartedAtMs: null,
      accumulatedResponseMs: responseMs,
    },
    attempt,
  };
}
