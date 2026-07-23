import { describe, expect, it } from 'vitest';

import {
  advanceWritingLessonStroke,
  createWritingLessonState,
  restartWritingLessonStroke,
  selectWritingLessonCharacter,
  selectWritingLessonPhase,
} from './lesson-model';

describe('standard stroke lesson state', () => {
  it('starts the reviewed 王家豪 fixture in observation mode', () => {
    const state = createWritingLessonState('王家豪');
    expect(state.assets.map(({ character }) => character)).toEqual(['王', '家', '豪']);
    expect(state).toMatchObject({ activeStrokeIndex: 0, phase: 'observe' });
  });

  it('advances only inside the selected character ordered stroke list', () => {
    const state = createWritingLessonState('王家豪');
    let advanced = state;
    for (let index = 0; index < 20; index += 1) {
      advanced = advanceWritingLessonStroke(advanced);
    }
    expect(advanced.activeStrokeIndex).toBe(advanced.assets[0]!.strokes.length - 1);
    expect(restartWritingLessonStroke(advanced).activeStrokeIndex).toBe(0);
  });

  it('resets the stroke when selecting another character or phase', () => {
    const advanced = advanceWritingLessonStroke(createWritingLessonState('王家豪'));
    expect(selectWritingLessonCharacter(advanced, 1)).toMatchObject({
      activeCharacterIndex: 1,
      activeStrokeIndex: 0,
    });
    expect(selectWritingLessonPhase(advanced, 'trace')).toMatchObject({
      activeStrokeIndex: 0,
      phase: 'trace',
    });
  });

  it('uses free writing and reports unsupported characters without guessing', () => {
    expect(createWritingLessonState('🙂')).toMatchObject({
      assets: [],
      phase: 'free',
      unsupportedCharacters: ['🙂'],
    });
  });
});
