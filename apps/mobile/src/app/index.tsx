import { colors, fontSizes, fontWeights, lineHeights, spacing } from '@hanziquest/design-tokens';
import { type Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { ParentGateTrigger, PrimaryButton, Screen } from '@/components/ui';
import { appMetadata } from '@/config/app';
import { parentGateHref } from '@/features/parent-gate';

export default function IndexScreen() {
  const router = useRouter();

  return (
    <Screen style={styles.container}>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.title}>
          {appMetadata.name}
        </Text>
        <Text style={styles.subtitle}>Task 0.3 设计系统基础已就绪。</Text>
      </View>
      <PrimaryButton
        label="开始“我的家”演示课"
        onPress={() => router.push('/demo-course' as Href)}
      />
      <PrimaryButton
        label="检查基础组件"
        onPress={() => router.push('/component-showcase' as Href)}
      />
      <ParentGateTrigger
        label="进入家长区"
        onPress={() => router.push(parentGateHref('parent_area'))}
      />
      <StatusBar style="dark" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxl,
    justifyContent: 'center',
  },
  intro: {
    gap: spacing.md,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    textAlign: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display,
    textAlign: 'center',
  },
});
