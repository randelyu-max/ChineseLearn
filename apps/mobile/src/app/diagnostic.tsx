import { colors, fontSizes, fontWeights, radii, spacing } from '@hanziquest/design-tokens';
import * as Crypto from 'expo-crypto';
import { useNetworkState } from 'expo-network';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LoadingState, PrimaryButton, Screen } from '@/components/ui';
import {
  answerDiagnostic,
  createLocalDiagnostic,
  diagnosticContentItems,
  diagnosticRequester,
  loadLocalDiagnostic,
  nextDiagnosticStep,
  pauseDiagnostic,
  resultMessage,
  resumeDiagnostic,
  saveLocalDiagnostic,
  skipDiagnostic,
  syncDiagnostic,
  type LocalDiagnostic,
} from '@/features/diagnostic';
import { useAuth } from '@/features/auth';
import { getOfflineStore } from '@/features/offline-storage';

export default function DiagnosticScreen() {
  const { state, signOut } = useAuth();
  const network = useNetworkState();
  const router = useRouter();
  const [record, setRecord] = useState<LocalDiagnostic | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== 'ready' || !state.userId) return;
    void getOfflineStore()
      .then(async (store) => {
        const existing = await loadLocalDiagnostic(store, state.userId!);
        if (!existing || existing.status !== 'in_progress') return existing;
        const resumed = resumeDiagnostic({ ...existing, resumedAtMs: null }, Date.now());
        await saveLocalDiagnostic(store, resumed);
        return resumed;
      })
      .then(setRecord)
      .finally(() => setLoaded(true));
  }, [state.status, state.userId]);

  const step = useMemo(
    () =>
      record?.status === 'in_progress'
        ? nextDiagnosticStep(record, record.resumedAtMs ?? record.state.startedAtMs)
        : record?.result
          ? ({ kind: 'complete', result: record.result } as const)
          : null,
    [record],
  );
  const content =
    step?.kind === 'present_item'
      ? diagnosticContentItems.find((candidate) => candidate.item.id === step.item.id)
      : null;

  const persistAndSync = async (next: LocalDiagnostic) => {
    const store = await getOfflineStore();
    await saveLocalDiagnostic(store, next);
    setRecord(next);
    if (!network.isConnected) {
      setNotice('当前离线，进度已安全保存在这台设备上。');
      return;
    }
    const synced = await syncDiagnostic(store, next, diagnosticRequester);
    if (synced === 'auth_expired') {
      await signOut();
      router.replace('/sign-in');
    } else if (synced === 'pending') {
      setNotice('进度已保存在设备上，联网后会再次同步。');
    }
  };

  const start = async () => {
    if (state.status !== 'ready' || !state.userId) return;
    const nowIso = new Date().toISOString();
    const next = createLocalDiagnostic({
      nowIso,
      runId: Crypto.randomUUID(),
      seed: `diagnostic:${state.userId}:${nowIso}`,
      userId: state.userId,
    });
    setNotice(null);
    await persistAndSync(next);
  };

  if (!loaded) {
    return (
      <Screen style={styles.centered}>
        <LoadingState message="正在准备能力定位…" />
      </Screen>
    );
  }

  if (!record) {
    return (
      <Screen scrollable style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          找到适合你的起点
        </Text>
        <Text style={styles.body}>
          这是一组约 5–7 分钟的低压力练习，优先使用听音、拼音和汉字，不评价口音，也不会录音。
        </Text>
        <Text style={styles.body}>
          结果只用于安排最初几节课；之后的真实学习表现会逐步替代这次建议。
        </Text>
        <PrimaryButton label="开始能力定位" onPress={() => void start()} />
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            if (state.status !== 'ready' || !state.userId) return;
            const nowIso = new Date().toISOString();
            const initial = createLocalDiagnostic({
              nowIso,
              runId: Crypto.randomUUID(),
              seed: `diagnostic:${state.userId}:${nowIso}`,
              userId: state.userId,
            });
            await persistAndSync(skipDiagnostic(initial));
            router.replace('/(tabs)');
          }}
          style={styles.linkButton}
        >
          <Text style={styles.link}>暂时跳过，使用平衡起点</Text>
        </Pressable>
      </Screen>
    );
  }

  if (record.status === 'pending_completed' && record.result) {
    return (
      <Screen style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          建议从这里开始
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.result}>
          {resultMessage(record.result)}
        </Text>
        <Text style={styles.body}>这不是考试等级，后续课程会根据你的真实练习继续调整。</Text>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <PrimaryButton label="进入学习主页" onPress={() => router.replace('/(tabs)')} />
      </Screen>
    );
  }

  if (paused) {
    return (
      <Screen style={styles.screen}>
        <Text accessibilityRole="header" style={styles.title}>
          能力定位已暂停
        </Text>
        <Text style={styles.body}>进度已保存在这台设备上，可以随时继续。</Text>
        <PrimaryButton
          label="继续"
          onPress={() => {
            const resumed = resumeDiagnostic(record, Date.now());
            void getOfflineStore().then((store) => saveLocalDiagnostic(store, resumed));
            setRecord(resumed);
            setPaused(false);
          }}
        />
      </Screen>
    );
  }

  if (!content || step?.kind !== 'present_item') {
    return (
      <Screen style={styles.centered}>
        <LoadingState message="正在整理建议…" />
      </Screen>
    );
  }

  return (
    <Screen scrollable style={styles.screen}>
      <Text style={styles.progress}>第 {record.state.observations.length + 1} 题 · 最多 36 题</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {content.prompt}
      </Text>
      {content.speechText ? (
        <PrimaryButton
          accessibilityHint="使用系统中文语音朗读本题，不会录音"
          label="播放声音"
          onPress={() => Speech.speak(content.speechText!, { language: 'zh-CN', rate: 0.85 })}
        />
      ) : null}
      <View accessibilityRole="radiogroup" style={styles.options}>
        {content.options.map((option) => (
          <Pressable
            aria-checked={false}
            accessibilityRole="radio"
            accessibilityState={{ checked: false }}
            key={option.id}
            onPress={async () => {
              const next = answerDiagnostic(
                record,
                content.item,
                option.id === content.correctOptionId,
                Date.now(),
              );
              await persistAndSync(next);
            }}
            style={styles.option}
          >
            <Text style={styles.optionText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          const next = pauseDiagnostic(record, Date.now());
          void getOfflineStore().then((store) => saveLocalDiagnostic(store, next));
          setRecord(next);
          setPaused(true);
        }}
        style={styles.linkButton}
      >
        <Text style={styles.link}>暂停</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.textSecondary, fontSize: fontSizes.body, lineHeight: 24 },
  centered: { justifyContent: 'center' },
  link: { color: colors.primary, fontSize: fontSizes.body, fontWeight: fontWeights.semibold },
  linkButton: { alignItems: 'center', padding: spacing.md },
  notice: { color: colors.textSecondary, fontSize: fontSizes.caption },
  option: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
  },
  optionText: { color: colors.textPrimary, fontSize: fontSizes.bodyLarge },
  options: { gap: spacing.md },
  progress: { color: colors.textSecondary, fontSize: fontSizes.caption },
  result: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    lineHeight: 34,
    padding: spacing.xl,
  },
  screen: { gap: spacing.xl, paddingBottom: spacing.xxl },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
  },
});
