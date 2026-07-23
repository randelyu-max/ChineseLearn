import { describe, expect, it } from 'vitest';

import {
  audioToGlyphDemoExercise,
  audioToGlyphLayout,
  createAudioToGlyphState,
  recordAudioReplay,
  requestVisualHint,
  retryAudioToGlyph,
  selectAudioToGlyphOption,
  type AttemptContext,
} from './model.ts';

const context: AttemptContext = {
  attemptId: () => '00000000-0000-4000-8000-000000000099',
  nowIso: () => '2026-07-22T18:00:00Z',
  nowMs: () => 2850,
  offlineSequence: 13,
};

describe('audio_to_glyph interaction model', () => {
  it('creates a standard attempt draft for a correct answer', () => {
    const result = selectAudioToGlyphOption(
      audioToGlyphDemoExercise,
      createAudioToGlyphState(),
      audioToGlyphDemoExercise.correctOptionId,
      context,
    );
    expect(result.state.status).toBe('correct-feedback');
    expect(result.attempt).toMatchObject({
      answer: { optionId: audioToGlyphDemoExercise.correctOptionId },
      isCorrectClient: true,
      responseMs: 2850,
      offlineSequence: 13,
    });
  });

  it('turns a wrong answer into supportive hint and retry state', () => {
    const wrongId = audioToGlyphDemoExercise.options[1]!.optionId;
    const wrong = selectAudioToGlyphOption(
      audioToGlyphDemoExercise,
      createAudioToGlyphState(),
      wrongId,
      context,
    );
    expect(wrong).toMatchObject({
      attempt: null,
      state: { status: 'incorrect-feedback', hintLevel: 'visual_hint', retryCount: 1 },
    });
    expect(retryAudioToGlyph(wrong.state, 3000).status).toBe('awaiting-answer');
  });

  it('records replay and explicit hint evidence', () => {
    const replayed = recordAudioReplay(createAudioToGlyphState());
    expect(replayed).toMatchObject({ replayCount: 1, hintLevel: 'audio_repeat' });
    expect(requestVisualHint(replayed).hintLevel).toBe('visual_hint');
  });

  it('does not emit duplicate attempts after completion', () => {
    const first = selectAudioToGlyphOption(
      audioToGlyphDemoExercise,
      createAudioToGlyphState(),
      audioToGlyphDemoExercise.correctOptionId,
      context,
    );
    const duplicate = selectAudioToGlyphOption(
      audioToGlyphDemoExercise,
      first.state,
      audioToGlyphDemoExercise.correctOptionId,
      context,
    );
    expect(duplicate).toEqual({ state: first.state, attempt: null });
  });

  it('excludes feedback time across a retry', () => {
    let now = 1000;
    const timedContext = { ...context, nowMs: () => now };
    const wrong = selectAudioToGlyphOption(
      audioToGlyphDemoExercise,
      createAudioToGlyphState(0),
      audioToGlyphDemoExercise.options[1]!.optionId,
      timedContext,
    );
    now = 5000;
    const retried = retryAudioToGlyph(wrong.state, now);
    now = 5500;
    const correct = selectAudioToGlyphOption(
      audioToGlyphDemoExercise,
      retried,
      audioToGlyphDemoExercise.correctOptionId,
      timedContext,
    );
    expect(correct.attempt?.responseMs).toBe(1500);
  });

  it('uses one column on small screens and keeps large option targets', () => {
    expect(audioToGlyphLayout(320)).toEqual({ columns: 1, minimumOptionHeight: 112 });
    expect(audioToGlyphLayout(390).columns).toBe(2);
  });

  it('rejects an option outside the exercise', () => {
    expect(() =>
      selectAudioToGlyphOption(
        audioToGlyphDemoExercise,
        createAudioToGlyphState(),
        '00000000-0000-4000-8000-000000000098',
        context,
      ),
    ).toThrow('does not belong');
  });
});
