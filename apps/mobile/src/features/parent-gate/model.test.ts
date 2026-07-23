import { describe, expect, it } from 'vitest';

import {
  createParentGateState,
  gateLockDurationMs,
  gateSecondsRemaining,
  parseParentGateIntent,
  submitParentGateAnswer,
} from './model';

describe('parent gate model', () => {
  it('does not unlock from repeated taps or blank answers', () => {
    let state = createParentGateState(0);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = submitParentGateAnswer(state, '', 1_000);
      expect(result.unlocked).toBe(false);
      state = result.state;
    }
    expect(state.lockedUntilMs).toBe(1_000 + gateLockDurationMs);
  });

  it('ignores even the correct answer while locked', () => {
    const locked = {
      ...createParentGateState(0),
      lockedUntilMs: 31_000,
    };
    expect(submitParentGateAnswer(locked, '隐私设置', 2_000)).toEqual({
      state: locked,
      unlocked: false,
    });
    expect(gateSecondsRemaining(locked, 2_000)).toBe(29);
  });

  it('unlocks only the active adult challenge', () => {
    expect(submitParentGateAnswer(createParentGateState(0), ' 隐 私 设 置 ', 1_000).unlocked).toBe(
      true,
    );
  });

  it('rejects arbitrary navigation intent values', () => {
    expect(parseParentGateIntent('privacy')).toBe('privacy');
    expect(parseParentGateIntent('https://example.com')).toBeNull();
  });
});
