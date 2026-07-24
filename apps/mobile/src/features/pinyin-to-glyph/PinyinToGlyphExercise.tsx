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

import { HanziText, PrimaryButton } from '@/components/ui';

import {
  pinyinToGlyphLayout,
  type PinyinToGlyphExerciseDefinition,
  type PinyinToGlyphState,
} from './model';

type Props = {
  exercise: PinyinToGlyphExerciseDefinition;
  onRetry: () => void;
  onSelectOption: (optionId: string) => void;
  state: PinyinToGlyphState;
};

export function PinyinToGlyphExercise({ exercise, onRetry, onSelectOption, state }: Props) {
  const compact = pinyinToGlyphLayout(useWindowDimensions().width).columns === 1;
  const optionsDisabled = state.status !== 'awaiting-answer';
  const correctOption = exercise.options.find(
    (option) => option.optionId === exercise.correctOptionId,
  );

  return (
    <View style={styles.container}>
      <View style={styles.promptGroup}>
        <Text accessibilityRole="header" style={styles.title}>
          看拼音，选出对应的汉字
        </Text>
        <Text style={styles.instructions}>注意声调。同音字会提供中文语境，帮助确定目标。</Text>
        <View
          accessibilityLabel={`目标拼音：${exercise.prompt.accessibilityLabel}`}
          style={styles.prompt}
        >
          <Text style={styles.promptLabel}>目标拼音</Text>
          <Text style={styles.pinyin}>{exercise.prompt.display}</Text>
          {exercise.contextHintZh ? (
            <Text accessibilityLiveRegion="polite" style={styles.contextHint}>
              {exercise.contextHintZh}
            </Text>
          ) : null}
        </View>
      </View>

      <View accessibilityLabel="汉字选项" accessibilityRole="radiogroup" style={styles.options}>
        {exercise.options.map((option) => {
          const selected = state.selectedOptionId === option.optionId;
          return (
            <Pressable
              accessibilityLabel={option.accessibilityLabel}
              aria-checked={selected}
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
              <HanziText emphasis={selected ? 'target' : 'normal'}>{option.glyph}</HanziText>
              {selected ? <Text style={styles.selectionText}>已选择</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {state.status === 'incorrect-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>再对照一下</Text>
          <Text style={styles.feedbackText}>这个字的声调或语境还不对应。看看提示，再试一次。</Text>
          <PrimaryButton label="重新选择" onPress={onRetry} />
        </View>
      ) : null}

      {state.status === 'correct-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={[styles.feedbackCard, styles.correctCard]}>
          <Text style={styles.feedbackTitle}>✓ 找到对应汉字</Text>
          <Text style={styles.feedbackText}>
            在这个语境里，{exercise.prompt.display} 对应“{correctOption?.glyph}”。
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },
  contextHint: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    textAlign: 'center',
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
    justifyContent: 'center',
    minHeight: 112,
    padding: spacing.md,
    width: '47%',
  },
  optionCompact: { width: '100%' },
  optionPressed: { backgroundColor: colors.surfaceMuted },
  optionSelected: { borderColor: colors.primary, borderWidth: borders.focus },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  pinyin: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display,
  },
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
});
