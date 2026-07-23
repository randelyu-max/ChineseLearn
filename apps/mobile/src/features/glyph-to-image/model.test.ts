import { describe, expect, it } from 'vitest';

import {
  createGlyphToImageState,
  glyphToImageDemoExercise,
  glyphToImageLayout,
  recordGlyphAudioReplay,
  requestGlyphToImageHint,
  retryGlyphToImage,
  selectGlyphToImageOption,
} from './model.ts';

const baseContext = {
  attemptId: () => '00000000-0000-4000-8000-000000000099',
  nowIso: () => '2026-07-22T18:00:00Z',
  nowMs: () => 2000,
  offlineSequence: 4,
};

describe('glyph_to_image interaction model', () => {
  it('creates a standardized correct attempt', () => {
    const result = selectGlyphToImageOption(
      glyphToImageDemoExercise,
      createGlyphToImageState(),
      glyphToImageDemoExercise.correctOptionId,
      baseContext,
    );
    expect(result.attempt).toMatchObject({ responseMs: 2000, retryCount: 0, replayCount: 0 });
    expect(result.state.status).toBe('correct-feedback');
  });

  it('provides a visual hint after a wrong answer and supports retry', () => {
    const wrong = selectGlyphToImageOption(
      glyphToImageDemoExercise,
      createGlyphToImageState(),
      glyphToImageDemoExercise.options[1]!.optionId,
      baseContext,
    );
    expect(wrong.state).toMatchObject({
      status: 'incorrect-feedback',
      hintLevel: 'visual_hint',
      retryCount: 1,
    });
    expect(retryGlyphToImage(wrong.state, 5000)).toMatchObject({
      status: 'awaiting-answer',
      activeStartedAtMs: 5000,
    });
  });

  it('records pronunciation replay and explicit hints', () => {
    const replayed = recordGlyphAudioReplay(createGlyphToImageState());
    expect(replayed).toMatchObject({ replayCount: 1, hintLevel: 'audio_repeat' });
    expect(requestGlyphToImageHint(replayed).hintLevel).toBe('visual_hint');
  });

  it('does not duplicate a completed attempt', () => {
    const first = selectGlyphToImageOption(
      glyphToImageDemoExercise,
      createGlyphToImageState(),
      glyphToImageDemoExercise.correctOptionId,
      baseContext,
    );
    expect(
      selectGlyphToImageOption(
        glyphToImageDemoExercise,
        first.state,
        glyphToImageDemoExercise.correctOptionId,
        baseContext,
      ).attempt,
    ).toBeNull();
  });

  it('excludes feedback time and adapts to small screens', () => {
    let now = 1000;
    const context = { ...baseContext, nowMs: () => now };
    const wrong = selectGlyphToImageOption(
      glyphToImageDemoExercise,
      createGlyphToImageState(),
      glyphToImageDemoExercise.options[1]!.optionId,
      context,
    );
    now = 6000;
    const retried = retryGlyphToImage(wrong.state, now);
    now = 6500;
    const correct = selectGlyphToImageOption(
      glyphToImageDemoExercise,
      retried,
      glyphToImageDemoExercise.correctOptionId,
      context,
    );
    expect(correct.attempt?.responseMs).toBe(1500);
    expect(glyphToImageLayout(320)).toEqual({ columns: 1, minimumOptionHeight: 144 });
    expect(glyphToImageLayout(400).columns).toBe(2);
  });
});
