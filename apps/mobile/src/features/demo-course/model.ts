export const demoCourseStageCount = 5;

export type DemoCourseState = Readonly<{
  completedStageCount: number;
  currentStage: number;
  storyAnswerIndex: number | null;
  storyStatus: 'reading' | 'incorrect' | 'correct';
}>;

export function createDemoCourseState(): DemoCourseState {
  return {
    completedStageCount: 0,
    currentStage: 0,
    storyAnswerIndex: null,
    storyStatus: 'reading',
  };
}

export function completeExerciseStage(state: DemoCourseState): DemoCourseState {
  if (state.currentStage >= 4 || state.completedStageCount > state.currentStage) return state;
  return { ...state, completedStageCount: state.currentStage + 1 };
}

export function continueDemoCourse(state: DemoCourseState): DemoCourseState {
  if (state.currentStage >= demoCourseStageCount) return state;
  if (state.completedStageCount <= state.currentStage) return state;
  return { ...state, currentStage: state.currentStage + 1 };
}

export function answerStoryQuestion(
  state: DemoCourseState,
  answerIndex: number,
  correctAnswerIndex: number,
): DemoCourseState {
  if (state.currentStage !== 4 || state.storyStatus === 'correct') return state;
  const correct = answerIndex === correctAnswerIndex;
  return {
    ...state,
    completedStageCount: correct ? demoCourseStageCount : state.completedStageCount,
    storyAnswerIndex: answerIndex,
    storyStatus: correct ? 'correct' : 'incorrect',
  };
}

export function retryStoryQuestion(state: DemoCourseState): DemoCourseState {
  if (state.storyStatus !== 'incorrect') return state;
  return { ...state, storyAnswerIndex: null, storyStatus: 'reading' };
}

export function demoCourseProgress(state: DemoCourseState): number {
  return state.completedStageCount / demoCourseStageCount;
}
