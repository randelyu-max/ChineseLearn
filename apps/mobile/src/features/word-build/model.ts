import {
  AttemptDraftSchema,
  type AttemptDraft,
  type HintLevel,
  type WordBuildExercise,
} from '@hanziquest/contracts';

export type WordBuildState = Readonly<{
  status: 'building' | 'incorrect-feedback' | 'correct-feedback';
  selectedTileIds: readonly string[];
  hintLevel: HintLevel;
  replayCount: number;
  retryCount: number;
  activeStartedAtMs: number | null;
  accumulatedResponseMs: number;
}>;

export type WordBuildAttemptContext = {
  attemptId: () => string;
  nowIso: () => string;
  nowMs: () => number;
  offlineSequence: number;
};

const eatTile = '00000000-0000-4000-8000-000000000031';
const riceTile = '00000000-0000-4000-8000-000000000032';

export const wordBuildDemoExercise: WordBuildExercise = {
  activityId: '00000000-0000-4000-8000-000000000033',
  type: 'word_build',
  promptZh: '把字排成“吃饭”。',
  promptAudioAssetId: '00000000-0000-4000-8000-000000000034',
  targetConceptIds: ['00000000-0000-4000-8000-000000000035'],
  targetWord: '吃饭',
  tiles: [
    { tileId: riceTile, glyph: '饭', accessibilityLabel: '饭字，点击加入答案' },
    { tileId: eatTile, glyph: '吃', accessibilityLabel: '吃字，点击加入答案' },
  ],
  correctTileOrder: [eatTile, riceTile],
  visualHintZh: '先找表示动作的“吃”，再放“饭”。',
};

export function createWordBuildState(startedAtMs = 0): WordBuildState {
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

export function wordBuildLayout(viewportWidth: number): { answerMinHeight: 72; compact: boolean } {
  return { answerMinHeight: 72, compact: viewportWidth < 360 };
}

export function toggleWordBuildTile(
  exercise: WordBuildExercise,
  state: WordBuildState,
  tileId: string,
): WordBuildState {
  if (state.status !== 'building') return state;
  if (!exercise.tiles.some((tile) => tile.tileId === tileId))
    throw new Error('Unknown word-build tile.');
  const index = state.selectedTileIds.indexOf(tileId);
  return {
    ...state,
    selectedTileIds:
      index >= 0
        ? state.selectedTileIds.filter((selectedId) => selectedId !== tileId)
        : [...state.selectedTileIds, tileId],
  };
}

export function recordWordBuildReplay(state: WordBuildState): WordBuildState {
  if (state.status === 'correct-feedback') return state;
  return {
    ...state,
    replayCount: state.replayCount + 1,
    hintLevel: state.hintLevel === 'none' ? 'audio_repeat' : state.hintLevel,
  };
}

export function requestWordBuildHint(state: WordBuildState): WordBuildState {
  return state.status === 'correct-feedback' ? state : { ...state, hintLevel: 'visual_hint' };
}

export function retryWordBuild(state: WordBuildState, startedAtMs: number): WordBuildState {
  return state.status !== 'incorrect-feedback'
    ? state
    : { ...state, status: 'building', selectedTileIds: [], activeStartedAtMs: startedAtMs };
}

export function submitWordBuild(
  exercise: WordBuildExercise,
  state: WordBuildState,
  context: WordBuildAttemptContext,
): { state: WordBuildState; attempt: AttemptDraft | null } {
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
