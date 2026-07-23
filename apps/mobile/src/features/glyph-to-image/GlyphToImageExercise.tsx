import type {
  GlyphToImageExercise as GlyphToImageExerciseContract,
  ImageExerciseOption,
} from '@hanziquest/contracts';
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
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AudioButton, HanziText, PrimaryButton } from '@/components/ui';

import { glyphToImageLayout, type GlyphToImageState } from './model';

type Props = {
  exercise: GlyphToImageExerciseContract;
  onHint: () => void;
  onPlayAudio: () => void;
  onRetry: () => void;
  onSelectOption: (optionId: string) => void;
  renderOptionVisual: (option: ImageExerciseOption) => ReactNode;
  state: GlyphToImageState;
};

export function GlyphToImageExercise({
  exercise,
  onHint,
  onPlayAudio,
  onRetry,
  onSelectOption,
  renderOptionVisual,
  state,
}: Props) {
  const { width } = useWindowDimensions();
  const compact = glyphToImageLayout(width).columns === 1;
  const completed = state.status === 'correct-feedback';

  return (
    <View style={styles.container}>
      <View style={styles.prompt}>
        <Text accessibilityRole="header" style={styles.title}>
          哪个图片和这个字最合适？
        </Text>
        <HanziText emphasis="target">{exercise.promptGlyph}</HanziText>
        <AudioButton
          disabled={completed}
          label={state.replayCount === 0 ? '听字音' : `再听字音，已重播 ${state.replayCount} 次`}
          onPress={onPlayAudio}
        />
      </View>

      <View accessibilityLabel="图片选项" accessibilityRole="radiogroup" style={styles.options}>
        {exercise.options.map((option) => {
          const selected = option.optionId === state.selectedOptionId;
          return (
            <Pressable
              accessibilityLabel={option.accessibilityLabel}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: completed }}
              disabled={completed || state.status === 'incorrect-feedback'}
              key={option.optionId}
              onPress={() => onSelectOption(option.optionId)}
              style={({ pressed }) => [
                styles.option,
                compact && styles.optionCompact,
                selected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.visual}
              >
                {renderOptionVisual(option)}
              </View>
              <Text style={styles.caption}>{option.accessibilityLabel}</Text>
              {selected ? <Text style={styles.selectedText}>已选择</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {state.hintLevel === 'visual_hint' ? (
        <View accessibilityLiveRegion="polite" style={styles.hintCard}>
          <Text style={styles.feedbackTitle}>提示</Text>
          <Text style={styles.body}>{exercise.visualHintZh}</Text>
        </View>
      ) : (
        <Pressable
          accessibilityLabel="显示图片提示"
          accessibilityRole="button"
          onPress={onHint}
          style={styles.hintTrigger}
        >
          <Text style={styles.hintTriggerText}>需要提示</Text>
        </Pressable>
      )}

      {state.status === 'incorrect-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>再看一看</Text>
          <Text style={styles.body}>这张图片还不合适。看看提示，再选一次。</Text>
          <PrimaryButton label="我再试试" onPress={onRetry} />
        </View>
      ) : null}
      {completed ? (
        <View accessibilityLiveRegion="assertive" style={[styles.feedbackCard, styles.correctCard]}>
          <Text style={styles.feedbackTitle}>✓ 找到了合适的图片</Text>
          <Text style={styles.body}>图片下方的文字也说明了它表示什么。</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: lineHeights.body },
  caption: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  container: { gap: spacing.xl },
  correctCard: { backgroundColor: colors.successSurface, borderColor: colors.success },
  feedbackCard: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warning,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    gap: spacing.md,
    padding: spacing.lg,
  },
  feedbackTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.bold,
  },
  hintCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    gap: spacing.xs,
    padding: spacing.lg,
  },
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
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 2,
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 144,
    padding: spacing.md,
    width: '47%',
  },
  optionCompact: { width: '100%' },
  optionPressed: { backgroundColor: colors.surfaceMuted },
  optionSelected: { borderColor: colors.primary, borderWidth: borders.focus },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  prompt: { alignItems: 'center', gap: spacing.md },
  selectedText: {
    color: colors.primary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
    textAlign: 'center',
  },
  visual: { alignItems: 'center', justifyContent: 'center', minHeight: 64 },
});
