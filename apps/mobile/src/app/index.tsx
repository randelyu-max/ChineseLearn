import { Redirect, type Href } from 'expo-router';

import { ErrorState, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';

export default function IndexScreen() {
  const { refreshProfile, state } = useAuth();
  if (state.status === 'restoring' || state.status === 'authenticated_profile_loading') {
    return (
      <Screen>
        <LoadingState message="正在恢复登录状态…" />
      </Screen>
    );
  }
  if (state.status === 'profile_error') {
    return (
      <Screen>
        <ErrorState message={state.notice ?? '暂时无法读取个人设置。'} onRetry={refreshProfile} />
      </Screen>
    );
  }
  if (state.status === 'recovery') return <Redirect href={'/update-password' as Href} />;
  if (state.status === 'unauthenticated') return <Redirect href={'/sign-in' as Href} />;
  if (state.status === 'onboarding_required') return <Redirect href={'/onboarding' as Href} />;
  return <Redirect href={'/(tabs)' as Href} />;
}
