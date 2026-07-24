import type { AudioToGlyphExercise as AudioToGlyphExerciseContract } from '@hanziquest/contracts';
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

import { AudioButton, PrimaryButton } from '@/components/ui';

import { audioToGlyphLayout, type AudioToGlyphState } from './model';

type Props = {
  exercise: AudioToGlyphExerciseContract;
  onHint: () => void;
  onPlayAudio: () => void;
  onRetry: () => void;
  onSelectOption: (optionId: string) => void;
  state: AudioToGlyphState;
};

export function AudioToGlyphExercise({
  exercise,
  onHint,
  onPlayAudio,
  onRetry,
  onSelectOption,
  state,
}: Props) {
  const { width } = useWindowDimensions();
  const compact = audioToGlyphLayout(width).columns === 1;
  const completed = state.status === 'correct-feedback';

  return (
    <View style={styles.container}>
      <View style={styles.promptGroup}>
        <Text accessibilityRole="header" style={styles.title}>
          听一听，选出你听到的字
        </Text>
        <Text style={styles.instructions}>可以重复播放。答错也没关系，我们会给你一个提示。</Text>
        <AudioButton
          disabled={completed}
          label={state.replayCount === 0 ? '播放声音' : `再听一次，已重播 ${state.replayCount} 次`}
          onPress={onPlayAudio}
        />
      </View>

      <View accessibilityLabel="汉字选项" accessibilityRole="radiogroup" style={styles.options}>
        {exercise.options.map((option) => {
          const selected = state.selectedOptionId === option.optionId;
          return (
            <Pressable
              accessibilityLabel={option.accessibilityLabel}
              aria-checked={selected}
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
              <Text style={styles.glyph}>{option.glyph}</Text>
              {selected ? <Text style={styles.selectionText}>已选择</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {state.hintLevel === 'visual_hint' ? (
        <View accessibilityLiveRegion="polite" style={styles.hintCard}>
          <Text style={styles.hintLabel}>提示</Text>
          <Text style={styles.feedbackText}>{exercise.visualHintZh}</Text>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="显示字形提示"
          onPress={onHint}
          style={styles.hintTrigger}
        >
          <Text style={styles.hintTriggerText}>需要提示</Text>
        </Pressable>
      )}

      {state.status === 'incorrect-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>再找一找</Text>
          <Text style={styles.feedbackText}>这个字还不是答案。听一听提示，再试一次。</Text>
          <PrimaryButton label="我再试试" onPress={onRetry} />
        </View>
      ) : null}

      {state.status === 'correct-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={[styles.feedbackCard, styles.correctCard]}>
          <Text style={styles.feedbackTitle}>✓ 找到了</Text>
          <Text style={styles.feedbackText}>
            你认出了“
            {exercise.options.find((item) => item.optionId === exercise.correctOptionId)?.glyph}”。
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  glyph: {
    color: colors.textPrimary,
    fontSize: 48,
    fontWeight: fontWeights.semibold,
    lineHeight: 64,
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
    justifyContent: 'center',
    minHeight: 112,
    padding: spacing.md,
    width: '47%',
  },
  optionCompact: { width: '100%' },
  optionPressed: { backgroundColor: colors.surfaceMuted },
  optionSelected: { borderColor: colors.primary, borderWidth: borders.focus },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  promptGroup: { gap: spacing.md },
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
