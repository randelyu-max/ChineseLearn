import type { SentenceOrderExercise as SentenceOrderExerciseContract } from '@hanziquest/contracts';
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

import { sentenceOrderLayout, type SentenceOrderState } from './model';

type Props = {
  exercise: SentenceOrderExerciseContract;
  onHint: () => void;
  onPlayAudio: () => void;
  onRetry: () => void;
  onSubmit: () => void;
  onToggleTile: (tileId: string) => void;
  state: SentenceOrderState;
};

export function SentenceOrderExercise({
  exercise,
  onHint,
  onPlayAudio,
  onRetry,
  onSubmit,
  onToggleTile,
  state,
}: Props) {
  const compact = sentenceOrderLayout(useWindowDimensions().width).compact;
  const tileById = new Map(exercise.tiles.map((tile) => [tile.tileId, tile]));
  const completed = state.status === 'correct-feedback';

  return (
    <View style={styles.container}>
      <View style={styles.prompt}>
        <Text accessibilityRole="header" style={styles.title}>
          {exercise.promptZh}
        </Text>
        <Text style={styles.instructions}>
          点击句块加入答案；点击答案中的句块可以撤回，拖动不是唯一操作方式。
        </Text>
        <AudioButton
          disabled={completed}
          label={
            state.replayCount === 0 ? '听完整句子' : `再听句子，已重播 ${state.replayCount} 次`
          }
          onPress={onPlayAudio}
        />
      </View>

      <View
        accessibilityLabel="当前句子"
        style={[styles.answerArea, compact && styles.answerCompact]}
      >
        {state.selectedTileIds.length === 0 ? (
          <Text style={styles.placeholder}>句子会出现在这里</Text>
        ) : (
          state.selectedTileIds.map((tileId, index) => {
            const tile = tileById.get(tileId)!;
            return (
              <Pressable
                accessibilityLabel={`${tile.accessibilityLabel}，第 ${index + 1} 个，点击撤回`}
                accessibilityRole="button"
                disabled={state.status !== 'building'}
                key={tileId}
                onPress={() => onToggleTile(tileId)}
                style={styles.answerTile}
              >
                <Text style={styles.tileText}>{tile.text}</Text>
                <Text style={styles.position}>第 {index + 1} 个</Text>
              </Pressable>
            );
          })
        )}
      </View>

      <View accessibilityLabel="可选句块" style={styles.tileBank}>
        {exercise.tiles
          .filter((tile) => !state.selectedTileIds.includes(tile.tileId))
          .map((tile) => (
            <Pressable
              accessibilityLabel={`${tile.accessibilityLabel}，点击加入句子`}
              accessibilityRole="button"
              disabled={state.status !== 'building'}
              key={tile.tileId}
              onPress={() => onToggleTile(tile.tileId)}
              style={({ pressed }) => [styles.bankTile, pressed && styles.pressed]}
            >
              <Text style={styles.tileText}>{tile.text}</Text>
            </Pressable>
          ))}
      </View>

      {state.hintLevel === 'visual_hint' ? (
        <View accessibilityLiveRegion="polite" style={styles.hintCard}>
          <Text style={styles.feedbackTitle}>提示</Text>
          <Text style={styles.body}>{exercise.visualHintZh}</Text>
        </View>
      ) : (
        <Pressable
          accessibilityLabel="显示排句提示"
          accessibilityRole="button"
          onPress={onHint}
          style={styles.hintTrigger}
        >
          <Text style={styles.hintTriggerText}>需要提示</Text>
        </Pressable>
      )}

      {state.status === 'building' ? (
        <PrimaryButton
          disabled={state.selectedTileIds.length !== exercise.tiles.length}
          label="完成句子"
          onPress={onSubmit}
        />
      ) : null}
      {state.status === 'incorrect-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>句子顺序还不太自然</Text>
          <Text style={styles.body}>看看提示，再排一次。</Text>
          <PrimaryButton label="重新排列" onPress={onRetry} />
        </View>
      ) : null}
      {completed ? (
        <View accessibilityLiveRegion="assertive" style={[styles.feedbackCard, styles.correctCard]}>
          <Text style={styles.feedbackTitle}>✓ “{exercise.targetSentence}”</Text>
          <Text style={styles.body}>你排出了一句完整的话。</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  answerArea: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderStyle: 'dashed',
    borderWidth: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 96,
    padding: spacing.md,
  },
  answerCompact: { alignItems: 'stretch', flexDirection: 'column' },
  answerTile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: 2,
    minHeight: 56,
    minWidth: 64,
    padding: spacing.sm,
  },
  bankTile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  body: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: lineHeights.body },
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
  instructions: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  placeholder: { color: colors.textSecondary, fontSize: fontSizes.body },
  position: { color: colors.textSecondary, fontSize: fontSizes.caption },
  pressed: { backgroundColor: colors.surfaceMuted },
  prompt: { gap: spacing.md },
  tileBank: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  tileText: {
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
  },
});
