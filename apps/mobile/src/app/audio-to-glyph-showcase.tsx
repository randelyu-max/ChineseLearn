import { useState } from 'react';
import { Text } from 'react-native';

import { Screen } from '@/components/ui';
import {
  AudioToGlyphExercise,
  audioToGlyphDemoExercise,
  createAudioToGlyphState,
  recordAudioReplay,
  requestVisualHint,
  retryAudioToGlyph,
  selectAudioToGlyphOption,
} from '@/features/audio-to-glyph';

export default function AudioToGlyphShowcaseScreen() {
  const [state, setState] = useState(() => createAudioToGlyphState(0));
  const [attemptCreated, setAttemptCreated] = useState(false);

  return (
    <Screen scrollable>
      <AudioToGlyphExercise
        exercise={audioToGlyphDemoExercise}
        onHint={() => setState((current) => requestVisualHint(current))}
        onPlayAudio={() => setState((current) => recordAudioReplay(current))}
        onRetry={() => setState((current) => retryAudioToGlyph(current, performance.now()))}
        onSelectOption={(optionId) => {
          const result = selectAudioToGlyphOption(audioToGlyphDemoExercise, state, optionId, {
            attemptId: () => '00000000-0000-4000-8000-000000000099',
            nowIso: () => new Date().toISOString(),
            nowMs: () => performance.now(),
            offlineSequence: 0,
          });
          setState(result.state);
          setAttemptCreated(result.attempt !== null);
        }}
        state={state}
      />
      {attemptCreated ? (
        <Text accessibilityLiveRegion="polite">标准化 attempt 草稿已在本地创建。</Text>
      ) : null}
    </Screen>
  );
}
