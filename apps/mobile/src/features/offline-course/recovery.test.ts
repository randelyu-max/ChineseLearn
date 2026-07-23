import { describe, expect, it } from 'vitest';

import { parseRecoveredCourse } from './model';

describe('offline course recovery', () => {
  it('restores a valid saved level', () => {
    expect(
      parseRecoveredCourse(
        JSON.stringify({
          completedStageCount: 3,
          currentStage: 2,
          storyAnswerIndex: null,
          storyStatus: 'reading',
        }),
      ),
    ).toMatchObject({ completedStageCount: 3, currentStage: 2 });
  });

  it('uses a clean lesson when saved data is invalid', () => {
    expect(parseRecoveredCourse('{broken')).toMatchObject({
      completedStageCount: 0,
      currentStage: 0,
    });
  });
});
