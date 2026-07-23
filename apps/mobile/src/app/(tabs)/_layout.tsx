import { Redirect, Tabs } from 'expo-router';

import { mainDestinations, useAuth } from '@/features/auth';

export default function MainTabsLayout() {
  const { state } = useAuth();
  if (state.status !== 'ready') return <Redirect href="/" />;
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      {mainDestinations.map((destination) => (
        <Tabs.Screen
          key={destination.name}
          name={destination.name}
          options={{ title: destination.title }}
        />
      ))}
    </Tabs>
  );
}
