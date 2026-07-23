import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/ui';
import { ParentGateChallenge, parseParentGateIntent, useParentGate } from '@/features/parent-gate';

export default function ParentGateScreen() {
  const parameters = useLocalSearchParams<{ intent?: string | string[] }>();
  const intent = parseParentGateIntent(parameters.intent) ?? 'parent_area';
  const { challengeState, destination, grant, setChallengeState } = useParentGate();

  return (
    <Screen scrollable>
      <ParentGateChallenge
        gateState={challengeState}
        onStateChange={setChallengeState}
        onUnlock={() => {
          grant(intent);
          router.replace(destination(intent));
        }}
      />
    </Screen>
  );
}
