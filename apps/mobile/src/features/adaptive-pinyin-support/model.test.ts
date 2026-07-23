import {
  completePinyinSupportActivity,
  interruptPinyinSupportFade,
} from '@hanziquest/learning-engine';
import { describe, expect, it } from 'vitest';

import { adaptivePinyinUiModel, createAdaptivePinyinDemoState } from './model';

describe('adaptive Pinyin support mobile model', () => {
  it('uses the profile preference to create visible, revealable, or hidden UI', () => {
    expect(adaptivePinyinUiModel(createAdaptivePinyinDemoState('always')).showPinyin).toBe(true);
    expect(
      adaptivePinyinUiModel(createAdaptivePinyinDemoState('tap_to_reveal')).allowUserReveal,
    ).toBe(true);
    expect(adaptivePinyinUiModel(createAdaptivePinyinDemoState('hidden'))).toMatchObject({
      allowUserReveal: false,
      showPinyin: false,
      statusLabel: '拼音已隐藏',
    });
  });

  it('shows revealed Pinyin and the matching reduced evidence weight', () => {
    const revealed = interruptPinyinSupportFade(createAdaptivePinyinDemoState('adaptive'));
    expect(adaptivePinyinUiModel(revealed)).toMatchObject({
      evidenceSupport: 'pinyin_revealed',
      evidenceWeight: 0.45,
      showPinyin: true,
    });
  });

  it('clears a one-activity interruption without changing the fade stage', () => {
    const state = createAdaptivePinyinDemoState('adaptive');
    const revealed = interruptPinyinSupportFade(state);
    const next = completePinyinSupportActivity(revealed);
    expect(next.baseDecision.fadeStage).toBe(state.baseDecision.fadeStage);
    expect(adaptivePinyinUiModel(next)).toMatchObject({
      evidenceSupport: 'none',
      evidenceWeight: 1,
      showPinyin: false,
    });
  });
});
