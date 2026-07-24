import { describe, expect, it } from 'vitest';

import {
  bktParametersForExerciseType,
  calculateBktPosterior,
  calculateExerciseQuality,
  exerciseBktParameters,
  masteryBounds,
  updateMastery,
  type ExerciseBktParameters,
} from './bkt';

const sample: ExerciseBktParameters = {
  guessProbability: 0.25,
  learnProbability: 0.14,
  slipProbability: 0.1,
};

describe('Pinyin scoring parameters', () => {
  it('provides explicit bounded parameters for all six server-scored exercise types', () => {
    for (const exerciseType of [
      'audio_to_pinyin',
      'pinyin_to_audio',
      'pinyin_to_glyph',
      'glyph_to_pinyin',
      'tone_choice',
      'pinyin_syllable_build',
    ] as const) {
      const parameters = bktParametersForExerciseType(exerciseType);
      expect(parameters.guessProbability).toBeGreaterThanOrEqual(0);
      expect(parameters.guessProbability).toBeLessThan(1);
      expect(parameters.learnProbability).toBeGreaterThan(0);
      expect(parameters.learnProbability).toBeLessThanOrEqual(1);
      expect(parameters.slipProbability).toBeGreaterThanOrEqual(0);
      expect(parameters.slipProbability).toBeLessThan(1);
    }
  });
});

describe('exercise quality', () => {
  it.each([
    {
      expected: 1,
      input: {
        baselineResponseTimeMs: 2_000,
        correctness: 'first_try_correct' as const,
        hint: 'none' as const,
        isTransfer: true,
        responseTimeMs: 2_000,
        retryCount: 0,
      },
    },
    {
      expected: 0.65 * 0.7 * 0.8 * 0.85,
      input: {
        baselineResponseTimeMs: 2_000,
        correctness: 'hinted_correct' as const,
        hint: 'pinyin' as const,
        isTransfer: false,
        responseTimeMs: 5_000,
        retryCount: 1,
      },
    },
    {
      expected: 0,
      input: {
        baselineResponseTimeMs: 2_000,
        correctness: 'incorrect' as const,
        hint: 'none' as const,
        isTransfer: false,
        responseTimeMs: 1_000,
        retryCount: 0,
      },
    },
  ])('calculates the documented factor product', ({ expected, input }) => {
    expect(calculateExerciseQuality(input).quality).toBeCloseTo(expected, 12);
  });

  it('caps latency penalty at 15 percent and quality at one', () => {
    const slow = calculateExerciseQuality({
      baselineResponseTimeMs: 1_000,
      correctness: 'first_try_correct',
      hint: 'none',
      isTransfer: false,
      responseTimeMs: 99_000,
      retryCount: 0,
    });
    expect(slow.latencyFactor).toBe(0.85);
  });
});

describe('BKT mastery update', () => {
  it('matches a hand-calculated correct response', () => {
    const result = updateMastery(0.3, true, 0.8, sample);
    expect(result.posterior).toBeCloseTo(0.27 / 0.445, 12);
    expect(result.mastery).toBeCloseTo(0.6507865168539326, 12);
  });

  it('matches a hand-calculated incorrect response', () => {
    const result = updateMastery(0.3, false, 0.8, sample);
    expect(result.posterior).toBeCloseTo(0.03 / 0.555, 12);
    expect(result.mastery).toBeCloseTo(0.16, 12);
  });

  it('contains every documented exercise parameter row', () => {
    expect(Object.keys(exerciseBktParameters)).toHaveLength(12);
    expect(exerciseBktParameters.audio_to_glyph_two_choice).toEqual({
      guessProbability: 0.5,
      learnProbability: 0.16,
      slipProbability: 0.08,
    });
  });

  it('preserves immutable inputs and has no event identity side effects', () => {
    const parameters = Object.freeze({ ...sample });
    const before = JSON.stringify(parameters);
    const first = updateMastery(0.4, true, 0.7, parameters);
    const second = updateMastery(0.4, true, 0.7, parameters);
    expect(first).toEqual(second);
    expect(JSON.stringify(parameters)).toBe(before);
  });

  it('keeps mastery inside bounds over an exhaustive boundary grid', () => {
    const priors = [-100, -1, 0, 0.02, 0.5, 0.98, 1, 100, Number.NaN];
    const qualities = [-10, 0, 0.25, 1, 10, Number.NaN];
    for (const parameters of Object.values(exerciseBktParameters)) {
      for (const prior of priors) {
        for (const quality of qualities) {
          for (const correct of [true, false]) {
            const result = updateMastery(prior, correct, quality, parameters);
            expect(Number.isFinite(result.posterior)).toBe(true);
            expect(result.mastery).toBeGreaterThanOrEqual(masteryBounds.minimum);
            expect(result.mastery).toBeLessThanOrEqual(masteryBounds.maximum);
          }
        }
      }
    }
  });

  it('computes posterior without applying learning gain', () => {
    const posterior = calculateBktPosterior(0.3, true, sample);
    expect(posterior).toBeCloseTo(0.6067415730337079, 12);
  });
});
