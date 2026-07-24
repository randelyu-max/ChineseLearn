import { describe, expect, it } from 'vitest';

import {
  advanceRunner,
  createFormalHanziRunnerState,
  markRunnerAttemptPersisted,
  requestRunnerHint,
  revealRunnerPinyin,
  retryRunnerAnswer,
  sessionRecordAfterAttempt,
  startRunnerActivity,
  submitRunnerAnswer,
} from './model';
import {
  RUNNER_NOW,
  RUNNER_SESSION_ID,
  correctAnswerAt,
  runnerActivities,
  runnerSession,
} from './test-fixtures';

function context(index: number) {
  return {
    attemptId: () => `56000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    nowIso: () => RUNNER_NOW,
    nowMs: () => 1_000 + index * 100,
    offlineSequence: index,
  };
}

describe('formal Hanzi Session Runner model', () => {
  it('completes all four supported types across multiple source Lessons', () => {
    let session = runnerSession();
    let state = startRunnerActivity(createFormalHanziRunnerState(session), 0);
    const submittedTypes: string[] = [];

    for (let index = 0; index < runnerActivities.length; index += 1) {
      const submitted = submitRunnerAnswer(session, state, correctAnswerAt(index), context(index));
      expect(submitted.attempt).toMatchObject({
        sessionActivityId: runnerActivities[index]?.sessionActivityId,
        isCorrectClient: true,
      });
      submittedTypes.push(runnerActivities[index]!.exercise.type);
      session = sessionRecordAfterAttempt(session, submitted.state, RUNNER_NOW);
      state = markRunnerAttemptPersisted(submitted.state);
      state = advanceRunner(session, state, 2_000 + index);
    }

    expect(submittedTypes).toEqual([
      'audio_to_glyph',
      'glyph_to_image',
      'word_build',
      'sentence_order',
    ]);
    expect(new Set(runnerActivities.map((activity) => activity.contentRef.split('.')[1]))).toEqual(
      new Set(['lesson-0', 'lesson-1']),
    );
    expect(state.phase).toBe('completing_session');
    expect(session.completedActivityIds).toHaveLength(4);
  });

  it('persists wrong evidence, hint/retry state, and explicit Pinyin support', () => {
    const session = runnerSession();
    let state = startRunnerActivity(createFormalHanziRunnerState(session), 0);
    state = requestRunnerHint(state);
    state = revealRunnerPinyin(session, state);
    const exercise = runnerActivities[0]!.exercise;
    if (exercise.type !== 'audio_to_glyph') throw new Error('Expected audio fixture.');
    const wrongOption = exercise.options.find(
      (option) => option.optionId !== exercise.correctOptionId,
    )!;
    const wrong = submitRunnerAnswer(
      session,
      state,
      { optionId: wrongOption.optionId },
      context(0),
    );
    expect(wrong.attempt).toMatchObject({
      isCorrectClient: false,
      hintLevel: 'visual_hint',
      pinyinSupport: 'pinyin_revealed',
      retryCount: 0,
    });
    const feedback = markRunnerAttemptPersisted(wrong.state);
    const retry = retryRunnerAnswer(feedback, 2_000);
    expect(retry).toMatchObject({
      phase: 'answering',
      activityState: { retryCount: 1 },
    });
    const correct = submitRunnerAnswer(session, retry, correctAnswerAt(0), context(1));
    expect(correct.attempt).toMatchObject({ isCorrectClient: true, retryCount: 1 });
  });

  it('ignores double submission while an Attempt is persisting', () => {
    const session = runnerSession();
    const answering = startRunnerActivity(createFormalHanziRunnerState(session), 0);
    const first = submitRunnerAnswer(session, answering, correctAnswerAt(0), context(0));
    const duplicate = submitRunnerAnswer(session, first.state, correctAnswerAt(0), context(1));
    expect(first.attempt).not.toBeNull();
    expect(duplicate.attempt).toBeNull();
    expect(duplicate.state.pendingAttemptId).toBe(first.attempt?.attemptId);
  });

  it('resumes at the first incomplete Activity after process restart', () => {
    let session = runnerSession();
    const answering = startRunnerActivity(createFormalHanziRunnerState(session), 0);
    const submitted = submitRunnerAnswer(session, answering, correctAnswerAt(0), context(0));
    session = sessionRecordAfterAttempt(session, submitted.state, RUNNER_NOW);
    const restored = createFormalHanziRunnerState(session);
    expect(restored).toMatchObject({
      sessionId: RUNNER_SESSION_ID,
      activityIndex: 1,
      phase: 'ready',
    });
    expect(restored.completedActivityIds).toEqual([runnerActivities[0]!.sessionActivityId]);
  });
});
