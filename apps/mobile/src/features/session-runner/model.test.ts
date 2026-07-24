import { describe, expect, it } from 'vitest';

import {
  advanceRunner,
  createFormalSessionRunnerState,
  markRunnerAttemptPersisted,
  recordRunnerAudioPlayback,
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

describe('formal universal Session Runner model', () => {
  it('completes all ten Hanzi and Pinyin types across multiple source Lessons', () => {
    let session = runnerSession();
    let state = startRunnerActivity(createFormalSessionRunnerState(session), 0);
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
      'audio_to_pinyin',
      'pinyin_to_audio',
      'pinyin_to_glyph',
      'glyph_to_pinyin',
      'tone_choice',
      'pinyin_syllable_build',
    ]);
    expect(new Set(runnerActivities.map((activity) => activity.contentRef.split('.')[1]))).toEqual(
      new Set(['lesson-0', 'lesson-1']),
    );
    expect(state.phase).toBe('completing_session');
    expect(session.completedActivityIds).toHaveLength(10);
  });

  it('persists wrong evidence, hint/retry state, and explicit Pinyin support', () => {
    const session = runnerSession();
    let state = startRunnerActivity(createFormalSessionRunnerState(session), 0);
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
    const answering = startRunnerActivity(createFormalSessionRunnerState(session), 0);
    const first = submitRunnerAnswer(session, answering, correctAnswerAt(0), context(0));
    const duplicate = submitRunnerAnswer(session, first.state, correctAnswerAt(0), context(1));
    expect(first.attempt).not.toBeNull();
    expect(duplicate.attempt).toBeNull();
    expect(duplicate.state.pendingAttemptId).toBe(first.attempt?.attemptId);
  });

  it('resumes at the first incomplete Activity after process restart', () => {
    let session = runnerSession();
    const answering = startRunnerActivity(createFormalSessionRunnerState(session), 0);
    const submitted = submitRunnerAnswer(session, answering, correctAnswerAt(0), context(0));
    session = sessionRecordAfterAttempt(session, submitted.state, RUNNER_NOW);
    const restored = createFormalSessionRunnerState(session);
    expect(restored).toMatchObject({
      sessionId: RUNNER_SESSION_ID,
      activityIndex: 1,
      phase: 'ready',
    });
    expect(restored.completedActivityIds).toEqual([runnerActivities[0]!.sessionActivityId]);
  });

  it('resumes after a persisted Pinyin Attempt without replaying completed work', () => {
    let session = {
      ...runnerSession(),
      completedActivityIds: runnerActivities
        .slice(0, 4)
        .map((activity) => activity.sessionActivityId),
      currentActivityPosition: 4,
    };
    const answering = startRunnerActivity(createFormalSessionRunnerState(session), 0);
    const submitted = submitRunnerAnswer(session, answering, correctAnswerAt(4), context(4));
    session = sessionRecordAfterAttempt(session, submitted.state, RUNNER_NOW);
    const restored = createFormalSessionRunnerState(session);
    expect(restored).toMatchObject({ activityIndex: 5, phase: 'ready' });
    expect(restored.completedActivityIds).toContain(runnerActivities[4]!.sessionActivityId);
  });

  it('counts only successful repeat playback as replay evidence', () => {
    const session = runnerSession();
    let state = startRunnerActivity(createFormalSessionRunnerState(session), 0);
    state = recordRunnerAudioPlayback(state, 'audio.fixture');
    expect(state.activityState).toMatchObject({
      audioPlayCounts: { 'audio.fixture': 1 },
      hintLevel: 'none',
      replayCount: 0,
    });
    state = recordRunnerAudioPlayback(state, 'audio.fixture');
    expect(state.activityState).toMatchObject({
      audioPlayCounts: { 'audio.fixture': 2 },
      hintLevel: 'audio_repeat',
      replayCount: 1,
    });
  });

  it('scores the explicit neutral tone and context reading locally before server verification', () => {
    const session = runnerSession();
    for (const index of [7, 8]) {
      const base = {
        ...createFormalSessionRunnerState(session),
        activityIndex: index,
      };
      const state = startRunnerActivity(base, 0);
      const submitted = submitRunnerAnswer(session, state, correctAnswerAt(index), context(index));
      expect(submitted.attempt).toMatchObject({ isCorrectClient: true });
    }
  });
});
