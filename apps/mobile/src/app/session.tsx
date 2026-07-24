import { colors, spacing } from '@hanziquest/design-tokens';
import * as Crypto from 'expo-crypto';
import { useNetworkState } from 'expo-network';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ErrorState, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { formalSessionApi } from '@/features/formal-session/api-with-client';
import { syncFormalAttemptsWithApi } from '@/features/formal-session/sync-with-api';
import { getOfflineStore, type FormalSessionCacheRecord } from '@/features/offline-storage';
import {
  enterLearnSession,
  FormalSessionRunner,
  type LearnEntryResult,
} from '@/features/session-runner';

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; session: FormalSessionCacheRecord }
  | { status: 'error'; code: Extract<LearnEntryResult, { status: 'error' }>['code'] };

const errorCopy = {
  auth_expired: {
    title: '登录已过期',
    message: '请重新登录。设备上尚未同步的学习记录会继续保留。',
  },
  content_unavailable: {
    title: '暂时没有合适的新内容',
    message: '可以稍后再试，或先完成已经到期的复习。',
  },
  network_required: {
    title: '需要连接网络',
    message: '开始新课程需要联网；已经开始并缓存的课程仍可离线继续。',
  },
  recovery_choice_required: {
    title: '还有学习记录等待同步',
    message: '请先连接网络完成同步，我们不会覆盖设备上尚未上传的作答。',
  },
  request_failed: {
    title: '暂时无法准备课程',
    message: '请检查网络后重试。设备上的现有进度不会丢失。',
  },
  unsupported_schema: {
    title: '需要更新应用',
    message: '这节课程使用当前版本无法安全读取的数据格式。',
  },
} as const;

export default function FormalSessionScreen() {
  const { state, signOut } = useAuth();
  const network = useNetworkState();
  const router = useRouter();
  const [page, setPage] = useState<PageState>({ status: 'loading' });

  const load = useCallback(async (): Promise<PageState> => {
    if (state.status !== 'ready' || !state.userId || !state.profile) {
      return { status: 'loading' };
    }
    try {
      const store = await getOfflineStore();
      const result = await enterLearnSession({
        api: formalSessionApi,
        clientSessionId: () => Crypto.randomUUID(),
        idempotencyKey: () => `mobile-plan:${Crypto.randomUUID()}`,
        isOnline: Boolean(network.isConnected),
        nowIso: new Date().toISOString(),
        store,
        sync: syncFormalAttemptsWithApi,
        targetMinutes: state.profile.dailyGoalMinutes,
        userId: state.userId,
      });
      return result.status === 'ready'
        ? { status: 'ready', session: result.session }
        : { status: 'error', code: result.code };
    } catch {
      return { status: 'error', code: 'request_failed' };
    }
  }, [network.isConnected, state.profile, state.status, state.userId]);

  useEffect(() => {
    let active = true;
    void load().then((next) => {
      if (active) setPage(next);
    });
    return () => {
      active = false;
    };
  }, [load]);

  if (page.status === 'loading') {
    return (
      <Screen style={styles.centered}>
        <LoadingState message="正在恢复或准备正式课程…" />
      </Screen>
    );
  }
  if (page.status === 'error') {
    const copy = errorCopy[page.code];
    return (
      <Screen style={styles.centered}>
        <ErrorState
          actionLabel={page.code === 'auth_expired' ? '重新登录' : '再试一次'}
          message={copy.message}
          onRetry={() => {
            if (page.code === 'auth_expired') {
              void signOut().then(() => router.replace('/sign-in'));
            } else {
              setPage({ status: 'loading' });
              void load().then(setPage);
            }
          }}
          title={copy.title}
        />
      </Screen>
    );
  }
  if (!state.userId) {
    return (
      <Screen style={styles.centered}>
        <ErrorState message="请重新登录后继续。" title="登录状态不可用" />
      </Screen>
    );
  }
  return <FormalSessionRunner initialSession={page.session} userId={state.userId} />;
}

const styles = StyleSheet.create({
  centered: {
    backgroundColor: colors.background,
    gap: spacing.lg,
    justifyContent: 'center',
  },
});
