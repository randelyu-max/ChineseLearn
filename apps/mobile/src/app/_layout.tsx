import { useNetworkState } from 'expo-network';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/features/auth';
import { diagnosticRequester, loadLocalDiagnostic, syncDiagnostic } from '@/features/diagnostic';
import { syncFormalAttemptsWithApi } from '@/features/formal-session/sync-with-api';
import { getOfflineStore, syncPendingAttemptsWithApi } from '@/features/offline-storage';
import { DEVELOPMENT_ONLY_ROUTES } from '@/features/session-runner';

function RootNavigator() {
  const { state } = useAuth();
  const network = useNetworkState();
  useEffect(() => {
    const userId = state.userId;
    if (state.status !== 'ready' || !userId || !network.isConnected) return;
    void getOfflineStore()
      .then(async (store) => {
        const diagnostic = await loadLocalDiagnostic(store, userId);
        return Promise.all([
          syncPendingAttemptsWithApi(store),
          syncFormalAttemptsWithApi(store, userId),
          diagnostic ? syncDiagnostic(store, diagnostic, diagnosticRequester) : Promise.resolve(),
        ]);
      })
      .catch(() => undefined);
  }, [network.isConnected, state.status, state.userId]);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={state.status === 'ready'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="diagnostic" />
        <Stack.Screen name="session" />
        {__DEV__
          ? DEVELOPMENT_ONLY_ROUTES.map((name) => <Stack.Screen key={name} name={name} />)
          : null}
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
