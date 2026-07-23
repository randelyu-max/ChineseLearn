import { describe, expect, it } from 'vitest';

import {
  buildPinyinToGlyphExercise,
  createPinyinToGlyphState,
  pinyinToGlyphDemoExercise,
  pinyinToGlyphLayout,
  retryPinyinToGlyph,
  selectPinyinToGlyphOption,
} from './model';

const candidates = [
  {
    accessibilityLabel: '马，骑马的马',
    glyph: '马',
    numbered: 'ma3',
    optionId: '54000000-0000-4000-8000-000000000021',
  },
  {
    accessibilityLabel: '码，号码的码',
    glyph: '码',
    numbered: 'ma3',
    optionId: '54000000-0000-4000-8000-000000000022',
  },
  {
    accessibilityLabel: '妈，妈妈的妈',
    glyph: '妈',
    numbered: 'ma1',
    optionId: '54000000-0000-4000-8000-000000000023',
  },
  {
    accessibilityLabel: '麻，麻布的麻',
    glyph: '麻',
    numbered: 'ma2',
    optionId: '54000000-0000-4000-8000-000000000024',
  },
  {
    accessibilityLabel: '骂，责骂的骂',
    glyph: '骂',
    numbered: 'ma4',
    optionId: '54000000-0000-4000-8000-000000000025',
  },
] as const;

function build(seed = 'fixed-seed') {
  return buildPinyinToGlyphExercise({
    activityId: '54000000-0000-4000-8000-000000000030',
    candidates,
    contextHintZh: '提示：这个字出现在“骑 ___”里。',
    seed,
    targetOptionId: candidates[0].optionId,
  });
}

describe('pinyin_to_glyph interaction model', () => {
  it('builds deterministic tone-aware options for a fixed seed', () => {
    const exercise = build();
    expect(exercise).toEqual(build());
    expect(exercise.options).toHaveLength(4);
    expect(exercise.options).toEqual(
      expect.arrayContaining([expect.objectContaining({ numbered: 'ma3', glyph: '码' })]),
    );
    expect(
      exercise.options
        .filter((option) => option.numbered !== 'ma3')
        .every((option) => option.numbered.startsWith('ma') && option.tone !== 3),
    ).toBe(true);
  });

  it('keeps the target mapping stable across option-order seeds', () => {
    const exercises = ['seed-a', 'seed-b', 'seed-c', 'seed-d'].map(build);
    expect(exercises.every((exercise) => exercise.correctOptionId === candidates[0].optionId)).toBe(
      true,
    );
    expect(
      new Set(exercises.map((exercise) => exercise.options.map((item) => item.optionId).join(',')))
        .size,
    ).toBeGreaterThan(1);
  });

  it('requires context when exact-reading homophones make the prompt ambiguous', () => {
    expect(() =>
      buildPinyinToGlyphExercise({
        activityId: 'ambiguous',
        candidates,
        seed: 'fixed',
        targetOptionId: candidates[0].optionId,
      }),
    ).toThrow(/Ambiguous/);
    expect(build().contextHintZh).toContain('骑');
  });

  it('keeps an exact-reading distractor wrong when context identifies the target', () => {
    const homophone = build().options.find((option) => option.glyph === '码')!;
    const wrong = selectPinyinToGlyphOption(
      build(),
      createPinyinToGlyphState(),
      homophone.optionId,
    );
    expect(wrong.status).toBe('incorrect-feedback');
    expect(build().correctOptionId).toBe(candidates[0].optionId);
  });

  it('normalizes the prompt and gives every glyph a spoken context label', () => {
    expect(pinyinToGlyphDemoExercise.prompt).toMatchObject({
      accessibilityLabel: 'mǎ，第三声',
      display: 'mǎ',
      numbered: 'ma3',
      tone: 3,
    });
    expect(
      pinyinToGlyphDemoExercise.options.every(
        (option) => option.accessibilityLabel.length > option.glyph.length,
      ),
    ).toBe(true);
  });

  it('offers supportive retry after a wrong choice', () => {
    const wrongOption = build().options.find(
      (option) => option.optionId !== build().correctOptionId,
    )!;
    const wrong = selectPinyinToGlyphOption(
      build(),
      createPinyinToGlyphState(),
      wrongOption.optionId,
    );
    expect(retryPinyinToGlyph(wrong)).toMatchObject({
      retryCount: 1,
      selectedOptionId: null,
      status: 'awaiting-answer',
    });
  });

  it('locks the stable correct result and rejects options outside the exercise', () => {
    const correct = selectPinyinToGlyphOption(
      build(),
      createPinyinToGlyphState(),
      build().correctOptionId,
    );
    expect(correct.status).toBe('correct-feedback');
    expect(selectPinyinToGlyphOption(build(), correct, build().correctOptionId)).toBe(correct);
    expect(() => selectPinyinToGlyphOption(build(), createPinyinToGlyphState(), 'unknown')).toThrow(
      /does not belong/,
    );
  });

  it('rejects invalid glyph, Pinyin, duplicate glyph, and undersized content', () => {
    expect(() =>
      buildPinyinToGlyphExercise({
        activityId: 'invalid-glyph',
        candidates: [{ ...candidates[0], glyph: '骑马' }, ...candidates.slice(1)],
        contextHintZh: '有语境',
        seed: 'fixed',
        targetOptionId: candidates[0].optionId,
      }),
    ).toThrow(/one Han glyph/);
    expect(() =>
      buildPinyinToGlyphExercise({
        activityId: 'invalid-pinyin',
        candidates: [{ ...candidates[0], numbered: 'invalid' }, ...candidates.slice(1)],
        contextHintZh: '有语境',
        seed: 'fixed',
        targetOptionId: candidates[0].optionId,
      }),
    ).toThrow(/Invalid Pinyin/);
    expect(() =>
      buildPinyinToGlyphExercise({
        activityId: 'duplicate',
        candidates: [{ ...candidates[0], glyph: candidates[1].glyph }, ...candidates.slice(1)],
        contextHintZh: '有语境',
        seed: 'fixed',
        targetOptionId: candidates[0].optionId,
      }),
    ).toThrow(/distinct Han glyphs/);
    expect(() =>
      buildPinyinToGlyphExercise({
        activityId: 'small',
        candidates: candidates.slice(0, 2),
        contextHintZh: '有语境',
        seed: 'fixed',
        targetOptionId: candidates[0].optionId,
      }),
    ).toThrow(/at least 4/);
  });

  it('uses large responsive glyph targets and has no translation field', () => {
    expect(pinyinToGlyphLayout(320)).toEqual({ columns: 1, minimumOptionHeight: 112 });
    expect(pinyinToGlyphLayout(390).columns).toBe(2);
    expect(JSON.stringify(pinyinToGlyphDemoExercise)).not.toMatch(/translation|meaningEn/);
  });
});
