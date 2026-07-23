import { useNetworkState } from 'expo-network';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/features/auth';
import { getOfflineStore, syncPendingAttemptsWithApi } from '@/features/offline-storage';

function RootNavigator() {
  const { state } = useAuth();
  const network = useNetworkState();
  useEffect(() => {
    if (state.status !== 'ready' || !network.isConnected) return;
    void getOfflineStore()
      .then((store) => syncPendingAttemptsWithApi(store))
      .catch(() => undefined);
  }, [network.isConnected, state.status]);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={state.status === 'ready'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="demo-course" />
        <Stack.Screen name="component-showcase" />
        <Stack.Screen name="audio-to-glyph-showcase" />
        <Stack.Screen name="glyph-to-image-showcase" />
        <Stack.Screen name="sentence-order-showcase" />
        <Stack.Screen name="word-build-showcase" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
