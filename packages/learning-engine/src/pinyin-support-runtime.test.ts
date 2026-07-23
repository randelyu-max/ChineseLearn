import { describe, expect, it } from 'vitest';

import {
  calculateRuntimePinyinEvidence,
  completePinyinSupportActivity,
  createPinyinSupportRuntime,
  interruptPinyinSupportFade,
  PINYIN_SUPPORT_RUNTIME_ALGORITHM_VERSION,
  presentPinyinSupportActivity,
  reconcilePinyinSupportRuntime,
} from './pinyin-support-runtime.ts';
import type { PinyinSupportPreference, PinyinSupportSignals } from './pinyin-session-planner.ts';

const visibleSignals: PinyinSupportSignals = {
  consecutiveErrors: 0,
  consecutiveIndependentSuccesses: 0,
  fullAnswerRevealRate: 0.2,
  recentIndependentAccuracy: 0.7,
};
const hiddenSignals: PinyinSupportSignals = {
  consecutiveErrors: 0,
  consecutiveIndependentSuccesses: 7,
  fullAnswerRevealRate: 0,
  recentIndependentAccuracy: 0.96,
};

describe('adaptive Pinyin support runtime', () => {
  it('has an explicit version and begins from the planner decision', () => {
    const state = createPinyinSupportRuntime('adaptive', visibleSignals);
    expect(state).toMatchObject({
      activityOverride: 'none',
      algorithmVersion: PINYIN_SUPPORT_RUNTIME_ALGORITHM_VERSION,
      baseDecision: { fadeStage: 0, presentation: 'visible' },
      transitionCount: 0,
    });
    expect(Object.isFrozen(state)).toBe(true);
  });

  it('fades at most one stage per reconciliation', () => {
    const visible = createPinyinSupportRuntime('adaptive', visibleSignals);
    const partial = reconcilePinyinSupportRuntime(visible, hiddenSignals);
    const hidden = reconcilePinyinSupportRuntime(partial, hiddenSignals);
    expect(partial.baseDecision).toMatchObject({ fadeStage: 1, presentation: 'tap_to_reveal' });
    expect(hidden.baseDecision).toMatchObject({ fadeStage: 2, presentation: 'hidden' });
  });

  it('immediately re-enables visible Pinyin after frustration', () => {
    const hidden = createPinyinSupportRuntime('adaptive', hiddenSignals);
    const recovered = reconcilePinyinSupportRuntime(hidden, {
      ...hiddenSignals,
      consecutiveErrors: 2,
    });
    expect(recovered.baseDecision).toMatchObject({
      fadeStage: 0,
      presentation: 'visible',
      reason: 'frustration_recovery',
    });
  });

  it('lets the user interrupt a fade for one activity only', () => {
    const partial = createPinyinSupportRuntime('adaptive', {
      ...visibleSignals,
      consecutiveIndependentSuccesses: 3,
      recentIndependentAccuracy: 0.82,
    });
    const revealed = interruptPinyinSupportFade(partial);
    expect(presentPinyinSupportActivity(revealed)).toMatchObject({
      evidenceSupport: 'pinyin_revealed',
      presentation: 'visible',
      reason: 'user_interruption',
      showPinyin: true,
    });
    expect(presentPinyinSupportActivity(completePinyinSupportActivity(revealed))).toMatchObject({
      evidenceSupport: 'none',
      presentation: 'tap_to_reveal',
      showPinyin: false,
    });
  });

  it('keeps UI visibility and Hanzi evidence support in agreement', () => {
    const states = [
      createPinyinSupportRuntime('always', hiddenSignals),
      createPinyinSupportRuntime('adaptive', visibleSignals),
      createPinyinSupportRuntime('adaptive', hiddenSignals),
      createPinyinSupportRuntime('tap_to_reveal', visibleSignals),
      createPinyinSupportRuntime('hidden', visibleSignals),
      interruptPinyinSupportFade(createPinyinSupportRuntime('tap_to_reveal', visibleSignals)),
    ];
    for (const state of states) {
      const result = calculateRuntimePinyinEvidence(state, {
        axis: 'hanzi_recognition',
        baseQuality: 1,
        isCorrect: true,
      });
      expect(result.evidence.pinyinSupport).toBe(result.presentation.evidenceSupport);
      expect(result.presentation.showPinyin).toBe(result.presentation.evidenceSupport !== 'none');
      expect(result.evidence.independentEvidenceWeight).toBe(
        result.presentation.evidenceSupport === 'none'
          ? 1
          : result.presentation.evidenceSupport === 'pinyin_visible'
            ? 0.75
            : 0.45,
      );
    }
  });

  it('honors explicit preferences and does not reveal explicit hidden mode', () => {
    const preferences: readonly PinyinSupportPreference[] = ['always', 'tap_to_reveal', 'hidden'];
    expect(
      preferences.map(
        (preference) =>
          presentPinyinSupportActivity(createPinyinSupportRuntime(preference, hiddenSignals))
            .presentation,
      ),
    ).toEqual(['visible', 'tap_to_reveal', 'hidden']);
    const hidden = createPinyinSupportRuntime('hidden', visibleSignals);
    expect(interruptPinyinSupportFade(hidden)).toBe(hidden);
  });

  it('applies preference changes immediately and clears per-activity overrides', () => {
    const revealed = interruptPinyinSupportFade(
      createPinyinSupportRuntime('tap_to_reveal', visibleSignals),
    );
    const always = reconcilePinyinSupportRuntime(revealed, hiddenSignals, 'always');
    expect(always).toMatchObject({
      activityOverride: 'none',
      preference: 'always',
      baseDecision: { presentation: 'visible' },
    });
  });

  it('is deterministic and does not mutate prior state', () => {
    const state = createPinyinSupportRuntime('adaptive', visibleSignals);
    const before = JSON.stringify(state);
    expect(reconcilePinyinSupportRuntime(state, hiddenSignals)).toEqual(
      reconcilePinyinSupportRuntime(state, hiddenSignals),
    );
    expect(JSON.stringify(state)).toBe(before);
  });
});
