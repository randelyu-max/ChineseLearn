import { describe, expect, it } from 'vitest';

import {
  assembledPinyin,
  buildPinyinSyllableExercise,
  canSelectFinal,
  createPinyinSyllableBuildState,
  pinyinSyllableBuildDemoExercise,
  pinyinSyllableBuildLayout,
  resetPinyinSyllable,
  selectPinyinFinal,
  selectPinyinInitial,
  selectPinyinTone,
  submitPinyinSyllable,
} from './model';

function selectCorrect() {
  let state = createPinyinSyllableBuildState();
  state = selectPinyinInitial(pinyinSyllableBuildDemoExercise, state, 'x');
  state = selectPinyinFinal(pinyinSyllableBuildDemoExercise, state, 'üe');
  return selectPinyinTone(pinyinSyllableBuildDemoExercise, state, 2);
}

describe('pinyin_syllable_build interaction model', () => {
  it('enforces initial, final, then tone order', () => {
    expect(() =>
      selectPinyinFinal(pinyinSyllableBuildDemoExercise, createPinyinSyllableBuildState(), 'üe'),
    ).toThrow(/initial before/);
    const initial = selectPinyinInitial(
      pinyinSyllableBuildDemoExercise,
      createPinyinSyllableBuildState(),
      'x',
    );
    expect(() => selectPinyinTone(pinyinSyllableBuildDemoExercise, initial, 2)).toThrow(
      /initial and final/,
    );
  });

  it('uses the canonical legal combination and tone-mark placement', () => {
    const ready = selectCorrect();
    expect(ready.status).toBe('ready');
    expect(assembledPinyin(ready)).toMatchObject({
      display: 'xué',
      numbered: 'xue2',
      initial: 'x',
      final: 'üe',
      tone: 2,
    });
  });

  it('marks a correct completed syllable and then locks it', () => {
    const correct = submitPinyinSyllable(pinyinSyllableBuildDemoExercise, selectCorrect());
    expect(correct.status).toBe('correct-feedback');
    expect(resetPinyinSyllable(correct)).toBe(correct);
  });

  it('allows a legal alternative, gives supportive retry, and resets in order', () => {
    let state = createPinyinSyllableBuildState();
    state = selectPinyinInitial(pinyinSyllableBuildDemoExercise, state, 'q');
    state = selectPinyinFinal(pinyinSyllableBuildDemoExercise, state, 'üe');
    state = selectPinyinTone(pinyinSyllableBuildDemoExercise, state, 2);
    expect(assembledPinyin(state)?.display).toBe('qué');
    const wrong = submitPinyinSyllable(pinyinSyllableBuildDemoExercise, state);
    expect(wrong.status).toBe('incorrect-feedback');
    expect(resetPinyinSyllable(wrong)).toMatchObject({
      retryCount: 1,
      selectedInitial: null,
      selectedFinal: null,
      selectedTone: null,
      status: 'building',
    });
  });

  it('prevents illegal initial-final combinations', () => {
    const initial = selectPinyinInitial(
      pinyinSyllableBuildDemoExercise,
      createPinyinSyllableBuildState(),
      'sh',
    );
    expect(canSelectFinal(initial, 'üe')).toBe(false);
    expect(() => selectPinyinFinal(pinyinSyllableBuildDemoExercise, initial, 'üe')).toThrow(
      /not a legal/,
    );
    expect(canSelectFinal(initial, 'u')).toBe(true);
  });

  it('rejects choices outside the exercise', () => {
    expect(() =>
      selectPinyinInitial(pinyinSyllableBuildDemoExercise, createPinyinSyllableBuildState(), 'm'),
    ).toThrow(/does not belong/);
  });

  it('validates target coverage and minimum alternatives', () => {
    expect(() =>
      buildPinyinSyllableExercise({
        activityId: 'missing-initial',
        finalOptions: ['üe', 'ie'],
        initialOptions: ['q', 'sh'],
        targetSyllable: 'xue2',
      }),
    ).toThrow(/target initial/);
    expect(() =>
      buildPinyinSyllableExercise({
        activityId: 'too-small',
        finalOptions: ['üe'],
        initialOptions: ['x'],
        targetSyllable: 'xue2',
        toneOptions: [2],
      }),
    ).toThrow(/at least two/);
  });

  it('uses tap-sized responsive controls without free-text input', () => {
    expect(pinyinSyllableBuildLayout(320)).toEqual({
      compact: true,
      minimumTargetHeight: 48,
    });
    expect(pinyinSyllableBuildLayout(390).compact).toBe(false);
    expect(JSON.stringify(pinyinSyllableBuildDemoExercise)).not.toMatch(/textInput|ime/i);
  });
});
