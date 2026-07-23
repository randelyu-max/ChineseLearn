import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useState } from 'react';

import ma3Audio from '../../../assets/audio/pinyin/ma3.mp3';
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

export default function PinyinScreen() {
  const player = useAudioPlayer(ma3Audio);
  const playerStatus = useAudioPlayerStatus(player);
  const [state, setState] = useState(createAudioToPinyinState);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const audioStatus: PinyinAudioStatus =
    playbackFailed || playerStatus.error
      ? 'error'
      : !playerStatus.isLoaded
        ? 'loading'
        : playerStatus.playing
          ? 'playing'
          : 'ready';

  const playAudio = () => {
    setPlaybackFailed(false);
    void player
      .seekTo(0)
      .then(() => {
        player.play();
        setState((current) => recordAudioToPinyinPlayback(current));
      })
      .catch(() => setPlaybackFailed(true));
  };

  return (
    <Screen scrollable>
      <AudioToPinyinExercise
        audioStatus={audioStatus}
        exercise={audioToPinyinDemoExercise}
        onPlayAudio={playAudio}
        onRetry={() => setState((current) => retryAudioToPinyin(current))}
        onSelectOption={(optionId) =>
          setState((current) =>
            selectAudioToPinyinOption(audioToPinyinDemoExercise, current, optionId),
          )
        }
        state={state}
      />
    </Screen>
  );
}
