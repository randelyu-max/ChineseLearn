import {
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
} from '@hanziquest/design-tokens';
import { type Href, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import {
  AudioButton,
  ErrorState,
  HanziText,
  IconButton,
  LoadingState,
  PrimaryButton,
  ProgressBar,
  Screen,
  useReducedMotion,
} from '@/components/ui';

function ShowcaseSection({ children, title }: React.PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function ComponentShowcaseScreen() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();

  return (
    <Screen scrollable style={styles.container}>
      <Text accessibilityRole="header" style={styles.pageTitle}>
        基础组件展示
      </Text>
      <Text style={styles.description}>
        每个交互目标至少 48dp；状态同时使用文字、形状或图标表达，不只依赖颜色。
      </Text>

      <ShowcaseSection title="按钮状态">
        <PrimaryButton label="继续学习" onPress={() => undefined} />
        <PrimaryButton disabled label="暂不可用" onPress={() => undefined} />
        <PrimaryButton label="正在准备" loading onPress={() => undefined} />
        <View style={styles.inlineControls}>
          <IconButton
            accessibilityLabel="关闭展示"
            icon={<Text style={styles.iconGlyph}>×</Text>}
            onPress={() => undefined}
          />
          <AudioButton onPress={() => undefined} />
        </View>
      </ShowcaseSection>

      <ShowcaseSection title="汉字层级">
        <HanziText emphasis="target">水</HanziText>
        <HanziText size="display">喝水</HanziText>
        <HanziText size="body">目标字使用下划线和字重共同强调。</HanziText>
      </ShowcaseSection>

      <ShowcaseSection title="进度与动效">
        <Text style={styles.motionStatus}>
          系统减少动态效果：{reduceMotion ? '已开启' : '未开启'}
        </Text>
        <ProgressBar label="今日任务" value={0.64} />
      </ShowcaseSection>

      <ShowcaseSection title="加载与错误">
        <LoadingState />
        <ErrorState message="可以稍后再试，已经完成的内容不会丢失。" onRetry={() => undefined} />
      </ShowcaseSection>
      <ShowcaseSection title="P0 题型">
        <PrimaryButton
          label="检查听音选字"
          onPress={() => router.push('/audio-to-glyph-showcase' as Href)}
        />
        <PrimaryButton
          label="检查看字选图"
          onPress={() => router.push('/glyph-to-image-showcase' as Href)}
        />
        <PrimaryButton
          label="检查组词"
          onPress={() => router.push('/word-build-showcase' as Href)}
        />
        <PrimaryButton
          label="检查排句"
          onPress={() => router.push('/sentence-order-showcase' as Href)}
        />
      </ShowcaseSection>
      <StatusBar style="dark" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  description: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  iconGlyph: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    lineHeight: lineHeights.heading,
  },
  inlineControls: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  motionStatus: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.bodyLarge,
  },
});
