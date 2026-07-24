import type { FormalSessionCacheRecord } from '../offline-storage';
import { isFormalPinyinExercise } from './pinyin-adapters';

export type PinyinProgressSummary = Readonly<{
  completed: number;
  recommendation: 'continue_pinyin' | 'review_tones';
  total: number;
}>;

export function summarizePinyinProgress(
  session: FormalSessionCacheRecord | null,
): PinyinProgressSummary {
  if (!session) {
    return { completed: 0, recommendation: 'continue_pinyin', total: 0 };
  }
  const pinyinActivities = session.activities.filter((activity) =>
    isFormalPinyinExercise(activity.exercise),
  );
  const incompleteTone = pinyinActivities.some(
    (activity) =>
      activity.exercise.type === 'tone_choice' &&
      !session.completedActivityIds.includes(activity.sessionActivityId),
  );
  return {
    completed: pinyinActivities.filter((activity) =>
      session.completedActivityIds.includes(activity.sessionActivityId),
    ).length,
    recommendation: incompleteTone ? 'review_tones' : 'continue_pinyin',
    total: pinyinActivities.length,
  };
}
