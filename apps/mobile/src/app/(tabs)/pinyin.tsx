import { spacing } from '@hanziquest/design-tokens';
import { preload, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import ma2Audio from '../../../assets/audio/pinyin/ma2.mp3';
import ma3Audio from '../../../assets/audio/pinyin/ma3.mp3';
import ma4Audio from '../../../assets/audio/pinyin/ma4.mp3';
import { Screen } from '@/components/ui';
import {
  AudioToPinyinExercise,
  audioToPinyinDemoExercise,
  createAudioToPinyinState,
  recordAudioToPinyinPlayback,
  retryAudioToPinyin,
  selectAudioToPinyinOption,
  type PinyinAudioStatus,
} from '@/features/audio-to-pinyin';
import {
  createPinyinToAudioState,
  PinyinToAudioExercise,
  pinyinToAudioDemoExercise,
  recordPinyinToAudioPlayback,
  retryPinyinToAudio,
  selectPinyinToAudioOption,
  type PinyinToAudioPlaybackStatus,
} from '@/features/pinyin-to-audio';
import {
  createGlyphToPinyinState,
  GlyphToPinyinExercise,
  glyphToPinyinDemoExercise,
  requestGlyphToPinyinHint,
  retryGlyphToPinyin,
  selectGlyphToPinyinOption,
} from '@/features/glyph-to-pinyin';
import {
  createPinyinToGlyphState,
  PinyinToGlyphExercise,
  pinyinToGlyphDemoExercise,
  retryPinyinToGlyph,
  selectPinyinToGlyphOption,
} from '@/features/pinyin-to-glyph';

const pinyinToAudioSources = {
  'pinyin-ma2-v1': ma2Audio,
  'pinyin-ma3-v1': ma3Audio,
  'pinyin-ma4-v1': ma4Audio,
} as const;

function preloadPinyinToAudio(): Promise<boolean> {
  return Promise.all(Object.values(pinyinToAudioSources).map((source) => preload(source))).then(
    () => true,
    () => false,
  );
}

let pinyinToAudioPreloadPromise = preloadPinyinToAudio();

export default function PinyinScreen() {
  const audioToPinyinPlayer = useAudioPlayer(ma3Audio);
  const audioToPinyinPlayerStatus = useAudioPlayerStatus(audioToPinyinPlayer);
  const [audioToPinyinState, setAudioToPinyinState] = useState(createAudioToPinyinState);
  const [audioToPinyinFailed, setAudioToPinyinFailed] = useState(false);
  const audioToPinyinStatus: PinyinAudioStatus =
    audioToPinyinFailed || audioToPinyinPlayerStatus.error
      ? 'error'
      : !audioToPinyinPlayerStatus.isLoaded
        ? 'loading'
        : audioToPinyinPlayerStatus.playing
          ? 'playing'
          : 'ready';

  const ma2Player = useAudioPlayer(ma2Audio);
  const ma3Player = useAudioPlayer(ma3Audio);
  const ma4Player = useAudioPlayer(ma4Audio);
  const ma2Status = useAudioPlayerStatus(ma2Player);
  const ma3Status = useAudioPlayerStatus(ma3Player);
  const ma4Status = useAudioPlayerStatus(ma4Player);
  const [pinyinToAudioState, setPinyinToAudioState] = useState(createPinyinToAudioState);
  const [pinyinToGlyphState, setPinyinToGlyphState] = useState(createPinyinToGlyphState);
  const [glyphToPinyinState, setGlyphToPinyinState] = useState(createGlyphToPinyinState);
  const [pinyinToAudioStatus, setPinyinToAudioStatus] = useState<PinyinToAudioPlaybackStatus>({
    failedOptionId: null,
    phase: 'loading',
    playingOptionId: null,
  });

  const audioEntry = (assetKey: string) => {
    if (assetKey === 'pinyin-ma2-v1') {
      return { player: ma2Player, source: ma2Audio, status: ma2Status };
    }
    if (assetKey === 'pinyin-ma3-v1') {
      return { player: ma3Player, source: ma3Audio, status: ma3Status };
    }
    if (assetKey === 'pinyin-ma4-v1') {
      return { player: ma4Player, source: ma4Audio, status: ma4Status };
    }
    throw new Error(`Unknown bundled Pinyin audio asset: ${assetKey}`);
  };

  useEffect(() => {
    let active = true;
    void pinyinToAudioPreloadPromise.then((success) => {
      if (!active || success) return;
      setPinyinToAudioStatus({
        failedOptionId: null,
        phase: 'error',
        playingOptionId: null,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const optionByAsset = new Map(
    pinyinToAudioDemoExercise.options.map((option) => [option.assetKey, option.optionId]),
  );
  const playerEntries = [
    { assetKey: 'pinyin-ma2-v1', status: ma2Status },
    { assetKey: 'pinyin-ma3-v1', status: ma3Status },
    { assetKey: 'pinyin-ma4-v1', status: ma4Status },
  ];
  const failedPlayer = playerEntries.find((entry) => entry.status.error);
  const playingPlayer = playerEntries.find((entry) => entry.status.playing);
  const observedPinyinToAudioStatus: PinyinToAudioPlaybackStatus =
    pinyinToAudioStatus.phase === 'error'
      ? pinyinToAudioStatus
      : failedPlayer
        ? {
            failedOptionId: optionByAsset.get(failedPlayer.assetKey) ?? null,
            phase: 'error',
            playingOptionId: null,
          }
        : playingPlayer
          ? {
              failedOptionId: null,
              phase: 'playing',
              playingOptionId: optionByAsset.get(playingPlayer.assetKey) ?? null,
            }
          : playerEntries.every((entry) => entry.status.isLoaded)
            ? {
                failedOptionId: null,
                phase: 'ready',
                playingOptionId: null,
              }
            : pinyinToAudioStatus;

  const playAudioToPinyin = () => {
    setAudioToPinyinFailed(false);
    void audioToPinyinPlayer
      .seekTo(0)
      .then(() => {
        audioToPinyinPlayer.play();
        setAudioToPinyinState((current) => recordAudioToPinyinPlayback(current));
      })
      .catch(() => setAudioToPinyinFailed(true));
  };

  const playPinyinToAudioOption = (optionId: string) => {
    const option = pinyinToAudioDemoExercise.options.find((item) => item.optionId === optionId);
    if (!option) return;
    const { player } = audioEntry(option.assetKey);
    ma2Player.pause();
    ma3Player.pause();
    ma4Player.pause();
    setPinyinToAudioStatus({
      failedOptionId: null,
      phase: 'ready',
      playingOptionId: null,
    });
    void player
      .seekTo(0)
      .then(() => {
        player.play();
        setPinyinToAudioState((current) =>
          recordPinyinToAudioPlayback(pinyinToAudioDemoExercise, current, optionId),
        );
      })
      .catch(() =>
        setPinyinToAudioStatus({
          failedOptionId: optionId,
          phase: 'error',
          playingOptionId: null,
        }),
      );
  };

  const retryPinyinToAudioAssets = () => {
    setPinyinToAudioStatus({
      failedOptionId: null,
      phase: 'loading',
      playingOptionId: null,
    });
    for (const option of pinyinToAudioDemoExercise.options) {
      const { player, source } = audioEntry(option.assetKey);
      player.pause();
      player.replace(source);
    }
    pinyinToAudioPreloadPromise = preloadPinyinToAudio();
    void pinyinToAudioPreloadPromise.then((success) => {
      if (!success) {
        setPinyinToAudioStatus({
          failedOptionId: null,
          phase: 'error',
          playingOptionId: null,
        });
      }
    });
  };

  return (
    <Screen scrollable>
      <View style={styles.exerciseList}>
        <AudioToPinyinExercise
          audioStatus={audioToPinyinStatus}
          exercise={audioToPinyinDemoExercise}
          onPlayAudio={playAudioToPinyin}
          onRetry={() => setAudioToPinyinState((current) => retryAudioToPinyin(current))}
          onSelectOption={(optionId) =>
            setAudioToPinyinState((current) =>
              selectAudioToPinyinOption(audioToPinyinDemoExercise, current, optionId),
            )
          }
          state={audioToPinyinState}
        />
        <PinyinToAudioExercise
          exercise={pinyinToAudioDemoExercise}
          onPlayOption={playPinyinToAudioOption}
          onRetryAnswer={() => setPinyinToAudioState((current) => retryPinyinToAudio(current))}
          onRetryAudio={retryPinyinToAudioAssets}
          onSelectOption={(optionId) =>
            setPinyinToAudioState((current) =>
              selectPinyinToAudioOption(pinyinToAudioDemoExercise, current, optionId),
            )
          }
          playbackStatus={observedPinyinToAudioStatus}
          state={pinyinToAudioState}
        />
        <PinyinToGlyphExercise
          exercise={pinyinToGlyphDemoExercise}
          onRetry={() => setPinyinToGlyphState((current) => retryPinyinToGlyph(current))}
          onSelectOption={(optionId) =>
            setPinyinToGlyphState((current) =>
              selectPinyinToGlyphOption(pinyinToGlyphDemoExercise, current, optionId),
            )
          }
          state={pinyinToGlyphState}
        />
        <GlyphToPinyinExercise
          exercise={glyphToPinyinDemoExercise}
          onHint={() => setGlyphToPinyinState((current) => requestGlyphToPinyinHint(current))}
          onRetry={() => setGlyphToPinyinState((current) => retryGlyphToPinyin(current))}
          onSelectOption={(optionId) =>
            setGlyphToPinyinState((current) =>
              selectGlyphToPinyinOption(glyphToPinyinDemoExercise, current, optionId),
            )
          }
          state={glyphToPinyinState}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  exerciseList: { gap: spacing.xxxl },
});
