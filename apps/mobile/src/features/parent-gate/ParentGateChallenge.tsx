import {
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
} from '@hanziquest/design-tokens';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '../../components/ui';

import {
  createParentGateState,
  gateSecondsRemaining,
  parentGateChallenges,
  submitParentGateAnswer,
  type ParentGateState,
} from './model';

export function ParentGateChallenge({
  initialChallengeIndex,
  gateState,
  now = Date.now,
  onStateChange,
  onUnlock,
}: {
  gateState?: ParentGateState;
  initialChallengeIndex?: number;
  now?: () => number;
  onStateChange?(state: ParentGateState): void;
  onUnlock(): void;
}) {
  const [internalState, setInternalState] = useState(() =>
    createParentGateState(initialChallengeIndex ?? Math.floor(now() / 60_000)),
  );
  const state = gateState ?? internalState;
  const setState = onStateChange ?? setInternalState;
  const [answer, setAnswer] = useState('');
  const [clock, setClock] = useState(() => now());
  const [feedback, setFeedback] = useState<string | null>(null);
  const remaining = gateSecondsRemaining(state, clock);
  const locked = remaining > 0;
  const challenge = parentGateChallenges[state.challengeIndex];

  useEffect(() => {
    if (!locked) return;
    const timer = setInterval(() => setClock(now()), 1_000);
    return () => clearInterval(timer);
  }, [locked, now]);

  const attemptsRemaining = useMemo(
    () => Math.max(0, 3 - state.failedAttempts),
    [state.failedAttempts],
  );

  const submit = () => {
    const result = submitParentGateAnswer(state, answer, now());
    setState(result.state);
    setClock(now());
    setAnswer('');
    if (result.unlocked) {
      setFeedback(null);
      onUnlock();
      return;
    }
    setFeedback(
      result.state.lockedUntilMs
        ? '回答次数较多，请稍后再试。'
        : `答案不正确，还可尝试 ${Math.max(0, attemptsRemaining - 1)} 次。`,
    );
  };

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>
        家长验证
      </Text>
      <Text style={styles.description}>
        此步骤保护购买、设置、隐私和外部链接，不会询问账户资料。
      </Text>
      <Text accessibilityLabel="家长挑战题" style={styles.prompt}>
        {challenge.prompt}
      </Text>
      <TextInput
        accessibilityLabel="家长回答"
        autoCapitalize="none"
        autoComplete="off"
        editable={!locked}
        onChangeText={setAnswer}
        onSubmitEditing={submit}
        placeholder="请输入答案"
        placeholderTextColor={colors.disabled}
        style={styles.input}
        value={answer}
      />
      {locked ? (
        <Text accessibilityLiveRegion="polite" style={styles.feedback}>
          已暂时锁定，请等待 {remaining} 秒。
        </Text>
      ) : feedback ? (
        <Text accessibilityLiveRegion="polite" style={styles.feedback}>
          {feedback}
        </Text>
      ) : null}
      <PrimaryButton
        disabled={locked}
        label="验证并继续"
        onPress={submit}
        testID="parent-gate-submit"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  description: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    textAlign: 'center',
  },
  feedback: {
    color: colors.danger,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  prompt: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.bodyLarge,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
    textAlign: 'center',
  },
});
