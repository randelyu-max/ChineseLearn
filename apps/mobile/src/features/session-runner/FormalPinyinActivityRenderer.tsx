import type { AttemptAnswerV2 } from '@hanziquest/contracts';
import { colors, fontSizes, lineHeights, radii, spacing } from '@hanziquest/design-tokens';
import { StyleSheet, Text, View } from 'react-native';

import { AudioButton, PrimaryButton } from '@/components/ui';
import { AudioToPinyinExercise, type PinyinAudioStatus } from '@/features/audio-to-pinyin';
import { GlyphToPinyinExercise } from '@/features/glyph-to-pinyin';
import { PinyinSyllableBuildExercise } from '@/features/pinyin-syllable-build';
import {
  PinyinToAudioExercise,
  type PinyinToAudioPlaybackStatus,
} from '@/features/pinyin-to-audio';
import { PinyinToGlyphExercise } from '@/features/pinyin-to-glyph';
import { ToneChoiceExercise } from '@/features/tone-choice';

import type { FormalSessionRunnerState } from './model';
import {
  adaptAudioToPinyin,
  adaptGlyphToPinyin,
  adaptPinyinSyllableBuild,
  adaptPinyinToAudio,
  adaptPinyinToGlyph,
  adaptToneChoice,
  type FormalPinyinExercise,
} from './pinyin-adapters';

export type FormalAudioState = Readonly<{
  failedAssetKey: string | null;
  phase: 'error' | 'loading' | 'playing' | 'ready';
  playingAssetKey: string | null;
}>;

type Props = {
  audioState: FormalAudioState;
  busy: boolean;
  exercise: FormalPinyinExercise;
  onPlayAudio: (assetKey: string) => void;
  onRequestHint: () => void;
  onResetBuild: () => void;
  onRetryAnswer: () => void;
  onRetryAudio: () => void;
  onSelectBuildOption: (step: 'final' | 'initial' | 'tone', optionId: string) => void;
  onSubmitAnswer: (answer: AttemptAnswerV2) => void;
  runner: FormalSessionRunnerState;
};

function audioToPinyinStatus(audioState: FormalAudioState, assetKey: string): PinyinAudioStatus {
  if (audioState.phase === 'error' && audioState.failedAssetKey === assetKey) return 'error';
  if (audioState.phase === 'loading') return 'loading';
  if (audioState.phase === 'playing' && audioState.playingAssetKey === assetKey) return 'playing';
  return 'ready';
}

export function FormalPinyinActivityRenderer({
  audioState,
  busy,
  exercise,
  onPlayAudio,
  onRequestHint,
  onResetBuild,
  onRetryAnswer,
  onRetryAudio,
  onSelectBuildOption,
  onSubmitAnswer,
  runner,
}: Props) {
  if (exercise.type === 'audio_to_pinyin') {
    const adapted = adaptAudioToPinyin(exercise, runner);
    return (
      <AudioToPinyinExercise
        audioStatus={audioToPinyinStatus(audioState, exercise.promptAudioAssetKey)}
        disabled={busy}
        exercise={adapted.exercise}
        onPlayAudio={() => onPlayAudio(exercise.promptAudioAssetKey)}
        onRetry={onRetryAnswer}
        onSelectOption={(optionId) => onSubmitAnswer({ optionId })}
        state={adapted.state}
      />
    );
  }

  if (exercise.type === 'pinyin_to_audio') {
    const adapted = adaptPinyinToAudio(exercise, runner);
    const playingOption = exercise.options.find(
      (option) => option.audioAssetKey === audioState.playingAssetKey,
    );
    const failedOption = exercise.options.find(
      (option) => option.audioAssetKey === audioState.failedAssetKey,
    );
    const playbackStatus: PinyinToAudioPlaybackStatus = {
      failedOptionId: failedOption?.optionId ?? null,
      phase: audioState.phase,
      playingOptionId: playingOption?.optionId ?? null,
    };
    return (
      <PinyinToAudioExercise
        disabled={busy}
        exercise={adapted.exercise}
        onPlayOption={(optionId) => {
          const option = exercise.options.find((candidate) => candidate.optionId === optionId);
          if (option) onPlayAudio(option.audioAssetKey);
        }}
        onRetryAnswer={onRetryAnswer}
        onRetryAudio={onRetryAudio}
        onSelectOption={(optionId) => onSubmitAnswer({ optionId })}
        playbackStatus={playbackStatus}
        state={adapted.state}
      />
    );
  }

  if (exercise.type === 'pinyin_to_glyph') {
    const adapted = adaptPinyinToGlyph(exercise, runner);
    return (
      <PinyinToGlyphExercise
        disabled={busy}
        exercise={adapted.exercise}
        onRetry={onRetryAnswer}
        onSelectOption={(optionId) => onSubmitAnswer({ optionId })}
        state={adapted.state}
      />
    );
  }

  if (exercise.type === 'glyph_to_pinyin') {
    const adapted = adaptGlyphToPinyin(exercise, runner);
    return (
      <GlyphToPinyinExercise
        disabled={busy}
        exercise={adapted.exercise}
        onHint={onRequestHint}
        onRetry={onRetryAnswer}
        onSelectOption={(optionId) => onSubmitAnswer({ optionId })}
        state={adapted.state}
      />
    );
  }

  if (exercise.type === 'tone_choice') {
    const adapted = adaptToneChoice(exercise, runner);
    return (
      <View style={styles.group}>
        {exercise.promptAudioAssetKey ? (
          <>
            <AudioButton
              disabled={busy || audioState.phase === 'loading'}
              label={
                audioState.phase === 'playing' &&
                audioState.playingAssetKey === exercise.promptAudioAssetKey
                  ? '正在播放'
                  : '播放声调'
              }
              onPress={() => onPlayAudio(exercise.promptAudioAssetKey!)}
            />
            {audioState.phase === 'error' ? (
              <View accessibilityLiveRegion="assertive" style={styles.audioError}>
                <Text style={styles.audioErrorText}>音频暂时无法播放，请重新准备后再试。</Text>
                <PrimaryButton label="重新准备音频" onPress={onRetryAudio} />
              </View>
            ) : null}
          </>
        ) : null}
        <ToneChoiceExercise
          disabled={busy}
          exercise={adapted.exercise}
          onRetry={onRetryAnswer}
          onSelectOption={(optionId) => onSubmitAnswer({ optionId })}
          state={adapted.state}
        />
      </View>
    );
  }

  const adapted = adaptPinyinSyllableBuild(exercise, runner);
  return (
    <PinyinSyllableBuildExercise
      disabled={busy}
      exercise={adapted.exercise}
      onReset={onResetBuild}
      onSelectFinal={(value) => {
        const option = exercise.finalOptions.find((candidate) => candidate.value === value);
        if (option) onSelectBuildOption('final', option.optionId);
      }}
      onSelectInitial={(value) => {
        const option = exercise.initialOptions.find((candidate) => candidate.value === value);
        if (option) onSelectBuildOption('initial', option.optionId);
      }}
      onSelectTone={(value) => {
        const option = exercise.toneOptions.find((candidate) => candidate.value === value);
        if (option) onSelectBuildOption('tone', option.optionId);
      }}
      onSubmit={() => onSubmitAnswer({ tileIds: [...runner.activityState.selectedTileIds] })}
      state={adapted.state}
    />
  );
}

const styles = StyleSheet.create({
  audioError: {
    backgroundColor: colors.dangerSurface,
    borderRadius: radii.md,
    gap: spacing.md,
    padding: spacing.md,
  },
  audioErrorText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  group: { gap: spacing.lg },
});
