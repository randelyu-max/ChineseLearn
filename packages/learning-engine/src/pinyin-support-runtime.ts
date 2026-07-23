import {
  calculatePinyinEvidenceWeighting,
  type EvidenceAxis,
  type PinyinEvidenceMetadata,
  type PinyinSupportLevel,
} from './evidence.ts';
import {
  planPinyinSupport,
  type PinyinPresentationSupport,
  type PinyinSupportPreference,
  type PinyinSupportSignals,
  type PlannedPinyinSupport,
} from './pinyin-session-planner.ts';

export const PINYIN_SUPPORT_RUNTIME_ALGORITHM_VERSION = 'pinyin-support-runtime-v1' as const;

export type PinyinSupportRuntimeState = Readonly<{
  activityOverride: 'none' | 'revealed';
  algorithmVersion: typeof PINYIN_SUPPORT_RUNTIME_ALGORITHM_VERSION;
  baseDecision: PlannedPinyinSupport;
  preference: PinyinSupportPreference;
  transitionCount: number;
}>;

export type PinyinSupportActivityPresentation = Readonly<{
  allowUserReveal: boolean;
  algorithmVersion: typeof PINYIN_SUPPORT_RUNTIME_ALGORITHM_VERSION;
  evidenceSupport: PinyinSupportLevel;
  fadeStage: 0 | 1 | 2;
  presentation: PinyinPresentationSupport;
  reason: PlannedPinyinSupport['reason'] | 'user_interruption';
  showPinyin: boolean;
}>;

function decisionForAdaptiveStage(
  stage: 0 | 1 | 2,
  desired: PlannedPinyinSupport,
): PlannedPinyinSupport {
  if (stage === desired.fadeStage) return desired;
  if (stage === 1) {
    return Object.freeze({
      allowReveal: true,
      fadeStage: 1,
      initialEvidenceSupport: 'none',
      presentation: 'tap_to_reveal',
      reason: 'partial_fade',
    });
  }
  if (stage === 2) {
    return Object.freeze({
      allowReveal: false,
      fadeStage: 2,
      initialEvidenceSupport: 'none',
      presentation: 'hidden',
      reason: 'sustained_independent_success',
    });
  }
  return Object.freeze({
    allowReveal: false,
    fadeStage: 0,
    initialEvidenceSupport: 'pinyin_visible',
    presentation: 'visible',
    reason: 'support_not_yet_faded',
  });
}

export function createPinyinSupportRuntime(
  preference: PinyinSupportPreference,
  signals: PinyinSupportSignals,
): PinyinSupportRuntimeState {
  return Object.freeze({
    activityOverride: 'none',
    algorithmVersion: PINYIN_SUPPORT_RUNTIME_ALGORITHM_VERSION,
    baseDecision: planPinyinSupport(preference, signals),
    preference,
    transitionCount: 0,
  });
}

export function reconcilePinyinSupportRuntime(
  state: PinyinSupportRuntimeState,
  signals: PinyinSupportSignals,
  preference: PinyinSupportPreference = state.preference,
): PinyinSupportRuntimeState {
  const desired = planPinyinSupport(preference, signals);
  const baseDecision =
    preference === 'adaptive' &&
    desired.fadeStage > state.baseDecision.fadeStage + 1 &&
    state.preference === 'adaptive'
      ? decisionForAdaptiveStage((state.baseDecision.fadeStage + 1) as 1 | 2, desired)
      : desired;
  return Object.freeze({
    activityOverride: 'none',
    algorithmVersion: PINYIN_SUPPORT_RUNTIME_ALGORITHM_VERSION,
    baseDecision,
    preference,
    transitionCount: state.transitionCount + 1,
  });
}

export function interruptPinyinSupportFade(
  state: PinyinSupportRuntimeState,
): PinyinSupportRuntimeState {
  const canInterrupt =
    state.preference === 'tap_to_reveal' ||
    (state.preference === 'adaptive' && state.baseDecision.fadeStage > 0);
  if (!canInterrupt || state.activityOverride === 'revealed') return state;
  return Object.freeze({
    ...state,
    activityOverride: 'revealed',
    transitionCount: state.transitionCount + 1,
  });
}

export function completePinyinSupportActivity(
  state: PinyinSupportRuntimeState,
): PinyinSupportRuntimeState {
  if (state.activityOverride === 'none') return state;
  return Object.freeze({
    ...state,
    activityOverride: 'none',
    transitionCount: state.transitionCount + 1,
  });
}

export function presentPinyinSupportActivity(
  state: PinyinSupportRuntimeState,
): PinyinSupportActivityPresentation {
  if (state.activityOverride === 'revealed') {
    return Object.freeze({
      allowUserReveal: false,
      algorithmVersion: PINYIN_SUPPORT_RUNTIME_ALGORITHM_VERSION,
      evidenceSupport: 'pinyin_revealed',
      fadeStage: state.baseDecision.fadeStage,
      presentation: 'visible',
      reason: 'user_interruption',
      showPinyin: true,
    });
  }
  const showPinyin = state.baseDecision.presentation === 'visible';
  return Object.freeze({
    allowUserReveal:
      state.preference === 'tap_to_reveal' ||
      (state.preference === 'adaptive' && state.baseDecision.fadeStage > 0),
    algorithmVersion: PINYIN_SUPPORT_RUNTIME_ALGORITHM_VERSION,
    evidenceSupport: showPinyin ? 'pinyin_visible' : 'none',
    fadeStage: state.baseDecision.fadeStage,
    presentation: state.baseDecision.presentation,
    reason: state.baseDecision.reason,
    showPinyin,
  });
}

export function calculateRuntimePinyinEvidence(
  state: PinyinSupportRuntimeState,
  input: Readonly<{
    axis: EvidenceAxis;
    baseQuality: number;
    isCorrect: boolean;
  }>,
): Readonly<{
  evidence: PinyinEvidenceMetadata;
  presentation: PinyinSupportActivityPresentation;
}> {
  const presentation = presentPinyinSupportActivity(state);
  return Object.freeze({
    evidence: calculatePinyinEvidenceWeighting({
      ...input,
      pinyinSupport: presentation.evidenceSupport,
    }),
    presentation,
  });
}
