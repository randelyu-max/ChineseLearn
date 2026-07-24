import type { ReviewCenterResponseData } from '@hanziquest/contracts';
import {
  borders,
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
} from '@hanziquest/design-tokens';
import * as Crypto from 'expo-crypto';
import { useNetworkState } from 'expo-network';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorState, LoadingState, PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { formalSessionApi } from '@/features/formal-session/api-with-client';
import { syncFormalAttemptsWithApi } from '@/features/formal-session/sync-with-api';
import { getOfflineStore, type FormalSessionCacheRecord } from '@/features/offline-storage';
import {
  loadReviewCenter,
  reviewCenterRequester,
  reviewReasonLabels,
} from '@/features/review-center';
import { enterReviewSession, PRODUCTION_REVIEW_ROUTE } from '@/features/session-runner';

type PageState =
  | { status: 'loading' }
  | {
      status: 'ready';
      source: 'fresh' | 'cached_offline';
      data: ReviewCenterResponseData;
      activeSession: FormalSessionCacheRecord | null;
    }
  | { status: 'auth_expired' | 'offline_no_cache' | 'request_failed' };

const groupLabels = {
  hanzi: '汉字',
  pinyin: '拼音',
  tone: '声调',
  word: '词语',
  sentence: '句子',
  confusion: '易混内容',
} as const;

function nextDueLabel(value: string | null): string {
  if (!value) return '暂无下一次到期时间';
  return `下次复习：${new Date(value).toLocaleString()}`;
}

export default function ReviewScreen() {
  const { state, signOut } = useAuth();
  const network = useNetworkState();
  const router = useRouter();
  const [page, setPage] = useState<PageState>({ status: 'loading' });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (state.status !== 'ready' || !state.userId) return;
    setPage({ status: 'loading' });
    const store = await getOfflineStore();
    const [result, activeSession] = await Promise.all([
      loadReviewCenter({
        isOnline: Boolean(network.isConnected),
        nowIso: new Date().toISOString(),
        request: reviewCenterRequester,
        store,
        userId: state.userId,
      }),
      store.getActiveFormalSession(state.userId),
    ]);
    if (result.status === 'fresh' || result.status === 'cached_offline') {
      setPage({ status: 'ready', source: result.status, data: result.data, activeSession });
    } else {
      setPage({ status: result.status });
    }
  }, [network.isConnected, state.status, state.userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh().catch(() => setPage({ status: 'request_failed' }));
    }, [refresh]),
  );

  const startReview = async () => {
    if (state.status !== 'ready' || !state.userId || !state.profile || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const store = await getOfflineStore();
      const result = await enterReviewSession({
        api: formalSessionApi,
        clientSessionId: () => Crypto.randomUUID(),
        idempotencyKey: () => `mobile-review-plan:${Crypto.randomUUID()}`,
        isOnline: Boolean(network.isConnected),
        nowIso: new Date().toISOString(),
        store,
        sync: syncFormalAttemptsWithApi,
        targetMinutes: state.profile.dailyGoalMinutes,
        userId: state.userId,
      });
      if (result.status === 'ready') {
        router.push(PRODUCTION_REVIEW_ROUTE);
        return;
      }
      if (result.code === 'auth_expired') {
        await signOut();
        router.replace('/sign-in');
        return;
      }
      setStartError(
        result.code === 'network_required'
          ? '开始新的复习需要联网；已开始的课程仍可离线继续。'
          : result.code === 'content_unavailable'
            ? '当前没有可安全安排的复习内容。'
            : '暂时无法创建复习课程，请稍后重试。',
      );
    } finally {
      setStarting(false);
    }
  };

  if (page.status === 'loading') {
    return (
      <Screen style={styles.centered}>
        <LoadingState message="正在读取复习计划…" />
      </Screen>
    );
  }
  if (page.status !== 'ready') {
    const offline = page.status === 'offline_no_cache';
    return (
      <Screen style={styles.centered}>
        <ErrorState
          actionLabel={page.status === 'auth_expired' ? '重新登录' : '刷新'}
          message={
            offline
              ? '设备上还没有缓存的复习计划，请联网后刷新。'
              : page.status === 'auth_expired'
                ? '登录已过期，请重新登录。'
                : '暂时无法读取复习计划，现有学习记录不会丢失。'
          }
          onRetry={() => {
            if (page.status === 'auth_expired') {
              void signOut().then(() => router.replace('/sign-in'));
            } else {
              void refresh();
            }
          }}
          title={offline ? '离线且没有缓存' : '复习计划不可用'}
        />
      </Screen>
    );
  }

  const { data, activeSession } = page;
  const noHistory = data.summary.dueNowCount === 0 && data.summary.nextDueAt === null;
  return (
    <Screen scrollable style={styles.screen}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          复习
        </Text>
        <Text style={styles.body}>复习内容由服务器根据学习记录安排，完成后会自动更新。</Text>
        {page.source === 'cached_offline' ? (
          <Text accessibilityLiveRegion="polite" style={styles.offlineNotice}>
            当前显示离线缓存；联网后刷新可获取最新计划。
          </Text>
        ) : null}
      </View>

      <View accessibilityLabel="复习摘要" style={styles.summary}>
        <View>
          <Text style={styles.metric}>{data.summary.dueNowCount}</Text>
          <Text style={styles.caption}>到期</Text>
        </View>
        <View>
          <Text style={styles.metric}>{data.summary.overdueCount}</Text>
          <Text style={styles.caption}>逾期</Text>
        </View>
        <View>
          <Text style={styles.metric}>{data.summary.estimatedMinutes}</Text>
          <Text style={styles.caption}>预计分钟</Text>
        </View>
      </View>

      {activeSession ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>有一节课程正在进行</Text>
          <Text style={styles.body}>继续当前课程，系统不会重复创建 Session。</Text>
          <PrimaryButton
            label="继续当前课程"
            onPress={() => router.push(PRODUCTION_REVIEW_ROUTE)}
          />
        </View>
      ) : data.summary.dueNowCount > 0 ? (
        <PrimaryButton
          disabled={starting}
          label={starting ? '正在准备复习…' : '开始复习'}
          onPress={() => void startReview()}
        />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {noHistory ? '开始学习后，这里会出现复习计划' : '今天的复习已完成'}
          </Text>
          <Text style={styles.body}>{nextDueLabel(data.summary.nextDueAt)}</Text>
        </View>
      )}
      {startError ? (
        <Text accessibilityLiveRegion="assertive" style={styles.error}>
          {startError}
        </Text>
      ) : null}

      <View style={styles.groups}>
        {data.groups
          .filter((group) => group.count > 0)
          .map((group) => (
            <View key={group.kind} style={styles.groupPill}>
              <Text style={styles.groupText}>
                {groupLabels[group.kind]} {group.count}
              </Text>
            </View>
          ))}
      </View>

      {data.items.map((item) => (
        <View key={item.reviewKey} style={styles.item}>
          <View style={styles.itemText}>
            <Text style={styles.cardTitle}>{item.displayLabel}</Text>
            {item.secondaryLabel ? <Text style={styles.body}>{item.secondaryLabel}</Text> : null}
            <Text style={styles.reason}>{reviewReasonLabels[item.reasonCode]}</Text>
          </View>
          <Text style={item.isOverdue ? styles.overdue : styles.caption}>
            {item.isOverdue ? '已到期' : '今日'}
          </Text>
        </View>
      ))}
      {data.pageInfo.hasMore ? (
        <Text style={styles.caption}>还有更多到期内容，正式复习 Session 会由服务器安全安排。</Text>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.refresh}>
        <Text style={styles.refreshText}>刷新复习计划</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: lineHeights.body },
  caption: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    gap: spacing.md,
    padding: spacing.xl,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.bodyLarge,
  },
  centered: { justifyContent: 'center' },
  error: { color: colors.danger, fontSize: fontSizes.body, lineHeight: lineHeights.body },
  groupPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  groupText: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: lineHeights.body },
  groups: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  header: { gap: spacing.sm },
  item: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  itemText: { flex: 1, gap: spacing.xs },
  metric: {
    color: colors.primary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
    textAlign: 'center',
  },
  offlineNotice: {
    backgroundColor: colors.warningSurface,
    color: colors.textPrimary,
    padding: spacing.md,
  },
  overdue: { color: colors.danger, fontSize: fontSizes.caption, lineHeight: lineHeights.caption },
  reason: { color: colors.primary, fontSize: fontSizes.caption, lineHeight: lineHeights.caption },
  refresh: { alignSelf: 'center', padding: spacing.md },
  refreshText: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  screen: { gap: spacing.xl, paddingBottom: spacing.xxl },
  summary: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.xl,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display,
  },
});
