import {
  borders,
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
  touchTargets,
} from '@hanziquest/design-tokens';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { HanziText, PrimaryButton } from '@/components/ui';

import {
  glyphToPinyinLayout,
  glyphToPinyinToneLabel,
  type GlyphToPinyinExerciseDefinition,
  type GlyphToPinyinState,
} from './model';

type Props = {
  exercise: GlyphToPinyinExerciseDefinition;
  onHint: () => void;
  onRetry: () => void;
  onSelectOption: (optionId: string) => void;
  state: GlyphToPinyinState;
};

export function GlyphToPinyinExercise({ exercise, onHint, onRetry, onSelectOption, state }: Props) {
  const compact = glyphToPinyinLayout(useWindowDimensions().width).columns === 1;
  const optionsDisabled = state.status !== 'awaiting-answer';
  const selectedOption = exercise.options.find(
    (option) => option.optionId === state.selectedOptionId,
  );

  return (
    <View style={styles.container}>
      <View style={styles.promptGroup}>
        <Text accessibilityRole="header" style={styles.title}>
          看汉字，选出语境中的读音
        </Text>
        <Text style={styles.instructions}>多音字要结合词语来判断。拼音只显示在答案选项中。</Text>
        <View
          accessibilityLabel={`目标汉字：${exercise.targetGlyph}。语境：${exercise.contextZh ?? '无'}`}
          style={styles.prompt}
        >
          <Text style={styles.promptLabel}>目标汉字</Text>
          <HanziText emphasis="target">{exercise.targetGlyph}</HanziText>
          {exercise.contextZh ? (
            <Text style={styles.context}>语境：{exercise.contextZh}</Text>
          ) : null}
        </View>
      </View>

      <View accessibilityLabel="拼音读音选项" accessibilityRole="radiogroup" style={styles.options}>
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
              <Text style={styles.pinyin}>{option.display}</Text>
              <Text style={styles.toneLabel}>{glyphToPinyinToneLabel(option.tone)}</Text>
              {selected ? <Text style={styles.selectionText}>已选择</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {exercise.hintZh && state.hintVisible ? (
        <View accessibilityLiveRegion="polite" style={styles.hintCard}>
          <Text style={styles.hintLabel}>提示</Text>
          <Text style={styles.feedbackText}>{exercise.hintZh}</Text>
        </View>
      ) : exercise.hintZh ? (
        <Pressable
          accessibilityLabel="显示多音字语境提示"
          accessibilityRole="button"
          onPress={onHint}
          style={styles.hintTrigger}
        >
          <Text style={styles.hintTriggerText}>需要提示</Text>
        </Pressable>
      ) : null}

      {state.status === 'incorrect-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>再结合词语看看</Text>
          <Text style={styles.feedbackText}>
            “{selectedOption?.display}”在这里还不对应。看看语境和提示，再试一次。
          </Text>
          <PrimaryButton label="重新选择" onPress={onRetry} />
        </View>
      ) : null}

      {state.status === 'correct-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={[styles.feedbackCard, styles.correctCard]}>
          <Text style={styles.feedbackTitle}>✓ 找到语境读音</Text>
          <Text style={styles.feedbackText}>
            “{exercise.contextZh}”里的“{exercise.targetGlyph}”读 {selectedOption?.display}。
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
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.bodyLarge,
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
  hintCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  hintLabel: { color: colors.primary, fontSize: fontSizes.body, fontWeight: fontWeights.bold },
  hintTrigger: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
  },
  hintTriggerText: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
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
  optionPressed: { backgroundColor: colors.surfaceMuted },
  optionSelected: { borderColor: colors.primary, borderWidth: borders.focus },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  pinyin: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.semibold,
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
  toneLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
});
