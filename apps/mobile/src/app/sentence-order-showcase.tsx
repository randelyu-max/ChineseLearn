import { Redirect } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/ui';
import {
  SentenceOrderExercise,
  createSentenceOrderState,
  recordSentenceReplay,
  requestSentenceOrderHint,
  retrySentenceOrder,
  sentenceOrderDemoExercise,
  submitSentenceOrder,
  toggleSentenceTile,
} from '@/features/sentence-order';

export default function SentenceOrderShowcaseScreen() {
  return __DEV__ ? <SentenceOrderDevelopmentScreen /> : <Redirect href="/" />;
}

function SentenceOrderDevelopmentScreen() {
  const [state, setState] = useState(() => createSentenceOrderState(0));
  return (
    <Screen scrollable>
      <SentenceOrderExercise
        exercise={sentenceOrderDemoExercise}
        onHint={() => setState((current) => requestSentenceOrderHint(current))}
        onPlayAudio={() => setState((current) => recordSentenceReplay(current))}
        onRetry={() => setState((current) => retrySentenceOrder(current, performance.now()))}
        onSubmit={() => {
          const result = submitSentenceOrder(sentenceOrderDemoExercise, state, {
            attemptId: () => '00000000-0000-4000-8000-000000000099',
            nowIso: () => new Date().toISOString(),
            nowMs: () => performance.now(),
            offlineSequence: 3,
          });
          setState(result.state);
        }}
        onToggleTile={(tileId) =>
          setState((current) => toggleSentenceTile(sentenceOrderDemoExercise, current, tileId))
        }
        state={state}
      />
    </Screen>
  );
}
