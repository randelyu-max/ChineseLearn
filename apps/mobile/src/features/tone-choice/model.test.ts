import { describe, expect, it } from 'vitest';

import {
  buildToneChoiceExercise,
  buildToneOptionTable,
  createToneChoiceState,
  retryToneChoice,
  selectToneChoiceOption,
  toneChoiceDemoExercise,
  toneChoiceLayout,
} from './model';

describe('tone_choice interaction model', () => {
  it('builds the complete first-through-fourth-and-neutral tone table', () => {
    expect(buildToneOptionTable('ma')).toEqual([
      expect.objectContaining({ display: 'mā', numbered: 'ma1', tone: 1, label: '第一声' }),
      expect.objectContaining({ display: 'má', numbered: 'ma2', tone: 2, label: '第二声' }),
      expect.objectContaining({ display: 'mǎ', numbered: 'ma3', tone: 3, label: '第三声' }),
      expect.objectContaining({ display: 'mà', numbered: 'ma4', tone: 4, label: '第四声' }),
      expect.objectContaining({ display: 'ma', numbered: 'ma5', tone: 5, label: '轻声' }),
    ]);
  });

  it.each([
    ['ma1', 1, 'tone-1'],
    ['ma2', 2, 'tone-2'],
    ['ma3', 3, 'tone-3'],
    ['ma4', 4, 'tone-4'],
    ['ma5', 5, 'tone-5'],
  ] as const)('maps %s to tone %s without inference', (targetSyllable, tone, correctOptionId) => {
    const exercise = buildToneChoiceExercise({
      activityId: `tone-${tone}`,
      targetSyllable,
    });
    expect(exercise).toMatchObject({ correctOptionId, targetTone: tone });
  });

  it('treats an unmarked syllable as neutral tone', () => {
    expect(toneChoiceDemoExercise).toMatchObject({
      correctOptionId: 'tone-5',
      targetTone: 5,
      prompt: { display: 'ma', numbered: 'ma5' },
    });
  });

  it('provides a spoken label for every option', () => {
    expect(
      toneChoiceDemoExercise.options.every(
        (option) =>
          option.accessibilityLabel.includes(option.display) &&
          option.accessibilityLabel.includes(option.label),
      ),
    ).toBe(true);
  });

  it('offers supportive retry after a wrong tone', () => {
    const wrong = selectToneChoiceOption(toneChoiceDemoExercise, createToneChoiceState(), 'tone-1');
    expect(wrong.status).toBe('incorrect-feedback');
    expect(retryToneChoice(wrong)).toMatchObject({
      retryCount: 1,
      selectedOptionId: null,
      status: 'awaiting-answer',
    });
  });

  it('locks a correct result and rejects unknown tones', () => {
    const correct = selectToneChoiceOption(
      toneChoiceDemoExercise,
      createToneChoiceState(),
      toneChoiceDemoExercise.correctOptionId,
    );
    expect(correct.status).toBe('correct-feedback');
    expect(
      selectToneChoiceOption(
        toneChoiceDemoExercise,
        correct,
        toneChoiceDemoExercise.correctOptionId,
      ),
    ).toBe(correct);
    expect(() =>
      selectToneChoiceOption(toneChoiceDemoExercise, createToneChoiceState(), 'tone-unknown'),
    ).toThrow(/does not belong/);
  });

  it('rejects invalid Pinyin and stays deterministic', () => {
    expect(() =>
      buildToneChoiceExercise({ activityId: 'invalid', targetSyllable: 'not-pinyin' }),
    ).toThrow(/Invalid target/);
    expect(buildToneOptionTable('ma')).toEqual(buildToneOptionTable('ma'));
  });

  it('uses large responsive targets and contains no dialect judgment', () => {
    expect(toneChoiceLayout(320)).toEqual({ columns: 1, minimumOptionHeight: 88 });
    expect(toneChoiceLayout(390).columns).toBe(2);
    expect(JSON.stringify(toneChoiceDemoExercise)).not.toMatch(/dialect|accent|方言|口音/i);
  });
});
