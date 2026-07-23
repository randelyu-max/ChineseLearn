import { describe, expect, it } from 'vitest';

import { exerciseBktParameters, masteryBounds, updateMastery } from './bkt.ts';
import {
  calculatePinyinEvidenceWeighting,
  evidenceAxes,
  PINYIN_EVIDENCE_ALGORITHM_VERSION,
  pinyinSupportEvidenceWeights,
  pinyinSupportLevels,
  type EvidenceAxis,
  type PinyinSupportLevel,
} from './evidence.ts';

const hanziDependentAxes: readonly EvidenceAxis[] = [
  'hanzi_recognition',
  'word_reading',
  'sentence_reading',
];

const nonHanziAxes: readonly EvidenceAxis[] = [
  'spoken_audio_comprehension',
  'pinyin_recognition',
  'tone_discrimination',
];

function evidence(
  pinyinSupport: PinyinSupportLevel,
  axis: EvidenceAxis = 'hanzi_recognition',
  baseQuality = 0.8,
  isCorrect = true,
) {
  return calculatePinyinEvidenceWeighting({
    axis,
    baseQuality,
    isCorrect,
    pinyinSupport,
  });
}

describe('Pinyin-support evidence weighting', () => {
  it('has an explicit version and documented monotonically decreasing support weights', () => {
    expect(PINYIN_EVIDENCE_ALGORITHM_VERSION).toBe('pinyin-evidence-v1');
    expect(pinyinSupportEvidenceWeights).toEqual({
      full_answer: 0.1,
      none: 1,
      pinyin_revealed: 0.45,
      pinyin_visible: 0.75,
    });
  });

  it('preserves no-hint quality exactly for every evidence axis', () => {
    for (const axis of evidenceAxes) {
      const result = evidence('none', axis, 0.63);
      expect(result.independentEvidenceWeight).toBe(1);
      expect(result.independentEvidenceQuality).toBe(0.63);
    }
  });

  it('keeps a correct answer correct while strictly reducing independent Hanzi evidence', () => {
    const noSupport = evidence('none');
    const visible = evidence('pinyin_visible');
    const revealed = evidence('pinyin_revealed');
    const fullAnswer = evidence('full_answer');

    expect([noSupport, visible, revealed, fullAnswer].every((result) => result.isCorrect)).toBe(
      true,
    );
    expect(noSupport.independentEvidenceQuality).toBeGreaterThan(
      visible.independentEvidenceQuality,
    );
    expect(visible.independentEvidenceQuality).toBeGreaterThan(revealed.independentEvidenceQuality);
    expect(revealed.independentEvidenceQuality).toBeGreaterThan(
      fullAnswer.independentEvidenceQuality,
    );
  });

  it('does not discount audio, Pinyin, or tone evidence', () => {
    for (const axis of nonHanziAxes) {
      for (const pinyinSupport of pinyinSupportLevels) {
        const result = evidence(pinyinSupport, axis, 0.72);
        expect(result.independentEvidenceWeight).toBe(1);
        expect(result.independentEvidenceQuality).toBe(0.72);
      }
    }
  });

  it('applies the support table to all Hanzi-dependent axes', () => {
    for (const axis of hanziDependentAxes) {
      for (const pinyinSupport of pinyinSupportLevels) {
        const result = evidence(pinyinSupport, axis, 1);
        expect(result.independentEvidenceQuality).toBe(pinyinSupportEvidenceWeights[pinyinSupport]);
      }
    }
  });

  it('is deterministic, immutable, and clamps unexpected qualities to finite bounds', () => {
    const qualities = [
      Number.NEGATIVE_INFINITY,
      -1,
      0,
      0.5,
      1,
      2,
      Number.POSITIVE_INFINITY,
      Number.NaN,
    ];

    for (const axis of evidenceAxes) {
      for (const pinyinSupport of pinyinSupportLevels) {
        for (const baseQuality of qualities) {
          const input = Object.freeze({ axis, baseQuality, isCorrect: false, pinyinSupport });
          const first = calculatePinyinEvidenceWeighting(input);
          const second = calculatePinyinEvidenceWeighting(input);
          expect(first).toEqual(second);
          expect(first.isCorrect).toBe(false);
          expect(Number.isFinite(first.independentEvidenceQuality)).toBe(true);
          expect(first.independentEvidenceQuality).toBeGreaterThanOrEqual(0);
          expect(first.independentEvidenceQuality).toBeLessThanOrEqual(1);
          expect(Object.isFrozen(first)).toBe(true);
        }
      }
    }
  });

  it('keeps BKT mastery bounded and gives hinted correct answers less learning gain', () => {
    for (const parameters of Object.values(exerciseBktParameters)) {
      for (const prior of [-1, 0.02, 0.5, 0.98, 2]) {
        for (const axis of hanziDependentAxes) {
          for (const pinyinSupport of pinyinSupportLevels) {
            const weighted = evidence(pinyinSupport, axis, 1);
            for (const isCorrect of [true, false]) {
              const update = updateMastery(
                prior,
                isCorrect,
                weighted.independentEvidenceQuality,
                parameters,
              );
              expect(update.mastery).toBeGreaterThanOrEqual(masteryBounds.minimum);
              expect(update.mastery).toBeLessThanOrEqual(masteryBounds.maximum);
            }
          }
        }
      }

      const unhinted = updateMastery(
        0.4,
        true,
        evidence('none').independentEvidenceQuality,
        parameters,
      );
      const hinted = updateMastery(
        0.4,
        true,
        evidence('pinyin_revealed').independentEvidenceQuality,
        parameters,
      );
      expect(hinted.mastery).toBeLessThan(unhinted.mastery);
    }
  });
});
