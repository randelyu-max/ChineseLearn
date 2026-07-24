import { describe, expect, it } from 'vitest';

import {
  createFormalSessionRunnerState,
  requestRunnerHint,
  startRunnerActivity,
  type FormalSessionRunnerState,
} from './model';
import {
  adaptAudioToPinyin,
  adaptGlyphToPinyin,
  adaptPinyinSyllableBuild,
  adaptPinyinToAudio,
  adaptPinyinToGlyph,
  adaptToneChoice,
  isFormalPinyinExercise,
} from './pinyin-adapters';
import { runnerActivities, runnerSession } from './test-fixtures';

function stateAt(index: number): FormalSessionRunnerState {
  return startRunnerActivity(
    { ...createFormalSessionRunnerState(runnerSession()), activityIndex: index },
    0,
  );
}

describe('formal Pinyin Activity adapters', () => {
  it('adapts all six immutable Session exercise snapshots', () => {
    const exercises = runnerActivities.slice(4).map((activity) => activity.exercise);
    expect(exercises.every(isFormalPinyinExercise)).toBe(true);
    const [audioToPinyin, pinyinToAudio, pinyinToGlyph, glyphToPinyin, tone, build] = exercises;
    if (audioToPinyin?.type !== 'audio_to_pinyin') throw new Error('Missing fixture.');
    if (pinyinToAudio?.type !== 'pinyin_to_audio') throw new Error('Missing fixture.');
    if (pinyinToGlyph?.type !== 'pinyin_to_glyph') throw new Error('Missing fixture.');
    if (glyphToPinyin?.type !== 'glyph_to_pinyin') throw new Error('Missing fixture.');
    if (tone?.type !== 'tone_choice') throw new Error('Missing fixture.');
    if (build?.type !== 'pinyin_syllable_build') throw new Error('Missing fixture.');

    expect(adaptAudioToPinyin(audioToPinyin, stateAt(4)).exercise.correctOptionId).toBe(
      audioToPinyin.correctOptionId,
    );
    expect(adaptPinyinToAudio(pinyinToAudio, stateAt(5)).exercise.options).toHaveLength(3);
    expect(adaptPinyinToGlyph(pinyinToGlyph, stateAt(6)).exercise.targetOptionId).toBe(
      pinyinToGlyph.correctOptionId,
    );
    expect(adaptGlyphToPinyin(glyphToPinyin, stateAt(7)).exercise.acceptedOptionIds).toEqual(
      glyphToPinyin.acceptedOptionIds,
    );
    expect(adaptToneChoice(tone, stateAt(8)).exercise.targetTone).toBe(5);
    expect(adaptPinyinSyllableBuild(build, stateAt(9)).exercise.target.numbered).toBe(
      build.targetSyllable,
    );
  });

  it('uses the common hint state for context feedback and Attempt evidence', () => {
    const exercise = runnerActivities[7]!.exercise;
    if (exercise.type !== 'glyph_to_pinyin') throw new Error('Missing fixture.');
    const hinted = requestRunnerHint(stateAt(7));
    expect(adaptGlyphToPinyin(exercise, hinted).state.hintVisible).toBe(true);
    expect(hinted.activityState.hintLevel).toBe('visual_hint');
  });
});
