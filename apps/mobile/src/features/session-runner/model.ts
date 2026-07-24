import {
  AttemptDraftV2Schema,
  isLegalPinyinCombination,
  type AttemptAnswerV2,
  type AttemptDraftV2,
  type HintLevel,
  type LearningExerciseV2,
} from '@hanziquest/contracts';

import {
  FormalSessionCacheRecordSchema,
  type FormalSessionCacheRecord,
} from '../offline-storage/model';

export const FORMAL_SESSION_RUNNER_VERSION = 'formal-session-runner-v2' as const;

export type SupportedFormalExercise = Extract<
  LearningExerciseV2,
  {
    type:
      | 'audio_to_glyph'
      | 'glyph_to_image'
      | 'word_build'
      | 'sentence_order'
      | 'audio_to_pinyin'
      | 'pinyin_to_audio'
      | 'pinyin_to_glyph'
      | 'glyph_to_pinyin'
      | 'tone_choice'
      | 'pinyin_syllable_build';
  }
>;

export type RunnerPhase =
  | 'ready'
  | 'answering'
  | 'feedback'
  | 'persisting_attempt'
  | 'sync_pending'
  | 'completing_session'
  | 'completed'
  | 'fatal_content_error';

export type RunnerActivityState = Readonly<{
  accumulatedResponseMs: number;
  activeStartedAtMs: number | null;
  audioPlayCounts: Readonly<Record<string, number>>;
  hintLevel: HintLevel;
  localCorrect: boolean | null;
  pinyinRevealed: boolean;
  replayCount: number;
  retryCount: number;
  selectedOptionId: string | null;
  selectedTileIds: readonly string[];
}>;

export type FormalSessionRunnerState = Readonly<{
  schemaVersion: typeof FORMAL_SESSION_RUNNER_VERSION;
  sessionId: string;
  activityIndex: number;
  activityState: RunnerActivityState;
  completedActivityIds: readonly string[];
  phase: RunnerPhase;
  pendingAttemptId: string | null;
}>;

export type RunnerAttemptContext = Readonly<{
  attemptId: () => string;
  nowIso: () => string;
  nowMs: () => number;
  offlineSequence: number;
}>;

function freshActivityState(startedAtMs: number | null): RunnerActivityState {
  return {
    accumulatedResponseMs: 0,
    activeStartedAtMs: startedAtMs,
    audioPlayCounts: {},
    hintLevel: 'none',
    localCorrect: null,
    pinyinRevealed: false,
    replayCount: 0,
    retryCount: 0,
    selectedOptionId: null,
    selectedTileIds: [],
  };
}

export function isSupportedFormalExercise(
  exercise: LearningExerciseV2,
): exercise is SupportedFormalExercise {
  return [
    'audio_to_glyph',
    'glyph_to_image',
    'word_build',
    'sentence_order',
    'audio_to_pinyin',
    'pinyin_to_audio',
    'pinyin_to_glyph',
    'glyph_to_pinyin',
    'tone_choice',
    'pinyin_syllable_build',
  ].includes(exercise.type);
}

export function createFormalSessionRunnerState(
  input: FormalSessionCacheRecord,
): FormalSessionRunnerState {
  const session = FormalSessionCacheRecordSchema.parse(input);
  if (session.activities.some((activity) => !isSupportedFormalExercise(activity.exercise))) {
    return {
      schemaVersion: FORMAL_SESSION_RUNNER_VERSION,
      sessionId: session.sessionId,
      activityIndex: 0,
      activityState: freshActivityState(null),
      completedActivityIds: session.completedActivityIds,
      phase: 'fatal_content_error',
      pendingAttemptId: null,
    };
  }
  const firstIncomplete = session.activities.findIndex(
    (activity) => !session.completedActivityIds.includes(activity.sessionActivityId),
  );
  const allCompleted = firstIncomplete === -1;
  return {
    schemaVersion: FORMAL_SESSION_RUNNER_VERSION,
    sessionId: session.sessionId,
    activityIndex: allCompleted ? session.activities.length - 1 : firstIncomplete,
    activityState: freshActivityState(null),
    completedActivityIds: session.completedActivityIds,
    phase: allCompleted ? 'completing_session' : 'ready',
    pendingAttemptId: null,
  };
}

export function startRunnerActivity(
  state: FormalSessionRunnerState,
  startedAtMs: number,
): FormalSessionRunnerState {
  return state.phase !== 'ready'
    ? state
    : {
        ...state,
        activityState: freshActivityState(startedAtMs),
        phase: 'answering',
      };
}

export function currentRunnerExercise(
  session: FormalSessionCacheRecord,
  state: FormalSessionRunnerState,
): SupportedFormalExercise {
  const activity = session.activities[state.activityIndex];
  if (!activity || !isSupportedFormalExercise(activity.exercise)) {
    throw new Error('The current Session Activity is not supported by the formal Runner.');
  }
  return activity.exercise;
}

export function toggleRunnerTile(
  session: FormalSessionCacheRecord,
  state: FormalSessionRunnerState,
  tileId: string,
): FormalSessionRunnerState {
  if (state.phase !== 'answering') return state;
  const exercise = currentRunnerExercise(session, state);
  if (exercise.type !== 'word_build' && exercise.type !== 'sentence_order') return state;
  if (!exercise.tiles.some((tile) => tile.tileId === tileId)) {
    throw new Error('The selected tile does not belong to this exercise.');
  }
  const selected = state.activityState.selectedTileIds;
  return {
    ...state,
    activityState: {
      ...state.activityState,
      selectedTileIds: selected.includes(tileId)
        ? selected.filter((selectedId) => selectedId !== tileId)
        : [...selected, tileId],
    },
  };
}

export function selectRunnerPinyinBuildOption(
  session: FormalSessionCacheRecord,
  state: FormalSessionRunnerState,
  step: 'final' | 'initial' | 'tone',
  optionId: string,
): FormalSessionRunnerState {
  if (state.phase !== 'answering') return state;
  const exercise = currentRunnerExercise(session, state);
  if (exercise.type !== 'pinyin_syllable_build') return state;
  const selected = state.activityState.selectedTileIds;
  const expectedLength = step === 'initial' ? 0 : step === 'final' ? 1 : 2;
  if (selected.length !== expectedLength) return state;
  const optionExists =
    step === 'initial'
      ? exercise.initialOptions.some((candidate) => candidate.optionId === optionId)
      : step === 'final'
        ? exercise.finalOptions.some((candidate) => candidate.optionId === optionId)
        : exercise.toneOptions.some((candidate) => candidate.optionId === optionId);
  if (!optionExists) throw new Error('The selected Pinyin part does not belong to this exercise.');
  if (step === 'final') {
    const selectedInitial = exercise.initialOptions.find(
      (candidate) => candidate.optionId === selected[0],
    );
    const selectedFinal = exercise.finalOptions.find(
      (candidate) => candidate.optionId === optionId,
    );
    if (
      !selectedInitial ||
      !selectedFinal ||
      !isLegalPinyinCombination(selectedInitial.value, selectedFinal.value)
    ) {
      throw new Error('The selected initial and final are not a legal Pinyin combination.');
    }
  }
  return {
    ...state,
    activityState: {
      ...state.activityState,
      selectedTileIds: [...selected, optionId],
    },
  };
}

export function resetRunnerSelection(state: FormalSessionRunnerState): FormalSessionRunnerState {
  if (state.phase !== 'answering') return state;
  return {
    ...state,
    activityState: {
      ...state.activityState,
      selectedOptionId: null,
      selectedTileIds: [],
    },
  };
}

export function recordRunnerAudioPlayback(
  state: FormalSessionRunnerState,
  audioAssetKey: string,
): FormalSessionRunnerState {
  if (state.phase !== 'answering') return state;
  const previousCount = state.activityState.audioPlayCounts[audioAssetKey] ?? 0;
  return {
    ...state,
    activityState: {
      ...state.activityState,
      audioPlayCounts: {
        ...state.activityState.audioPlayCounts,
        [audioAssetKey]: previousCount + 1,
      },
      hintLevel:
        previousCount > 0 && state.activityState.hintLevel === 'none'
          ? 'audio_repeat'
          : state.activityState.hintLevel,
      replayCount: state.activityState.replayCount + (previousCount > 0 ? 1 : 0),
    },
  };
}

export function requestRunnerHint(state: FormalSessionRunnerState): FormalSessionRunnerState {
  return state.phase !== 'answering'
    ? state
    : {
        ...state,
        activityState: { ...state.activityState, hintLevel: 'visual_hint' },
      };
}

export function revealRunnerPinyin(
  session: FormalSessionCacheRecord,
  state: FormalSessionRunnerState,
): FormalSessionRunnerState {
  if (state.phase !== 'answering') return state;
  const support = session.activities[state.activityIndex]?.pinyinSupport;
  if (!support?.allowReveal || support.presentation !== 'tap_to_reveal') return state;
  return {
    ...state,
    activityState: { ...state.activityState, pinyinRevealed: true },
  };
}

function localScore(exercise: SupportedFormalExercise, answer: AttemptAnswerV2): boolean {
  if ('optionId' in answer) {
    if (
      exercise.type === 'word_build' ||
      exercise.type === 'sentence_order' ||
      exercise.type === 'pinyin_syllable_build'
    ) {
      throw new Error('An option answer cannot score an ordering exercise.');
    }
    if (!exercise.options.some((option) => option.optionId === answer.optionId)) {
      throw new Error('The selected option does not belong to this exercise.');
    }
    if (exercise.type === 'glyph_to_pinyin') {
      return exercise.acceptedOptionIds.includes(answer.optionId);
    }
    return answer.optionId === exercise.correctOptionId;
  }
  if (exercise.type === 'pinyin_syllable_build') {
    return (
      answer.tileIds.length === 3 &&
      answer.tileIds[0] === exercise.correctInitialOptionId &&
      answer.tileIds[1] === exercise.correctFinalOptionId &&
      answer.tileIds[2] === exercise.correctToneOptionId
    );
  }
  if (exercise.type !== 'word_build' && exercise.type !== 'sentence_order') {
    throw new Error('A tile answer cannot score an option exercise.');
  }
  const knownTileIds = new Set(exercise.tiles.map((tile) => tile.tileId));
  if (
    answer.tileIds.length !== exercise.tiles.length ||
    new Set(answer.tileIds).size !== answer.tileIds.length ||
    answer.tileIds.some((tileId) => !knownTileIds.has(tileId))
  ) {
    throw new Error('The tile answer must reference every exercise tile exactly once.');
  }
  return answer.tileIds.every((tileId, index) => tileId === exercise.correctTileOrder[index]);
}

function pinyinSupportForAttempt(
  session: FormalSessionCacheRecord,
  state: FormalSessionRunnerState,
): AttemptDraftV2['pinyinSupport'] {
  if (state.activityState.hintLevel === 'full_answer') return 'full_answer';
  if (state.activityState.pinyinRevealed) return 'pinyin_revealed';
  return session.activities[state.activityIndex]?.pinyinSupport?.initialEvidenceSupport ===
    'pinyin_visible'
    ? 'pinyin_visible'
    : 'none';
}

export function submitRunnerAnswer(
  session: FormalSessionCacheRecord,
  state: FormalSessionRunnerState,
  answer: AttemptAnswerV2,
  context: RunnerAttemptContext,
): { attempt: AttemptDraftV2 | null; state: FormalSessionRunnerState } {
  if (state.phase !== 'answering') return { attempt: null, state };
  const exercise = currentRunnerExercise(session, state);
  const correct = localScore(exercise, answer);
  const nowMs = context.nowMs();
  const responseMs = Math.min(
    30 * 60 * 1000,
    Math.round(
      state.activityState.accumulatedResponseMs +
        (state.activityState.activeStartedAtMs === null
          ? 0
          : Math.max(0, nowMs - state.activityState.activeStartedAtMs)),
    ),
  );
  const activity = session.activities[state.activityIndex];
  if (!activity) throw new Error('The current Session Activity is missing.');
  const attempt = AttemptDraftV2Schema.parse({
    attemptId: context.attemptId(),
    sessionActivityId: activity.sessionActivityId,
    answer,
    isCorrectClient: correct,
    responseMs,
    hintLevel: state.activityState.hintLevel,
    pinyinSupport: pinyinSupportForAttempt(session, state),
    replayCount: state.activityState.replayCount,
    retryCount: state.activityState.retryCount,
    occurredAt: context.nowIso(),
    offlineSequence: context.offlineSequence,
  });
  return {
    attempt,
    state: {
      ...state,
      activityState: {
        ...state.activityState,
        accumulatedResponseMs: responseMs,
        activeStartedAtMs: null,
        localCorrect: correct,
        selectedOptionId: 'optionId' in answer ? answer.optionId : null,
        selectedTileIds: 'tileIds' in answer ? answer.tileIds : [],
      },
      pendingAttemptId: attempt.attemptId,
      phase: 'persisting_attempt',
    },
  };
}

export function markRunnerAttemptPersisted(
  state: FormalSessionRunnerState,
): FormalSessionRunnerState {
  return state.phase !== 'persisting_attempt'
    ? state
    : { ...state, pendingAttemptId: null, phase: 'feedback' };
}

export function retryRunnerAnswer(
  state: FormalSessionRunnerState,
  startedAtMs: number,
): FormalSessionRunnerState {
  if (state.phase !== 'feedback' || state.activityState.localCorrect !== false) return state;
  return {
    ...state,
    activityState: {
      ...state.activityState,
      activeStartedAtMs: startedAtMs,
      localCorrect: null,
      retryCount: state.activityState.retryCount + 1,
      selectedOptionId: null,
      selectedTileIds: [],
    },
    phase: 'answering',
  };
}

export function advanceRunner(
  session: FormalSessionCacheRecord,
  state: FormalSessionRunnerState,
  startedAtMs: number,
): FormalSessionRunnerState {
  if (state.phase !== 'feedback' || state.activityState.localCorrect !== true) return state;
  const completedActivity = session.activities[state.activityIndex];
  if (!completedActivity) throw new Error('The completed Session Activity is missing.');
  const completedActivityIds = [
    ...new Set([...state.completedActivityIds, completedActivity.sessionActivityId]),
  ];
  if (completedActivityIds.length === session.activities.length) {
    return {
      ...state,
      completedActivityIds,
      phase: 'completing_session',
    };
  }
  const nextIndex = session.activities.findIndex(
    (activity) => !completedActivityIds.includes(activity.sessionActivityId),
  );
  if (nextIndex < 0) throw new Error('The next Session Activity could not be resolved.');
  return {
    ...state,
    activityIndex: nextIndex,
    activityState: freshActivityState(startedAtMs),
    completedActivityIds,
    phase: 'answering',
  };
}

export function markRunnerSyncPending(state: FormalSessionRunnerState): FormalSessionRunnerState {
  return { ...state, phase: 'sync_pending' };
}

export function markRunnerCompleted(state: FormalSessionRunnerState): FormalSessionRunnerState {
  return { ...state, phase: 'completed' };
}

export function sessionRecordAfterAttempt(
  session: FormalSessionCacheRecord,
  state: FormalSessionRunnerState,
  nowIso: string,
): FormalSessionCacheRecord {
  const current = session.activities[state.activityIndex];
  if (!current) throw new Error('The current Session Activity is missing.');
  const completedActivityIds =
    state.activityState.localCorrect === true
      ? [...new Set([...session.completedActivityIds, current.sessionActivityId])]
      : session.completedActivityIds;
  const nextIncomplete = session.activities.findIndex(
    (activity) => !completedActivityIds.includes(activity.sessionActivityId),
  );
  return FormalSessionCacheRecordSchema.parse({
    ...session,
    completedActivityIds,
    currentActivityPosition: nextIncomplete === -1 ? session.activities.length - 1 : nextIncomplete,
    updatedAt: nowIso,
  });
}

export function runnerProgress(
  session: FormalSessionCacheRecord,
  state: FormalSessionRunnerState,
): number {
  return state.completedActivityIds.length / session.activities.length;
}

export function runnerRemainingSeconds(
  session: FormalSessionCacheRecord,
  state: FormalSessionRunnerState,
): number {
  return session.activities
    .filter((activity) => !state.completedActivityIds.includes(activity.sessionActivityId))
    .reduce((total, activity) => total + activity.estimatedSeconds, 0);
}
