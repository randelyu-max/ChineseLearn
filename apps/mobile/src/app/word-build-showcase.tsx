import { Redirect } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/ui';
import {
  WordBuildExercise,
  createWordBuildState,
  recordWordBuildReplay,
  requestWordBuildHint,
  retryWordBuild,
  submitWordBuild,
  toggleWordBuildTile,
  wordBuildDemoExercise,
} from '@/features/word-build';

export default function WordBuildShowcaseScreen() {
  return __DEV__ ? <WordBuildDevelopmentScreen /> : <Redirect href="/" />;
}

function WordBuildDevelopmentScreen() {
  const [state, setState] = useState(() => createWordBuildState(0));
  return (
    <Screen scrollable>
      <WordBuildExercise
        exercise={wordBuildDemoExercise}
        onHint={() => setState((current) => requestWordBuildHint(current))}
        onPlayAudio={() => setState((current) => recordWordBuildReplay(current))}
        onRetry={() => setState((current) => retryWordBuild(current, performance.now()))}
        onSubmit={() => {
          const result = submitWordBuild(wordBuildDemoExercise, state, {
            attemptId: () => '00000000-0000-4000-8000-000000000099',
            nowIso: () => new Date().toISOString(),
            nowMs: () => performance.now(),
            offlineSequence: 2,
          });
          setState(result.state);
        }}
        onToggleTile={(tileId) =>
          setState((current) => toggleWordBuildTile(wordBuildDemoExercise, current, tileId))
        }
        state={state}
      />
    </Screen>
  );
}
