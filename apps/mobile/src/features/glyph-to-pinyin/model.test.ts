import { describe, expect, it } from 'vitest';

import {
  buildGlyphToPinyinExercise,
  createGlyphToPinyinState,
  glyphToPinyinDemoExercise,
  glyphToPinyinLayout,
  requestGlyphToPinyinHint,
  retryGlyphToPinyin,
  selectGlyphToPinyinOption,
} from './model';

const candidates = [
  { numbered: 'hang2', optionId: '55000000-0000-4000-8000-000000000021' },
  { numbered: 'xing2', optionId: '55000000-0000-4000-8000-000000000022' },
  { numbered: 'hang4', optionId: '55000000-0000-4000-8000-000000000023' },
  { numbered: 'hen3', optionId: '55000000-0000-4000-8000-000000000024' },
  { numbered: 'xin4', optionId: '55000000-0000-4000-8000-000000000025' },
] as const;

function build(seed = 'fixed-seed') {
  return buildGlyphToPinyinExercise({
    acceptedReadings: ['hang2'],
    activityId: '55000000-0000-4000-8000-000000000030',
    candidates,
    contextZh: '银行',
    hintZh: '这里说的是和钱有关的机构。',
    knownGlyphReadings: ['xing2', 'hang2'],
    seed,
    targetGlyph: '行',
  });
}

describe('glyph_to_pinyin interaction model', () => {
  it('uses explicitly declared accepted readings and deterministic options', () => {
    const exercise = build();
    expect(exercise).toEqual(build());
    expect(exercise.acceptedReadings).toEqual(['hang2']);
    expect(exercise.acceptedOptionIds).toEqual([candidates[0].optionId]);
    expect(exercise.options).toHaveLength(4);
  });

  it('keeps the alternate polyphone reading as a priority distractor', () => {
    expect(build().options).toEqual(
      expect.arrayContaining([expect.objectContaining({ numbered: 'xing2', display: 'xíng' })]),
    );
    const alternate = build().options.find((option) => option.numbered === 'xing2')!;
    expect(
      selectGlyphToPinyinOption(build(), createGlyphToPinyinState(), alternate.optionId).status,
    ).toBe('incorrect-feedback');
  });

  it('requires target-containing context for a polyphonic glyph', () => {
    expect(() =>
      buildGlyphToPinyinExercise({
        acceptedReadings: ['hang2'],
        activityId: 'missing-context',
        candidates,
        knownGlyphReadings: ['xing2', 'hang2'],
        seed: 'fixed',
        targetGlyph: '行',
      }),
    ).toThrow(/context/);
    expect(() =>
      buildGlyphToPinyinExercise({
        acceptedReadings: ['hang2'],
        activityId: 'wrong-context',
        candidates,
        contextZh: '钱庄',
        knownGlyphReadings: ['xing2', 'hang2'],
        seed: 'fixed',
        targetGlyph: '行',
      }),
    ).toThrow(/target glyph/);
  });

  it('never infers an accepted reading from candidate order', () => {
    const reordered = buildGlyphToPinyinExercise({
      acceptedReadings: ['hang2'],
      activityId: 'reordered',
      candidates: [...candidates].reverse(),
      contextZh: '银行',
      knownGlyphReadings: ['xing2', 'hang2'],
      seed: 'fixed',
      targetGlyph: '行',
    });
    expect(reordered.acceptedOptionIds).toEqual([candidates[0].optionId]);
  });

  it('normalizes choices and provides spoken tone labels', () => {
    const correct = glyphToPinyinDemoExercise.options.find((option) =>
      glyphToPinyinDemoExercise.acceptedOptionIds.includes(option.optionId),
    )!;
    expect(correct).toMatchObject({
      accessibilityLabel: 'háng，第二声',
      display: 'háng',
      numbered: 'hang2',
      tone: 2,
    });
  });

  it('reveals a hint on request or after an incorrect answer', () => {
    expect(requestGlyphToPinyinHint(createGlyphToPinyinState()).hintVisible).toBe(true);
    const wrongOption = build().options.find(
      (option) => !build().acceptedOptionIds.includes(option.optionId),
    )!;
    const wrong = selectGlyphToPinyinOption(
      build(),
      createGlyphToPinyinState(),
      wrongOption.optionId,
    );
    expect(wrong).toMatchObject({ hintVisible: true, status: 'incorrect-feedback' });
    expect(retryGlyphToPinyin(wrong)).toMatchObject({
      hintVisible: true,
      retryCount: 1,
      selectedOptionId: null,
      status: 'awaiting-answer',
    });
  });

  it('locks a correct result and rejects unknown options', () => {
    const correct = selectGlyphToPinyinOption(
      build(),
      createGlyphToPinyinState(),
      build().acceptedOptionIds[0]!,
    );
    expect(correct.status).toBe('correct-feedback');
    expect(selectGlyphToPinyinOption(build(), correct, build().acceptedOptionIds[0]!)).toBe(
      correct,
    );
    expect(() => selectGlyphToPinyinOption(build(), createGlyphToPinyinState(), 'unknown')).toThrow(
      /does not belong/,
    );
  });

  it('rejects invalid reading declarations and candidate sets', () => {
    expect(() =>
      buildGlyphToPinyinExercise({
        acceptedReadings: ['ma3'],
        activityId: 'not-known',
        candidates,
        contextZh: '银行',
        knownGlyphReadings: ['xing2', 'hang2'],
        seed: 'fixed',
        targetGlyph: '行',
      }),
    ).toThrow(/declared reading/);
    expect(() =>
      buildGlyphToPinyinExercise({
        acceptedReadings: ['hang2'],
        activityId: 'not-selectable',
        candidates: candidates.slice(1),
        contextZh: '银行',
        knownGlyphReadings: ['xing2', 'hang2'],
        seed: 'fixed',
        targetGlyph: '行',
      }),
    ).toThrow(/selectable option/);
    expect(() =>
      buildGlyphToPinyinExercise({
        acceptedReadings: ['hang2'],
        activityId: 'bad-glyph',
        candidates,
        contextZh: '银行',
        knownGlyphReadings: ['xing2', 'hang2'],
        seed: 'fixed',
        targetGlyph: '银行',
      }),
    ).toThrow(/one Han glyph/);
  });

  it('uses large responsive options and keeps Pinyin out of the prompt model', () => {
    expect(glyphToPinyinLayout(320)).toEqual({ columns: 1, minimumOptionHeight: 88 });
    expect(glyphToPinyinLayout(390).columns).toBe(2);
    expect(glyphToPinyinDemoExercise).not.toHaveProperty('promptPinyin');
    expect(JSON.stringify(glyphToPinyinDemoExercise)).not.toMatch(/ruby/i);
  });
});
