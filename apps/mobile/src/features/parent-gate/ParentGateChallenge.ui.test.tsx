import { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { ParentGateChallenge } from './ParentGateChallenge';

vi.mock('../../components/ui', () => ({
  PrimaryButton: 'PrimaryButton',
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Platform: { select: (values: Record<string, unknown>) => values.default },
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('ParentGateChallenge UI', () => {
  it('exposes an accessible input and unlocks only after the correct answer', () => {
    const onUnlock = vi.fn();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <ParentGateChallenge initialChallengeIndex={0} now={() => 1_000} onUnlock={onUnlock} />,
      );
    });

    const input = renderer!.root.findByProps({ accessibilityLabel: '家长回答' });
    const submit = renderer!.root.findByProps({ testID: 'parent-gate-submit' });
    act(() => input.props.onChangeText('错误答案'));
    act(() => submit.props.onPress());
    expect(onUnlock).not.toHaveBeenCalled();

    act(() => input.props.onChangeText('隐私设置'));
    act(() => submit.props.onPress());
    expect(onUnlock).toHaveBeenCalledTimes(1);
    act(() => renderer!.unmount());
  });

  it('locks the control after three rapid blank submissions', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <ParentGateChallenge
          initialChallengeIndex={0}
          now={() => 2_000}
          onUnlock={() => undefined}
        />,
      );
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const submit = renderer!.root.findByProps({ testID: 'parent-gate-submit' });
      act(() => submit.props.onPress());
    }
    const disabledSubmit = renderer!.root.findByProps({
      testID: 'parent-gate-submit',
    });
    expect(disabledSubmit.props.disabled).toBe(true);
    act(() => renderer!.unmount());
  });
});
