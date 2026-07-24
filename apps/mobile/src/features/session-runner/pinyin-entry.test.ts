import { describe, expect, it } from 'vitest';

import { summarizePinyinProgress } from './pinyin-entry';
import { runnerActivities, runnerSession } from './test-fixtures';

describe('Pinyin tab formal progress', () => {
  it('recommends formal Pinyin learning without an active Session', () => {
    expect(summarizePinyinProgress(null)).toEqual({
      completed: 0,
      recommendation: 'continue_pinyin',
      total: 0,
    });
  });

  it('reports current Pinyin completion and prioritizes an unfinished tone Activity', () => {
    const session = runnerSession();
    const completedActivityIds = runnerActivities
      .slice(4, 8)
      .map((activity) => activity.sessionActivityId);
    expect(summarizePinyinProgress({ ...session, completedActivityIds })).toEqual({
      completed: 4,
      recommendation: 'review_tones',
      total: 6,
    });
  });
});
