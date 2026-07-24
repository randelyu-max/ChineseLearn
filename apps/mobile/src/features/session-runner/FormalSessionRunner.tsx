import type { AttemptAnswerV2, AttemptDraftV2 } from '@hanziquest/contracts';
import {
  borders,
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
} from '@hanziquest/design-tokens';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useNetworkState } from 'expo-network';
import * as Crypto from 'expo-crypto';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AudioButton, ErrorState, PrimaryButton, ProgressBar, Screen } from '@/components/ui';
import { formalSessionApi } from '@/features/formal-session/api-with-client';
import { syncFormalAttemptsWithApi } from '@/features/formal-session/sync-with-api';
import { getOfflineStore, type FormalSessionCacheRecord } from '@/features/offline-storage';

import {
  advanceRunner,
  createFormalSessionRunnerState,
  currentRunnerExercise,
  markRunnerAttemptPersisted,
  markRunnerCompleted,
  markRunnerSyncPending,
  recordRunnerAudioPlayback,
  resetRunnerSelection,
  requestRunnerHint,
  revealRunnerPinyin,
  retryRunnerAnswer,
  runnerProgress,
  runnerRemainingSeconds,
  selectRunnerPinyinBuildOption,
  sessionRecordAfterAttempt,
  startRunnerActivity,
  submitRunnerAnswer,
  toggleRunnerTile,
  type FormalSessionRunnerState,
  type SupportedFormalExercise,
} from './model';
import { completeFormalSession } from './completion';
import {
  FormalPinyinActivityRenderer,
  type FormalAudioState,
} from './FormalPinyinActivityRenderer';
import {
  clearPinyinAudioPrefetchCache,
  prefetchPinyinSessionAudio,
  resolvePinyinAudioSource,
} from './pinyin-audio';
import { isFormalPinyinExercise } from './pinyin-adapters';

type Props = {
  initialSession: FormalSessionCacheRecord;
  userId: string;
};

type FailedPersistence = Readonly<{
  attempt: AttemptDraftV2;
  runnerState: FormalSessionRunnerState;
  session: FormalSessionCacheRecord;
}>;

type SupportedHanziExercise = Extract<
  SupportedFormalExercise,
  { type: 'audio_to_glyph' | 'glyph_to_image' | 'sentence_order' | 'word_build' }
>;

function isHanziExercise(exercise: SupportedFormalExercise): exercise is SupportedHanziExercise {
  return (
    exercise.type === 'audio_to_glyph' ||
    exercise.type === 'glyph_to_image' ||
    exercise.type === 'word_build' ||
    exercise.type === 'sentence_order'
  );
}

function speechText(exercise: SupportedHanziExercise): string {
  if (exercise.type === 'audio_to_glyph') {
    return (
      exercise.options.find((option) => option.optionId === exercise.correctOptionId)?.glyph ?? ''
    );
  }
  if (exercise.type === 'glyph_to_image') return exercise.promptGlyph;
  if (exercise.type === 'word_build') return exercise.targetWord;
  return exercise.targetSentence;
}

function minutesAndSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `约 ${minutes} 分 ${remainder} 秒` : `约 ${remainder} 秒`;
}

function optionAnswer(exercise: SupportedHanziExercise, optionId: string): AttemptAnswerV2 {
  if (exercise.type !== 'audio_to_glyph' && exercise.type !== 'glyph_to_image') {
    throw new Error('The current exercise does not accept option answers.');
  }
  return { optionId };
}

export function FormalSessionRunner({ initialSession, userId }: Props) {
  const network = useNetworkState();
  const persistenceLock = useRef(false);
  const pinyinAudioPlayer = useAudioPlayer();
  const pinyinAudioPlayerStatus = useAudioPlayerStatus(pinyinAudioPlayer);
  const [session, setSession] = useState(initialSession);
  const [runner, setRunner] = useState<FormalSessionRunnerState>(() => {
    const created = createFormalSessionRunnerState(initialSession);
    return created.phase === 'ready' ? startRunnerActivity(created, performance.now()) : created;
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [fatalMessage, setFatalMessage] = useState<string | null>(null);
  const [failedPersistence, setFailedPersistence] = useState<FailedPersistence | null>(null);
  const [activeAudioAssetKey, setActiveAudioAssetKey] = useState<string | null>(null);
  const [audioPreparation, setAudioPreparation] = useState<FormalAudioState>({
    failedAssetKey: null,
    phase: 'loading',
    playingAssetKey: null,
  });
  const exercise = useMemo(() => {
    try {
      return currentRunnerExercise(session, runner);
    } catch {
      return null;
    }
  }, [runner, session]);

  async function preparePinyinAudio(clearCache = false): Promise<void> {
    if (clearCache) clearPinyinAudioPrefetchCache();
    setAudioPreparation({
      failedAssetKey: null,
      phase: 'loading',
      playingAssetKey: null,
    });
    try {
      const results = await prefetchPinyinSessionAudio(session);
      const missing = results.flatMap((result) => result.missingAssetKeys)[0] ?? null;
      setAudioPreparation({
        failedAssetKey: missing,
        phase: missing ? 'error' : 'ready',
        playingAssetKey: null,
      });
    } catch {
      setAudioPreparation({
        failedAssetKey: activeAudioAssetKey,
        phase: 'error',
        playingAssetKey: null,
      });
    }
  }

  useEffect(() => {
    let active = true;
    void prefetchPinyinSessionAudio(session)
      .then((results) => {
        if (!active) return;
        const missing = results.flatMap((result) => result.missingAssetKeys)[0] ?? null;
        setAudioPreparation({
          failedAssetKey: missing,
          phase: missing ? 'error' : 'ready',
          playingAssetKey: null,
        });
      })
      .catch(() => {
        if (!active) return;
        setAudioPreparation({
          failedAssetKey: null,
          phase: 'error',
          playingAssetKey: null,
        });
      });
    return () => {
      active = false;
    };
  }, [session]);

  async function playPinyinAudio(assetKey: string): Promise<void> {
    const source = resolvePinyinAudioSource(assetKey);
    if (source === null) {
      setAudioPreparation({
        failedAssetKey: assetKey,
        phase: 'error',
        playingAssetKey: null,
      });
      return;
    }
    try {
      pinyinAudioPlayer.pause();
      if (activeAudioAssetKey !== assetKey) {
        pinyinAudioPlayer.replace(source);
        setActiveAudioAssetKey(assetKey);
      }
      await pinyinAudioPlayer.seekTo(0);
      pinyinAudioPlayer.play();
      setAudioPreparation({
        failedAssetKey: null,
        phase: 'ready',
        playingAssetKey: assetKey,
      });
      setRunner((current) => recordRunnerAudioPlayback(current, assetKey));
    } catch {
      setAudioPreparation({
        failedAssetKey: assetKey,
        phase: 'error',
        playingAssetKey: null,
      });
    }
  }

  async function persistAnswer(answer: AttemptAnswerV2): Promise<void> {
    if (persistenceLock.current) return;
    persistenceLock.current = true;
    const nowIso = new Date().toISOString();
    const submitted = submitRunnerAnswer(session, runner, answer, {
      attemptId: () => Crypto.randomUUID(),
      nowIso: () => nowIso,
      nowMs: () => performance.now(),
      offlineSequence: Date.parse(nowIso),
    });
    if (!submitted.attempt) {
      persistenceLock.current = false;
      return;
    }
    setRunner(submitted.state);
    const updatedSession = sessionRecordAfterAttempt(session, submitted.state, nowIso);
    setFailedPersistence({
      attempt: submitted.attempt,
      runnerState: submitted.state,
      session: updatedSession,
    });
    try {
      const store = await getOfflineStore();
      await store.saveAttemptV2AndSession(userId, submitted.attempt, updatedSession);
      setSession(updatedSession);
      setRunner(markRunnerAttemptPersisted(submitted.state));
      setFailedPersistence(null);
      setFatalMessage(null);
      setNotice('本次作答已安全保存在设备上。');
      persistenceLock.current = false;
      if (network.isConnected) {
        try {
          const sync = await syncFormalAttemptsWithApi(store, userId);
          if (sync.status === 'synced' || sync.status === 'idle') {
            setNotice(
              sync.scoringMismatches > 0
                ? '服务器已完成最终核对，并更新了本次学习记录。'
                : '本次学习记录已同步。',
            );
          } else {
            setNotice('当前暂未同步，恢复网络后会自动重试。');
          }
        } catch {
          setNotice('当前暂未同步，恢复网络后会自动重试。');
        }
      }
    } catch {
      persistenceLock.current = false;
      setFatalMessage('本次作答尚未安全保存，请不要关闭页面，稍后重试。');
    }
  }

  async function retryFailedPersistence(): Promise<void> {
    if (!failedPersistence || persistenceLock.current) return;
    persistenceLock.current = true;
    setFatalMessage(null);
    try {
      const store = await getOfflineStore();
      await store.saveAttemptV2AndSession(
        userId,
        failedPersistence.attempt,
        failedPersistence.session,
      );
      setSession(failedPersistence.session);
      setRunner(markRunnerAttemptPersisted(failedPersistence.runnerState));
      setFailedPersistence(null);
      setNotice('本次作答已安全保存在设备上，恢复网络后会自动同步。');
    } catch {
      setFatalMessage('本次作答尚未安全保存，请不要关闭页面，稍后重试。');
    } finally {
      persistenceLock.current = false;
    }
  }

  async function completeSession(baseState = runner): Promise<void> {
    const pendingState = markRunnerSyncPending(baseState);
    setRunner(pendingState);
    setNotice('正在同步并完成本节学习…');
    try {
      const store = await getOfflineStore();
      const result = await completeFormalSession({
        api: formalSessionApi,
        nowIso: new Date().toISOString(),
        sessionId: session.sessionId,
        store,
        sync: syncFormalAttemptsWithApi,
        userId,
      });
      if (result.status === 'sync_pending') {
        setNotice('作答仍保存在设备上。连接网络后即可完成本节学习。');
        return;
      }
      if (result.status !== 'completed') {
        setNotice(
          result.status === 'auth_expired'
            ? '登录已过期。重新登录后，本地作答仍可继续同步。'
            : '暂时无法完成本节学习，请稍后再试。',
        );
        return;
      }
      setSession(result.session);
      setRunner(markRunnerCompleted(pendingState));
      setNotice(null);
    } catch {
      setNotice('作答仍保存在设备上。连接网络后即可完成本节学习。');
    }
  }

  if (runner.phase === 'fatal_content_error' || !exercise) {
    return (
      <Screen style={styles.screen}>
        <ErrorState
          message="这节学习包含当前版本尚不支持的内容。你的进度没有被修改。"
          title="暂时无法打开本节学习"
        />
      </Screen>
    );
  }

  if (runner.phase === 'completed') {
    return (
      <Screen style={styles.screen}>
        <View accessibilityLiveRegion="polite" style={styles.completion}>
          <Text accessibilityRole="header" style={styles.completionTitle}>
            本节学习完成
          </Text>
          <Text style={styles.body}>
            你完成了 {session.activities.length} 道练习。学习记录已由服务器核对。
          </Text>
        </View>
      </Screen>
    );
  }

  const support = session.activities[runner.activityIndex]?.pinyinSupport;
  const showSupportNotice =
    support?.presentation === 'visible' || runner.activityState.pinyinRevealed;
  const correctFeedback = runner.phase === 'feedback' && runner.activityState.localCorrect === true;
  const incorrectFeedback =
    runner.phase === 'feedback' && runner.activityState.localCorrect === false;
  const busy =
    runner.phase === 'persisting_attempt' ||
    runner.phase === 'sync_pending' ||
    runner.phase === 'completing_session';
  const formalAudioState: FormalAudioState = pinyinAudioPlayerStatus.error
    ? {
        failedAssetKey: activeAudioAssetKey,
        phase: 'error',
        playingAssetKey: null,
      }
    : pinyinAudioPlayerStatus.playing && activeAudioAssetKey
      ? {
          failedAssetKey: null,
          phase: 'playing',
          playingAssetKey: activeAudioAssetKey,
        }
      : audioPreparation;

  return (
    <Screen scrollable style={styles.screen} testID="formal-session-runner">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.eyebrow}>
          正式学习 · 第 {runner.activityIndex + 1} 题，共 {session.activities.length} 题
        </Text>
        <ProgressBar label="本节进度" value={runnerProgress(session, runner)} />
        <Text style={styles.remaining}>
          预计剩余 {minutesAndSeconds(runnerRemainingSeconds(session, runner))}
        </Text>
      </View>

      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {fatalMessage ? (
        <ErrorState
          actionLabel="再次保存"
          message={fatalMessage}
          onRetry={() => void retryFailedPersistence()}
          title="学习记录尚未保存"
        />
      ) : null}

      <View style={styles.exerciseCard}>
        <Text style={styles.instruction}>{exercise.instructionZh}</Text>
        {isFormalPinyinExercise(exercise) ? (
          <FormalPinyinActivityRenderer
            audioState={formalAudioState}
            busy={busy || runner.phase !== 'answering'}
            exercise={exercise}
            onPlayAudio={(assetKey) => void playPinyinAudio(assetKey)}
            onRequestHint={() => setRunner((current) => requestRunnerHint(current))}
            onResetBuild={() => setRunner((current) => resetRunnerSelection(current))}
            onRetryAnswer={() =>
              setRunner((current) => retryRunnerAnswer(current, performance.now()))
            }
            onRetryAudio={() => void preparePinyinAudio(true)}
            onSelectBuildOption={(step, optionId) =>
              setRunner((current) =>
                selectRunnerPinyinBuildOption(session, current, step, optionId),
              )
            }
            onSubmitAnswer={(answer) => void persistAnswer(answer)}
            runner={runner}
          />
        ) : isHanziExercise(exercise) ? (
          <>
            {exercise.type === 'audio_to_glyph' ? (
              <AudioButton
                disabled={busy}
                label={
                  (runner.activityState.audioPlayCounts[exercise.promptAudioAssetKey] ?? 0) === 0
                    ? '播放声音'
                    : '再听一次'
                }
                onPress={() => {
                  Speech.speak(speechText(exercise), { language: 'zh-CN', rate: 0.8 });
                  setRunner((current) =>
                    recordRunnerAudioPlayback(current, exercise.promptAudioAssetKey),
                  );
                }}
              />
            ) : null}
            {exercise.type === 'glyph_to_image' ? (
              <Text accessibilityLabel={exercise.promptAccessibilityLabel} style={styles.hanzi}>
                {exercise.promptGlyph}
              </Text>
            ) : null}
            {exercise.type === 'word_build' || exercise.type === 'sentence_order' ? (
              <Text style={styles.prompt}>{exercise.promptZh}</Text>
            ) : null}

            {exercise.type === 'audio_to_glyph' || exercise.type === 'glyph_to_image' ? (
              <View accessibilityRole="radiogroup" style={styles.optionGrid}>
                {exercise.options.map((option) => {
                  const selected = runner.activityState.selectedOptionId === option.optionId;
                  return (
                    <Pressable
                      accessibilityLabel={option.accessibilityLabel}
                      aria-checked={selected}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: busy }}
                      disabled={busy || runner.phase !== 'answering'}
                      key={option.optionId}
                      onPress={() => void persistAnswer(optionAnswer(exercise, option.optionId))}
                      style={({ pressed }) => [
                        styles.option,
                        selected && styles.optionSelected,
                        pressed && styles.optionPressed,
                      ]}
                    >
                      <Text
                        style={
                          exercise.type === 'audio_to_glyph' ? styles.optionGlyph : styles.body
                        }
                      >
                        {'glyph' in option ? option.glyph : option.accessibilityLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <>
                <View accessibilityLabel="当前答案" style={styles.answerArea}>
                  {runner.activityState.selectedTileIds.length === 0 ? (
                    <Text style={styles.muted}>按顺序选择下面的字词</Text>
                  ) : (
                    runner.activityState.selectedTileIds.map((tileId) => {
                      const tile = exercise.tiles.find((candidate) => candidate.tileId === tileId);
                      return (
                        <Text key={tileId} style={styles.answerTile}>
                          {tile && 'glyph' in tile ? tile.glyph : tile?.text}
                        </Text>
                      );
                    })
                  )}
                </View>
                <View style={styles.tileGrid}>
                  {exercise.tiles.map((tile) => (
                    <Pressable
                      accessibilityLabel={tile.accessibilityLabel}
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: busy || runner.phase !== 'answering',
                        selected: runner.activityState.selectedTileIds.includes(tile.tileId),
                      }}
                      disabled={busy || runner.phase !== 'answering'}
                      key={tile.tileId}
                      onPress={() =>
                        setRunner((current) => toggleRunnerTile(session, current, tile.tileId))
                      }
                      style={({ pressed }) => [styles.tile, pressed && styles.optionPressed]}
                    >
                      <Text style={styles.tileText}>
                        {'glyph' in tile ? tile.glyph : tile.text}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <PrimaryButton
                  disabled={
                    busy ||
                    runner.phase !== 'answering' ||
                    runner.activityState.selectedTileIds.length !== exercise.tiles.length
                  }
                  label="提交答案"
                  onPress={() =>
                    void persistAnswer({ tileIds: [...runner.activityState.selectedTileIds] })
                  }
                />
              </>
            )}

            {support?.presentation === 'tap_to_reveal' && !runner.activityState.pinyinRevealed ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setRunner((current) => revealRunnerPinyin(session, current))}
                style={styles.hintButton}
              >
                <Text style={styles.hintButtonText}>显示拼音辅助</Text>
              </Pressable>
            ) : null}
            {showSupportNotice ? (
              <Text accessibilityLiveRegion="polite" style={styles.supportNotice}>
                拼音辅助已开启；本题会按辅助状态计算学习证据。
              </Text>
            ) : null}
            {exercise.visualHintZh && runner.activityState.hintLevel === 'none' ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setRunner((current) => requestRunnerHint(current))}
                style={styles.hintButton}
              >
                <Text style={styles.hintButtonText}>给我一个提示</Text>
              </Pressable>
            ) : null}
            {exercise.visualHintZh && runner.activityState.hintLevel === 'visual_hint' ? (
              <Text accessibilityLiveRegion="polite" style={styles.supportNotice}>
                {exercise.visualHintZh}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>

      {incorrectFeedback && isHanziExercise(exercise) ? (
        <View accessibilityLiveRegion="assertive" style={styles.feedback}>
          <Text style={styles.feedbackTitle}>再试一次，你正在找到规律</Text>
          <Text style={styles.body}>看看提示，慢慢来。</Text>
          <PrimaryButton
            label="重新作答"
            onPress={() => setRunner((current) => retryRunnerAnswer(current, performance.now()))}
          />
        </View>
      ) : null}
      {correctFeedback ? (
        <View accessibilityLiveRegion="polite" style={[styles.feedback, styles.correctFeedback]}>
          <Text style={styles.feedbackTitle}>回答正确</Text>
          <PrimaryButton
            label={
              runner.completedActivityIds.length + 1 === session.activities.length
                ? '完成本节学习'
                : '下一题'
            }
            onPress={() => {
              const advanced = advanceRunner(session, runner, performance.now());
              setRunner(advanced);
              if (advanced.phase === 'completing_session') void completeSession(advanced);
            }}
          />
        </View>
      ) : null}
      {runner.phase === 'sync_pending' ? (
        <PrimaryButton label="重新同步并完成" onPress={() => void completeSession()} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  answerArea: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 76,
    padding: spacing.md,
  },
  answerTile: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.semibold,
  },
  body: { color: colors.textPrimary, fontSize: fontSizes.body, lineHeight: lineHeights.body },
  completion: {
    backgroundColor: colors.successSurface,
    borderRadius: radii.lg,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  completionTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
  },
  correctFeedback: { backgroundColor: colors.successSurface, borderColor: colors.success },
  eyebrow: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  feedback: {
    backgroundColor: colors.warningSurface,
    borderColor: colors.warning,
    borderRadius: radii.lg,
    borderWidth: borders.thin,
    gap: spacing.md,
    padding: spacing.lg,
  },
  feedbackTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.bold,
  },
  hanzi: {
    color: colors.textPrimary,
    fontSize: 64,
    lineHeight: 80,
    textAlign: 'center',
  },
  header: { gap: spacing.md },
  hintButton: { alignSelf: 'flex-start', minHeight: 48, padding: spacing.md },
  hintButtonText: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    textDecorationLine: 'underline',
  },
  instruction: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
  },
  muted: { color: colors.textSecondary, fontSize: fontSizes.body },
  notice: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    textAlign: 'center',
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 2,
    flexBasis: '45%',
    justifyContent: 'center',
    minHeight: 96,
    padding: spacing.md,
  },
  optionGlyph: { color: colors.textPrimary, fontSize: 48, lineHeight: 64 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  optionPressed: { backgroundColor: colors.surfaceMuted },
  optionSelected: { borderColor: colors.primary },
  prompt: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    lineHeight: lineHeights.bodyLarge,
  },
  remaining: { color: colors.textSecondary, fontSize: fontSizes.caption },
  screen: { gap: spacing.xl, paddingBottom: spacing.xxl },
  supportNotice: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    padding: spacing.md,
  },
  tile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: borders.thin,
    minHeight: 56,
    minWidth: 64,
    padding: spacing.md,
  },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tileText: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.semibold,
  },
});
