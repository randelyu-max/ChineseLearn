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

import { AudioButton, PrimaryButton } from '@/components/ui';

import {
  audioToPinyinLayout,
  audioToPinyinReplayCount,
  pinyinToneLabel,
  type AudioToPinyinExerciseDefinition,
  type AudioToPinyinState,
} from './model';

export type PinyinAudioStatus = 'error' | 'loading' | 'playing' | 'ready';

type Props = {
  audioStatus: PinyinAudioStatus;
  exercise: AudioToPinyinExerciseDefinition;
  onPlayAudio: () => void;
  onRetry: () => void;
  onSelectOption: (optionId: string) => void;
  state: AudioToPinyinState;
};

export function AudioToPinyinExercise({
  audioStatus,
  exercise,
  onPlayAudio,
  onRetry,
  onSelectOption,
  state,
}: Props) {
  const compact = audioToPinyinLayout(useWindowDimensions().width).columns === 1;
  const completed = state.status === 'correct-feedback';
  const optionsDisabled = completed || state.status === 'incorrect-feedback';
  const replayCount = audioToPinyinReplayCount(state);
  const correctOption = exercise.options.find(
    (option) => option.optionId === exercise.correctOptionId,
  );
  const audioLabel =
    state.playCount === 0
      ? '播放音节'
      : replayCount === 0
        ? '再听一次'
        : `再听一次，已重播 ${replayCount} 次`;

  return (
    <View style={styles.container}>
      <View style={styles.promptGroup}>
        <Text accessibilityRole="header" style={styles.title}>
          听一听，选出对应的拼音
        </Text>
        <Text style={styles.instructions}>注意音节和声调。可以重复播放，不需要英语翻译。</Text>
        <AudioButton
          disabled={audioStatus === 'loading' || completed}
          label={audioStatus === 'playing' ? '正在播放' : audioLabel}
          onPress={onPlayAudio}
          testID="audio-to-pinyin-play"
        />
        {audioStatus === 'loading' ? (
          <Text accessibilityLiveRegion="polite" style={styles.statusText}>
            正在准备离线音频…
          </Text>
        ) : null}
        {audioStatus === 'error' ? (
          <View accessibilityLiveRegion="assertive" style={styles.audioError}>
            <Text style={styles.feedbackTitle}>音频暂时无法播放</Text>
            <Text style={styles.feedbackText}>发音资源已保存在设备上，请再试一次。</Text>
          </View>
        ) : null}
      </View>

      <View accessibilityLabel="拼音选项" accessibilityRole="radiogroup" style={styles.options}>
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
              <Text style={styles.toneLabel}>{pinyinToneLabel(option.tone)}</Text>
              {selected ? <Text style={styles.selectionText}>已选择</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {state.status === 'incorrect-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>再听一次</Text>
          <Text style={styles.feedbackText}>这个选项还不对应刚才的声音。留意声调，再试试。</Text>
          <PrimaryButton label="重新选择" onPress={onRetry} />
        </View>
      ) : null}

      {state.status === 'correct-feedback' ? (
        <View accessibilityLiveRegion="assertive" style={[styles.feedbackCard, styles.correctCard]}>
          <Text style={styles.feedbackTitle}>✓ 找到了</Text>
          <Text style={styles.feedbackText}>
            这个音节是 {correctOption?.display}，
            {correctOption && pinyinToneLabel(correctOption.tone)}。
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
    gap: spacing.xs,
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
  promptGroup: { gap: spacing.md },
  selectionText: {
    color: colors.primary,
    fontSize: fontSizes.caption,
    fontWeight: fontWeights.bold,
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
  toneLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
});
