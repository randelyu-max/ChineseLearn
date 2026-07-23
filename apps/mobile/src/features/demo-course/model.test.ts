import { describe, expect, it } from 'vitest';

import {
  answerStoryQuestion,
  completeExerciseStage,
  continueDemoCourse,
  createDemoCourseState,
  demoCourseProgress,
  retryStoryQuestion,
} from './model';

describe('My Home demo course flow', () => {
  it('cannot advance before the current exercise is completed', () => {
    const initial = createDemoCourseState();
    expect(continueDemoCourse(initial)).toBe(initial);
  });

  it('advances four exercises and exposes deterministic progress', () => {
    let state = createDemoCourseState();
    for (let stage = 0; stage < 4; stage += 1) {
      state = completeExerciseStage(state);
      expect(demoCourseProgress(state)).toBe((stage + 1) / 5);
      state = continueDemoCourse(state);
      expect(state.currentStage).toBe(stage + 1);
    }
    expect(state.currentStage).toBe(4);
  });

  it('supports a gentle retry and completes only on the correct story answer', () => {
    let state = createDemoCourseState();
    for (let stage = 0; stage < 4; stage += 1) {
      state = continueDemoCourse(completeExerciseStage(state));
    }

    state = answerStoryQuestion(state, 1, 0);
    expect(state.storyStatus).toBe('incorrect');
    expect(demoCourseProgress(state)).toBe(0.8);
    state = retryStoryQuestion(state);
    expect(state.storyStatus).toBe('reading');
    state = answerStoryQuestion(state, 0, 0);
    expect(state.storyStatus).toBe('correct');
    expect(demoCourseProgress(state)).toBe(1);
    expect(continueDemoCourse(state).currentStage).toBe(5);
  });
});
