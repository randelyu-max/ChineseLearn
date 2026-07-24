import { colors, fontSizes, spacing } from '@hanziquest/design-tokens';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { PRODUCTION_LEARN_ROUTE } from '@/features/session-runner';

export default function LearnScreen() {
  const router = useRouter();
  const { state } = useAuth();
  return (
    <Screen style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        你好，{state.profile?.displayName ?? '学习者'}
      </Text>
      <Text style={styles.body}>从一节短课开始，离线时也能继续上次的进度。</Text>
      <PrimaryButton
        accessibilityHint="恢复已有正式课程，或创建一节新的学习课程"
        label="继续学习"
        onPress={() => router.push(PRODUCTION_LEARN_ROUTE)}
        testID="continue-formal-learning"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textSecondary, fontSize: fontSizes.body },
  screen: { gap: spacing.lg },
  title: { color: colors.textPrimary, fontSize: 28 },
});
