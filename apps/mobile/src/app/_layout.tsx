import { Stack } from 'expo-router';

import { ParentAuthProvider } from '@/features/parent-auth';
import { ParentGateProvider } from '@/features/parent-gate';

export default function RootLayout() {
  return (
    <ParentGateProvider>
      <ParentAuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ParentAuthProvider>
    </ParentGateProvider>
  );
}
