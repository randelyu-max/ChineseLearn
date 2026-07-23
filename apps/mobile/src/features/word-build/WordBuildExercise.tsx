import type { WordBuildExercise as WordBuildExerciseContract } from '@hanziquest/contracts';
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

import { wordBuildLayout, type WordBuildState } from './model';

type Props = {
  exercise: WordBuildExerciseContract;
  onHint: () => void;
  onPlayAudio: () => void;
  onRetry: () => void;
  onSubmit: () => void;
  onToggleTile: (tileId: string) => void;
  state: WordBuildState;
};

export function WordBuildExercise({
  exercise,
  onHint,
  onPlayAudio,
  onRetry,
  onSubmit,
  onToggleTile,
  state,
}: Props) {
  const { width } = useWindowDimensions();
  const compact = wordBuildLayout(width).compact;
  const tileById = new Map(exercise.tiles.map((tile) => [tile.tileId, tile]));
  const completed = state.status === 'correct-feedback';

  return (
    <View style={styles.container}>
      <View style={styles.prompt}>
        <Text accessibilityRole="header" style={styles.title}>
          {exercise.promptZh}
        </Text>
        <Text style={styles.instructions}>
          点击下方汉字加入答案；点击答案中的汉字可以撤回。这是拖动操作的完整替代方式。
        </Text>
        <AudioButton
          disabled={completed}
          label={
            state.replayCount === 0 ? '听一听词语' : `再听词语，已重播 ${state.replayCount} 次`
          }
          onPress={onPlayAudio}
        />
      </View>

      <View
        accessibilityLabel="当前答案"
        style={[styles.answerArea, compact && styles.answerAreaCompact]}
      >
        {state.selectedTileIds.length === 0 ? (
          <Text style={styles.placeholder}>答案会出现在这里</Text>
        ) : (
          state.selectedTileIds.map((tileId, index) => {
            const tile = tileById.get(tileId)!;
            return (
              <Pressable
                accessibilityLabel={`${tile.glyph}，答案第 ${index + 1} 个，点击撤回`}
                accessibilityRole="button"
                disabled={state.status !== 'building'}
                key={tileId}
                onPress={() => onToggleTile(tileId)}
                style={styles.answerTile}
              >
                <Text style={styles.tileGlyph}>{tile.glyph}</Text>
                <Text style={styles.positionLabel}>第 {index + 1} 个</Text>
              </Pressable>
            );
          })
        )}
      </View>

      <View accessibilityLabel="可选汉字" style={styles.tileBank}>
        {exercise.tiles
          .filter((tile) => !state.selectedTileIds.includes(tile.tileId))
          .map((tile) => (
            <Pressable
              accessibilityLabel={tile.accessibilityLabel}
              accessibilityRole="button"
              disabled={state.status !== 'building'}
              key={tile.tileId}
              onPress={() => onToggleTile(tile.tileId)}
              style={({ pressed }) => [styles.bankTile, pressed && styles.pressed]}
            >
              <Text style={styles.tileGlyph}>{tile.glyph}</Text>
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
          accessibilityLabel="显示组词提示"
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
          label="完成组词"
          onPress={onSubmit}
        />
      ) : null}
      {state.status === 'incorrect-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>顺序还可以再想一想</Text>
          <Text style={styles.body}>没有关系，看看提示，再排一次。</Text>
          <PrimaryButton label="重新排列" onPress={onRetry} />
        </View>
      ) : null}
      {completed ? (
        <View accessibilityLiveRegion="assertive" style={[styles.feedbackCard, styles.correctCard]}>
          <Text style={styles.feedbackTitle}>✓ 组成了“{exercise.targetWord}”</Text>
          <Text style={styles.body}>你把每个字放到了正确的位置。</Text>
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
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 104,
    padding: spacing.md,
  },
  answerAreaCompact: { alignItems: 'stretch', flexDirection: 'column' },
  answerTile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: 2,
    minHeight: 72,
    minWidth: 72,
    padding: spacing.sm,
  },
  bankTile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 72,
    minWidth: 72,
    padding: spacing.sm,
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
  positionLabel: { color: colors.textSecondary, fontSize: fontSizes.caption },
  pressed: { backgroundColor: colors.surfaceMuted },
  prompt: { gap: spacing.md },
  tileBank: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
  tileGlyph: {
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: fontWeights.semibold,
    lineHeight: 48,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
  },
});
