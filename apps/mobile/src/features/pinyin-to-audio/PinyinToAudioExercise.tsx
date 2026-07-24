import {
  borders,
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
} from '@hanziquest/design-tokens';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AudioButton, PrimaryButton } from '@/components/ui';

import {
  pinyinToAudioLayout,
  pinyinToAudioReplayCount,
  type PinyinToAudioExerciseDefinition,
  type PinyinToAudioState,
} from './model';

export type PinyinToAudioPlaybackStatus = Readonly<{
  failedOptionId: string | null;
  phase: 'error' | 'loading' | 'playing' | 'ready';
  playingOptionId: string | null;
}>;

type Props = {
  disabled?: boolean;
  exercise: PinyinToAudioExerciseDefinition;
  onPlayOption: (optionId: string) => void;
  onRetryAnswer: () => void;
  onRetryAudio: () => void;
  onSelectOption: (optionId: string) => void;
  playbackStatus: PinyinToAudioPlaybackStatus;
  state: PinyinToAudioState;
};

export function PinyinToAudioExercise({
  disabled = false,
  exercise,
  onPlayOption,
  onRetryAnswer,
  onRetryAudio,
  onSelectOption,
  playbackStatus,
  state,
}: Props) {
  const compact = pinyinToAudioLayout(useWindowDimensions().width).columns === 1;
  const answerLocked = disabled || state.status !== 'awaiting-answer';

  return (
    <View style={styles.container}>
      <View style={styles.promptGroup}>
        <Text accessibilityRole="header" style={styles.title}>
          看拼音，选出对应的发音
        </Text>
        <Text style={styles.instructions}>
          依次试听选项，可以重复播放。这里不录音，也不上传语音。
        </Text>
        <View
          accessibilityLabel={`目标拼音：${exercise.prompt.accessibilityLabel}`}
          style={styles.prompt}
        >
          <Text style={styles.promptLabel}>目标拼音</Text>
          <Text style={styles.pinyin}>{exercise.prompt.display}</Text>
        </View>
        {playbackStatus.phase === 'loading' ? (
          <Text accessibilityLiveRegion="polite" style={styles.statusText}>
            正在准备离线音频…
          </Text>
        ) : null}
        {playbackStatus.phase === 'error' ? (
          <View accessibilityLiveRegion="assertive" style={styles.audioError}>
            <Text style={styles.feedbackTitle}>音频暂时无法播放</Text>
            <Text style={styles.feedbackText}>
              {playbackStatus.failedOptionId
                ? '这个离线音频没有正常载入，请重试。'
                : '离线音频没有正常准备完成，请重试。'}
            </Text>
            <PrimaryButton label="重新准备音频" onPress={onRetryAudio} />
          </View>
        ) : null}
      </View>

      <View accessibilityLabel="发音选项" style={styles.options}>
        {exercise.options.map((option, index) => {
          const optionLabel = String.fromCharCode(65 + index);
          const listenCount = state.listenCounts[option.optionId] ?? 0;
          const replayCount = pinyinToAudioReplayCount(state, option.optionId);
          const isPlaying =
            playbackStatus.phase === 'playing' &&
            playbackStatus.playingOptionId === option.optionId;
          const isSelected = state.selectedOptionId === option.optionId;
          const audioLabel = isPlaying
            ? `选项 ${optionLabel} 正在播放`
            : listenCount === 0
              ? `播放选项 ${optionLabel}`
              : replayCount === 0
                ? `重播选项 ${optionLabel}`
                : `重播选项 ${optionLabel}，已重播 ${replayCount} 次`;

          return (
            <View
              accessibilityLabel={`发音选项 ${optionLabel}`}
              key={option.optionId}
              style={[
                styles.option,
                compact && styles.optionCompact,
                isSelected && styles.optionSelected,
              ]}
            >
              <Text style={styles.optionLabel}>选项 {optionLabel}</Text>
              <AudioButton
                disabled={playbackStatus.phase === 'loading' || answerLocked}
                label={audioLabel}
                onPress={() => onPlayOption(option.optionId)}
                testID={`pinyin-to-audio-play-${optionLabel}`}
              />
              <PrimaryButton
                disabled={listenCount === 0 || answerLocked || playbackStatus.phase === 'loading'}
                label={isSelected ? '已选择' : '选择这个发音'}
                onPress={() => onSelectOption(option.optionId)}
              />
            </View>
          );
        })}
      </View>

      {state.status === 'incorrect-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>再比较一次</Text>
          <Text style={styles.feedbackText}>
            留意声调的走向。可以把每个选项再听一遍，然后重新选择。
          </Text>
          <PrimaryButton label="重新选择" onPress={onRetryAnswer} />
        </View>
      ) : null}

      {state.status === 'correct-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={[styles.feedbackCard, styles.correctCard]}>
          <Text style={styles.feedbackTitle}>✓ 找到对应发音</Text>
          <Text style={styles.feedbackText}>
            这个音频对应 {exercise.prompt.accessibilityLabel}。
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  audioError: {
    backgroundColor: colors.dangerSurface,
    borderRadius: radii.md,
    gap: spacing.md,
    padding: spacing.md,
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
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    gap: spacing.md,
    minHeight: 132,
    padding: spacing.md,
    width: '30%',
  },
  optionCompact: { width: '100%' },
  optionLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.bodyLarge,
    textAlign: 'center',
  },
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
    gap: spacing.xs,
    padding: spacing.lg,
  },
  promptGroup: { gap: spacing.md },
  promptLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
  },
});
