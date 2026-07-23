import {
  calculateRuntimePinyinEvidence,
  createPinyinSupportRuntime,
  presentPinyinSupportActivity,
  type PinyinSupportPreference,
  type PinyinSupportRuntimeState,
  type PinyinSupportSignals,
} from '@hanziquest/learning-engine';

export const adaptivePinyinDemoSignals: PinyinSupportSignals = Object.freeze({
  consecutiveErrors: 0,
  consecutiveIndependentSuccesses: 3,
  fullAnswerRevealRate: 0.1,
  recentIndependentAccuracy: 0.82,
});

export function createAdaptivePinyinDemoState(
  preference: PinyinSupportPreference,
): PinyinSupportRuntimeState {
  return createPinyinSupportRuntime(preference, adaptivePinyinDemoSignals);
}

export function adaptivePinyinUiModel(state: PinyinSupportRuntimeState) {
  const result = calculateRuntimePinyinEvidence(state, {
    axis: 'hanzi_recognition',
    baseQuality: 1,
    isCorrect: true,
  });
  const labels = {
    hidden: '拼音已隐藏',
    tap_to_reveal: '需要时可显示拼音',
    visible: '拼音正在显示',
  } as const;
  return Object.freeze({
    ...presentPinyinSupportActivity(state),
    evidenceWeight: result.evidence.independentEvidenceWeight,
    statusLabel: labels[result.presentation.presentation],
  });
}
