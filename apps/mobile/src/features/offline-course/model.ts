import { createDemoCourseState, type DemoCourseState } from '../demo-course';

export function parseRecoveredCourse(value: string | null): DemoCourseState {
  if (!value) return createDemoCourseState();
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'currentStage' in parsed &&
      'completedStageCount' in parsed &&
      'storyAnswerIndex' in parsed &&
      'storyStatus' in parsed &&
      Number.isInteger(parsed.currentStage) &&
      Number.isInteger(parsed.completedStageCount) &&
      (parsed.storyAnswerIndex === null || Number.isInteger(parsed.storyAnswerIndex)) &&
      ['reading', 'incorrect', 'correct'].includes(String(parsed.storyStatus)) &&
      Number(parsed.currentStage) >= 0 &&
      Number(parsed.currentStage) <= 5 &&
      Number(parsed.completedStageCount) >= 0 &&
      Number(parsed.completedStageCount) <= 5
    ) {
      return parsed as DemoCourseState;
    }
  } catch {
    // Invalid local data is discarded without blocking the lesson.
  }
  return createDemoCourseState();
}
