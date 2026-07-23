import { Stack } from 'expo-router';

import { AuthProvider, useAuth } from '@/features/auth';

function RootNavigator() {
  const { state } = useAuth();
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
