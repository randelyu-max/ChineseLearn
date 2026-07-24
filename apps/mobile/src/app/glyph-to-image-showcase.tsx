import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/ui';
import {
  GlyphToImageExercise,
  createGlyphToImageState,
  glyphToImageDemoExercise,
  recordGlyphAudioReplay,
  requestGlyphToImageHint,
  retryGlyphToImage,
  selectGlyphToImageOption,
} from '@/features/glyph-to-image';

const demoVisuals: Record<string, string> = {
  '00000000-0000-4000-8000-000000000025': '💧',
  '00000000-0000-4000-8000-000000000027': '🌳',
  '00000000-0000-4000-8000-000000000029': '🍚',
};

export default function GlyphToImageShowcaseScreen() {
  return __DEV__ ? <GlyphToImageDevelopmentScreen /> : <Redirect href="/" />;
}

function GlyphToImageDevelopmentScreen() {
  const [state, setState] = useState(() => createGlyphToImageState(0));
  return (
    <Screen scrollable>
      <GlyphToImageExercise
        exercise={glyphToImageDemoExercise}
        onHint={() => setState((current) => requestGlyphToImageHint(current))}
        onPlayAudio={() => setState((current) => recordGlyphAudioReplay(current))}
        onRetry={() => setState((current) => retryGlyphToImage(current, performance.now()))}
        onSelectOption={(optionId) => {
          const result = selectGlyphToImageOption(glyphToImageDemoExercise, state, optionId, {
            attemptId: () => '00000000-0000-4000-8000-000000000099',
            nowIso: () => new Date().toISOString(),
            nowMs: () => performance.now(),
            offlineSequence: 1,
          });
          setState(result.state);
        }}
        renderOptionVisual={(option) => (
          <Text style={styles.emoji}>{demoVisuals[option.imageAssetId] ?? '□'}</Text>
        )}
        state={state}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ emoji: { fontSize: 48, lineHeight: 64 } });
