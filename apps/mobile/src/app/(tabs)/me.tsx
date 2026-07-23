import { colors, fontSizes, spacing } from '@hanziquest/design-tokens';
import { type Href, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';

export default function MeScreen() {
  const { signOut, state } = useAuth();
  const router = useRouter();
  return (
    <Screen style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        我的
      </Text>
      <Text style={styles.body}>{state.profile?.displayName}</Text>
      {state.profile?.chineseName ? (
        <Text style={styles.body}>中文名：{state.profile.chineseName}</Text>
      ) : null}
      <Text style={styles.body}>每日目标：{state.profile?.dailyGoalMinutes} 分钟</Text>
      <PrimaryButton label="编辑个人设置" onPress={() => router.push('/onboarding' as Href)} />
      <PrimaryButton label="退出登录" onPress={() => void signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textSecondary, fontSize: fontSizes.body },
  screen: { gap: spacing.lg },
  title: { color: colors.textPrimary, fontSize: 28 },
});
