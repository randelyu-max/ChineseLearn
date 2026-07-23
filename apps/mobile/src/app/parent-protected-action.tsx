import { router, useLocalSearchParams, type Href } from 'expo-router';

import { LoadingState, PrimaryButton, Screen } from '@/components/ui';
import {
  parseParentGateIntent,
  useRequireParentGate,
  type ParentGateIntent,
} from '@/features/parent-gate';
import { AuthSuccess, ParentAuthScreen } from '@/features/parent-auth/components';

const labels: Record<Exclude<ParentGateIntent, 'parent_area'>, string> = {
  external_link: '外部链接',
  privacy: '隐私操作',
  purchase: '订阅与购买',
  settings: '家长设置',
};

export default function ParentProtectedActionScreen() {
  const parameters = useLocalSearchParams<{ intent?: string | string[] }>();
  const parsed = parseParentGateIntent(parameters.intent);
  const intent = parsed && parsed !== 'parent_area' ? parsed : 'settings';
  const allowed = useRequireParentGate(intent);

  if (!allowed) {
    return (
      <Screen>
        <LoadingState message="正在进入家长验证…" />
      </Screen>
    );
  }

  return (
    <ParentAuthScreen
      description="Task 2.5 只建立保护边界，不提前实现购买、设置或外链业务。"
      title={labels[intent]}
    >
      <AuthSuccess message="家长验证已通过。此敏感入口已受到独立家长门保护。" />
      <PrimaryButton
        label="返回家长账户"
        onPress={() => router.replace('/parent-account' as Href)}
      />
    </ParentAuthScreen>
  );
}
