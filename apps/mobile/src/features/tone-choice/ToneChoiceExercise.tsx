import {
  borders,
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
} from '@hanziquest/design-tokens';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { PrimaryButton } from '@/components/ui';

import {
  toneChoiceLabel,
  toneChoiceLayout,
  type ToneChoiceExerciseDefinition,
  type ToneChoiceState,
} from './model';

type Props = {
  exercise: ToneChoiceExerciseDefinition;
  onRetry: () => void;
  onSelectOption: (optionId: string) => void;
  state: ToneChoiceState;
};

export function ToneChoiceExercise({ exercise, onRetry, onSelectOption, state }: Props) {
  const compact = toneChoiceLayout(useWindowDimensions().width).columns === 1;
  const optionsDisabled = state.status !== 'awaiting-answer';

  return (
    <View style={styles.container}>
      <View style={styles.promptGroup}>
        <Text accessibilityRole="header" style={styles.title}>
          选出拼音的声调
        </Text>
        <Text style={styles.instructions}>观察元音上的调号。没有调号时，也可能是轻声。</Text>
        <View accessibilityLabel={exercise.prompt.accessibilityLabel} style={styles.prompt}>
          <Text style={styles.promptLabel}>目标拼音</Text>
          <Text style={styles.promptPinyin}>{exercise.prompt.display}</Text>
          {exercise.contextZh ? (
            <Text style={styles.context}>语境：{exercise.contextZh}</Text>
          ) : null}
        </View>
      </View>

      <View accessibilityLabel="声调选项" accessibilityRole="radiogroup" style={styles.options}>
        {exercise.options.map((option) => {
          const selected = state.selectedOptionId === option.optionId;
          return (
            <Pressable
              accessibilityLabel={option.accessibilityLabel}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: optionsDisabled }}
              disabled={optionsDisabled}
              key={option.optionId}
              onPress={() => onSelectOption(option.optionId)}
              style={({ pressed }) => [
                styles.option,
                compact && styles.optionCompact,
                selected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <Text style={styles.optionPinyin}>{option.display}</Text>
              <Text style={styles.toneLabel}>{option.label}</Text>
              {selected ? <Text style={styles.selectionText}>已选择</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {state.status === 'incorrect-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>再看一次调号</Text>
          <Text style={styles.feedbackText}>
            这个声调还不对应目标拼音。对照五个选项，再试一次。
          </Text>
          <PrimaryButton label="重新选择" onPress={onRetry} />
        </View>
      ) : null}

      {state.status === 'correct-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={[styles.feedbackCard, styles.correctCard]}>
          <Text style={styles.feedbackTitle}>✓ 声调对应正确</Text>
          <Text style={styles.feedbackText}>
            {exercise.prompt.display} 在这道题里是 {toneChoiceLabel(exercise.targetTone)}。
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },
  context: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  correctCard: { backgroundColor: colors.successSurface, borderColor: colors.success },
  feedbackCard: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warning,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    gap: spacing.md,
    padding: spacing.lg,
  },
  feedbackText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  feedbackTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.bodyLarge,
  },
  instructions: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 2,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 88,
    padding: spacing.md,
    width: '47%',
  },
  optionCompact: { width: '100%' },
  optionPinyin: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.heading,
  },
  optionPressed: { backgroundColor: colors.surfaceMuted },
  optionSelected: { borderColor: colors.primary, borderWidth: borders.focus },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  prompt: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  promptGroup: { gap: spacing.md },
  promptLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
  },
  promptPinyin: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display,
  },
  selectionText: {
    color: colors.primary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
  },
  toneLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
});
