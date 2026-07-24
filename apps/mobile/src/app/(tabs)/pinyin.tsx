import {
  borders,
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
} from '@hanziquest/design-tokens';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, ProgressBar, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { getOfflineStore, type FormalSessionCacheRecord } from '@/features/offline-storage';
import { PRODUCTION_PINYIN_ROUTE } from '@/features/session-runner';
import { summarizePinyinProgress } from '@/features/session-runner/pinyin-entry';

export default function PinyinScreen() {
  const { state } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<FormalSessionCacheRecord | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const userId = state.userId;
      if (state.status !== 'ready' || !userId) {
        return () => {
          active = false;
        };
      }
      void getOfflineStore()
        .then((store) => store.getActiveFormalSession(userId))
        .then((result) => {
          if (active) setSession(result);
        })
        .catch(() => {
          if (active) setSession(null);
        });
      return () => {
        active = false;
      };
    }, [state.status, state.userId]),
  );

  const progress = summarizePinyinProgress(
    state.status === 'ready' && state.userId ? session : null,
  );
  const recommendation = progress.recommendation === 'review_tones' ? '复习声调' : '继续拼音学习';
  const progressValue = progress.total === 0 ? 0 : progress.completed / progress.total;

  return (
    <Screen scrollable style={styles.screen}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          拼音
        </Text>
        <Text style={styles.body}>
          通过正式学习 Session 练习听音、声调、拼音与汉字之间的对应关系。
        </Text>
      </View>

      <View style={styles.card} testID="formal-pinyin-progress">
        <Text style={styles.cardLabel}>当前拼音进度</Text>
        <ProgressBar label="当前正式课程的拼音进度" value={progressValue} />
        <Text style={styles.progressText}>
          {progress.total > 0
            ? `本节已完成 ${progress.completed} / ${progress.total} 道拼音练习`
            : '当前没有进行中的拼音练习；开始新课程后会自动安排合适内容。'}
        </Text>
      </View>

      <View style={styles.recommendation}>
        <Text style={styles.cardLabel}>建议</Text>
        <Text accessibilityLiveRegion="polite" style={styles.recommendationText}>
          {recommendation}
        </Text>
        <Text style={styles.body}>
          新课程会由服务器根据已发布内容与学习记录规划，并可混合汉字和拼音练习。
        </Text>
        <PrimaryButton
          label={recommendation}
          onPress={() => router.push(PRODUCTION_PINYIN_ROUTE)}
          testID="start-formal-pinyin-session"
        />
      </View>

      <Text style={styles.privacy}>
        发音音频随应用提供并可离线播放。本功能不启用麦克风、不录音，也不上传声音。
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    gap: spacing.md,
    padding: spacing.xl,
  },
  cardLabel: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.bodyLarge,
  },
  header: { gap: spacing.sm },
  privacy: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
  },
  progressText: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  recommendation: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.xl,
  },
  recommendationText: {
    color: colors.primary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
  },
  screen: { gap: spacing.xl, paddingBottom: spacing.xxl },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display,
  },
});
