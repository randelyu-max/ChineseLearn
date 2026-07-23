import {
  AttemptDraftSchema,
  type AttemptDraft,
  type AudioToGlyphExercise,
  type HintLevel,
} from '@hanziquest/contracts';

export type AudioToGlyphState = Readonly<{
  status: 'awaiting-answer' | 'incorrect-feedback' | 'correct-feedback';
  selectedOptionId: string | null;
  hintLevel: HintLevel;
  replayCount: number;
  retryCount: number;
  activeStartedAtMs: number | null;
  accumulatedResponseMs: number;
}>;

export type AttemptContext = {
  attemptId: () => string;
  nowIso: () => string;
  nowMs: () => number;
  offlineSequence: number;
};

export const audioToGlyphDemoExercise: AudioToGlyphExercise = {
  activityId: '00000000-0000-4000-8000-000000000001',
  type: 'audio_to_glyph',
  promptAudioAssetId: '00000000-0000-4000-8000-000000000002',
  targetConceptIds: ['00000000-0000-4000-8000-000000000003'],
  options: [
    {
      optionId: '00000000-0000-4000-8000-000000000011',
      glyph: '水',
      accessibilityLabel: '水，喝水的水',
    },
    {
      optionId: '00000000-0000-4000-8000-000000000012',
      glyph: '木',
      accessibilityLabel: '木，木头的木',
    },
    {
      optionId: '00000000-0000-4000-8000-000000000013',
      glyph: '人',
      accessibilityLabel: '人，一个人的人',
    },
  ],
  correctOptionId: '00000000-0000-4000-8000-000000000011',
  visualHintZh: '再听一次，找一找有三点水的字。',
};

export function createAudioToGlyphState(startedAtMs = 0): AudioToGlyphState {
  return {
    status: 'awaiting-answer',
    selectedOptionId: null,
    hintLevel: 'none',
    replayCount: 0,
    retryCount: 0,
    activeStartedAtMs: startedAtMs,
    accumulatedResponseMs: 0,
  };
}

export function audioToGlyphLayout(viewportWidth: number): {
  columns: 1 | 2;
  minimumOptionHeight: 112;
} {
  return { columns: viewportWidth < 360 ? 1 : 2, minimumOptionHeight: 112 };
}

export function recordAudioReplay(state: AudioToGlyphState): AudioToGlyphState {
  if (state.status === 'correct-feedback') return state;
  return {
    ...state,
    hintLevel: state.hintLevel === 'none' ? 'audio_repeat' : state.hintLevel,
    replayCount: state.replayCount + 1,
  };
}

export function requestVisualHint(state: AudioToGlyphState): AudioToGlyphState {
  if (state.status === 'correct-feedback') return state;
  return { ...state, hintLevel: 'visual_hint' };
}

export function retryAudioToGlyph(
  state: AudioToGlyphState,
  startedAtMs: number,
): AudioToGlyphState {
  return state.status !== 'incorrect-feedback'
    ? state
    : {
        ...state,
        status: 'awaiting-answer',
        selectedOptionId: null,
        activeStartedAtMs: startedAtMs,
      };
}

export function selectAudioToGlyphOption(
  exercise: AudioToGlyphExercise,
  state: AudioToGlyphState,
  optionId: string,
  context: AttemptContext,
): { state: AudioToGlyphState; attempt: AttemptDraft | null } {
  if (state.status !== 'awaiting-answer') return { state, attempt: null };
  if (!exercise.options.some((option) => option.optionId === optionId)) {
    throw new Error('Selected option does not belong to this exercise.');
  }

  const isCorrect = optionId === exercise.correctOptionId;
  const nowMs = context.nowMs();
  const responseMs =
    state.accumulatedResponseMs +
    (state.activeStartedAtMs === null ? 0 : Math.max(0, nowMs - state.activeStartedAtMs));
  if (!isCorrect) {
    return {
      state: {
        ...state,
        status: 'incorrect-feedback',
        selectedOptionId: optionId,
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
    answer: { optionId },
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
      selectedOptionId: optionId,
      activeStartedAtMs: null,
      accumulatedResponseMs: responseMs,
    },
    attempt,
  };
}
