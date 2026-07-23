import { LoadingState, Screen } from '@/components/ui';

export function ParentGateLoading() {
  return (
    <Screen>
      <LoadingState message="正在进入家长验证…" />
    </Screen>
  );
}
