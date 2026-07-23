import {
  AttemptDraftSchema,
  type AttemptDraft,
  type GlyphToImageExercise,
  type HintLevel,
} from '@hanziquest/contracts';

export type GlyphToImageState = Readonly<{
  status: 'awaiting-answer' | 'incorrect-feedback' | 'correct-feedback';
  selectedOptionId: string | null;
  hintLevel: HintLevel;
  replayCount: number;
  retryCount: number;
  activeStartedAtMs: number | null;
  accumulatedResponseMs: number;
}>;

export type GlyphToImageAttemptContext = {
  attemptId: () => string;
  nowIso: () => string;
  nowMs: () => number;
  offlineSequence: number;
};

export const glyphToImageDemoExercise: GlyphToImageExercise = {
  activityId: '00000000-0000-4000-8000-000000000021',
  type: 'glyph_to_image',
  promptGlyph: '水',
  promptAudioAssetId: '00000000-0000-4000-8000-000000000022',
  targetConceptIds: ['00000000-0000-4000-8000-000000000023'],
  options: [
    {
      optionId: '00000000-0000-4000-8000-000000000024',
      imageAssetId: '00000000-0000-4000-8000-000000000025',
      accessibilityLabel: '一杯水',
    },
    {
      optionId: '00000000-0000-4000-8000-000000000026',
      imageAssetId: '00000000-0000-4000-8000-000000000027',
      accessibilityLabel: '一棵树',
    },
    {
      optionId: '00000000-0000-4000-8000-000000000028',
      imageAssetId: '00000000-0000-4000-8000-000000000029',
      accessibilityLabel: '一碗米饭',
    },
  ],
  correctOptionId: '00000000-0000-4000-8000-000000000024',
  visualHintZh: '想一想，口渴时会喝什么。',
};

export function createGlyphToImageState(startedAtMs = 0): GlyphToImageState {
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

export function glyphToImageLayout(viewportWidth: number): {
  columns: 1 | 2;
  minimumOptionHeight: 144;
} {
  return { columns: viewportWidth < 360 ? 1 : 2, minimumOptionHeight: 144 };
}

export function recordGlyphAudioReplay(state: GlyphToImageState): GlyphToImageState {
  if (state.status === 'correct-feedback') return state;
  return {
    ...state,
    hintLevel: state.hintLevel === 'none' ? 'audio_repeat' : state.hintLevel,
    replayCount: state.replayCount + 1,
  };
}

export function requestGlyphToImageHint(state: GlyphToImageState): GlyphToImageState {
  return state.status === 'correct-feedback' ? state : { ...state, hintLevel: 'visual_hint' };
}

export function retryGlyphToImage(
  state: GlyphToImageState,
  startedAtMs: number,
): GlyphToImageState {
  return state.status !== 'incorrect-feedback'
    ? state
    : {
        ...state,
        status: 'awaiting-answer',
        selectedOptionId: null,
        activeStartedAtMs: startedAtMs,
      };
}

export function selectGlyphToImageOption(
  exercise: GlyphToImageExercise,
  state: GlyphToImageState,
  optionId: string,
  context: GlyphToImageAttemptContext,
): { state: GlyphToImageState; attempt: AttemptDraft | null } {
  if (state.status !== 'awaiting-answer') return { state, attempt: null };
  if (!exercise.options.some((option) => option.optionId === optionId)) {
    throw new Error('Selected option does not belong to this exercise.');
  }
  const nowMs = context.nowMs();
  const responseMs =
    state.accumulatedResponseMs +
    (state.activeStartedAtMs === null ? 0 : Math.max(0, nowMs - state.activeStartedAtMs));

  if (optionId !== exercise.correctOptionId) {
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
