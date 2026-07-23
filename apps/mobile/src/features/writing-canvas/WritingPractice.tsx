import {
  borders,
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
  touchTargets,
} from '@hanziquest/design-tokens';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorState, HanziText, LoadingState, useReducedMotion } from '@/components/ui';

import {
  compareOwnSignaturePractices,
  SIGNATURE_CONSISTENCY_ALGORITHM_VERSION,
} from './consistency';
import {
  advanceWritingLessonStroke,
  createWritingLessonState,
  restartWritingLessonStroke,
  selectWritingLessonCharacter,
  selectWritingLessonPhase,
} from './lesson-model';
import { undoLastStroke, type Stroke } from './model';
import { syncSignaturePracticeMetadataWithApi } from './signature-sync-with-api';
import { SignatureStylePicker } from './SignatureStylePicker';
import type { SignatureStyle } from './signature-transform';
import {
  createWritingDraftRecord,
  MAX_PENDING_SIGNATURE_EVENTS,
  WritingDraftRecordSchema,
  type WritingDraftRecord,
} from './storage-model';
import { getWritingDraftStore } from './store';
import { StrokeOrderGuide } from './StrokeOrderGuide';
import { WritingCanvas } from './WritingCanvas';

type Props = Readonly<{
  chineseName: string;
  ownerUserId: string;
}>;

type LoadState = 'error' | 'loading' | 'ready';
type SaveState = 'idle' | 'saved' | 'saving' | 'error';
type SyncState = 'idle' | 'syncing' | 'synced' | 'unavailable';

function mergeSyncResult(
  latest: WritingDraftRecord,
  submitted: WritingDraftRecord,
  synced: WritingDraftRecord,
): WritingDraftRecord {
  const remainingSubmittedIds = new Set(synced.pendingEvents.map((event) => event.eventId));
  const completedIds = new Set(
    submitted.pendingEvents
      .filter((event) => !remainingSubmittedIds.has(event.eventId))
      .map((event) => event.eventId),
  );
  return WritingDraftRecordSchema.parse({
    ...latest,
    pendingEvents: latest.pendingEvents.filter((event) => !completedIds.has(event.eventId)),
    serverSummary: synced.serverSummary,
    updatedAt: new Date().toISOString(),
  });
}

function feedbackMessage(record: WritingDraftRecord): string | null {
  if (record.practiceSequence === 1 && !record.latestFeedback) {
    return '第一份练习已作为本机参考。再完成一次，就能看到两次练习的一致性提示。';
  }
  if (!record.latestFeedback) return null;
  const entries = Object.entries(record.latestFeedback) as [
    keyof typeof record.latestFeedback,
    number,
  ][];
  const [area, value] = entries.sort((left, right) => left[1] - right[1])[0]!;
  if (value >= 0.85) return '这两次练习的整体表现很稳定，可以继续保持现在的书写方式。';
  const suggestions: Record<typeof area, string> = {
    direction: '下次可以留意每一笔的行进方向，让两次练习更接近。',
    proportion: '下次可以留意名字整体的宽高比例和字间距离。',
    rhythm: '下次可以尝试保持相近的落笔速度和书写节奏。',
    structure: '下次可以留意笔画数量和整体结构，保持自己的书写习惯。',
  };
  return suggestions[area];
}

export function WritingPractice({ chineseName, ownerUserId }: Props) {
  const reduceMotion = useReducedMotion();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [draft, setDraft] = useState<WritingDraftRecord | null>(null);
  const [replayProgress, setReplayProgress] = useState<number | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [lesson, setLesson] = useState(() => createWritingLessonState(chineseName));
  const draftRef = useRef<WritingDraftRecord | null>(null);
  const operationChain = useRef(Promise.resolve());

  const queueOperation = useCallback((operation: () => Promise<void>) => {
    setSaveState('saving');
    operationChain.current = operationChain.current
      .catch(() => undefined)
      .then(operation)
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('error'));
  }, []);

  const persistDraft = useCallback(
    (next: WritingDraftRecord, syncMetadata: boolean) => {
      draftRef.current = next;
      setDraft(next);
      queueOperation(async () => {
        const store = await getWritingDraftStore();
        await store.save(next);
        if (!syncMetadata) return;
        setSyncState('syncing');
        const result = await syncSignaturePracticeMetadataWithApi(next);
        const latest = draftRef.current;
        if (!latest) return;
        const merged = mergeSyncResult(latest, next, result.record);
        draftRef.current = merged;
        setDraft(merged);
        await store.save(merged);
        setSyncState(result.status === 'synced' ? 'synced' : 'unavailable');
      });
    },
    [queueOperation],
  );

  useEffect(() => {
    let active = true;
    void getWritingDraftStore()
      .then((store) => store.load(ownerUserId))
      .then((stored) => {
        if (!active) return;
        const loaded =
          stored?.chineseName === chineseName
            ? stored
            : createWritingDraftRecord({
                chineseName,
                ownerUserId,
                strokes: [],
                updatedAt: new Date().toISOString(),
              });
        draftRef.current = loaded;
        setDraft(loaded);
        setLoadState('ready');
        if (loaded.pendingEvents.length > 0) persistDraft(loaded, true);
      })
      .catch(() => {
        if (active) setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [chineseName, loadAttempt, ownerUserId, persistDraft]);

  useEffect(() => {
    if (replayProgress === null || replayProgress >= 1 || reduceMotion) return;
    const timer = setInterval(() => {
      setReplayProgress((current) =>
        current === null ? null : Math.min(1, Number((current + 0.05).toFixed(2))),
      );
    }, 40);
    return () => clearInterval(timer);
  }, [reduceMotion, replayProgress]);

  const updateDraft = useCallback(
    (
      update: Partial<
        Pick<
          WritingDraftRecord,
          | 'baselineStrokes'
          | 'latestFeedback'
          | 'pendingEvents'
          | 'practiceSequence'
          | 'selectedStyle'
          | 'strokes'
        >
      >,
      syncMetadata = false,
    ) => {
      const current = draftRef.current;
      if (!current) return;
      persistDraft(
        WritingDraftRecordSchema.parse({
          ...current,
          ...update,
          updatedAt: new Date().toISOString(),
        }),
        syncMetadata,
      );
    },
    [persistDraft],
  );

  function saveStrokes(nextStrokes: readonly Stroke[]) {
    setReplayProgress(null);
    updateDraft({
      strokes: nextStrokes.map((stroke) => ({ points: [...stroke.points] })),
    });
  }

  function selectStyle(style: SignatureStyle) {
    updateDraft({ selectedStyle: style }, true);
  }

  function completePractice() {
    const current = draftRef.current;
    if (!current || current.strokes.length === 0) return;
    if (current.pendingEvents.length >= MAX_PENDING_SIGNATURE_EVENTS) {
      setSyncState('unavailable');
      return;
    }
    const eventId = Crypto.randomUUID();
    const metrics = current.baselineStrokes
      ? compareOwnSignaturePractices(current.baselineStrokes, current.strokes)
      : null;
    updateDraft(
      {
        baselineStrokes: current.strokes,
        latestFeedback: metrics,
        pendingEvents: [
          ...current.pendingEvents,
          {
            schemaVersion: 'signature-practice-request-v1',
            algorithmVersion: SIGNATURE_CONSISTENCY_ALGORITHM_VERSION,
            eventId,
            idempotencyKey: `signature-practice:${eventId}`,
            metrics,
            occurredAt: new Date().toISOString(),
            projectId: current.projectId,
          },
        ],
        practiceSequence: current.practiceSequence + 1,
        strokes: [],
      },
      true,
    );
  }

  if (loadState === 'error') {
    return (
      <ErrorState
        actionLabel="重新读取"
        message="草稿仍保存在本机；可以重新尝试读取。"
        onRetry={() => {
          setLoadState('loading');
          setLoadAttempt((attempt) => attempt + 1);
        }}
      />
    );
  }
  if (loadState === 'loading' || !draft) {
    return <LoadingState message="正在打开本机书写草稿…" />;
  }

  const strokes = draft.strokes;
  const isReplaying = replayProgress !== null && replayProgress < 1;
  const activeAsset = lesson.assets[lesson.activeCharacterIndex] ?? null;
  const feedback = feedbackMessage(draft);
  const saveMessage =
    saveState === 'saving'
      ? '正在保存到本机…'
      : saveState === 'saved'
        ? '已保存在本机'
        : saveState === 'error'
          ? '暂时无法保存，请重试一次操作。'
          : '轨迹只保存在这台设备上，不会上传。';
  const syncMessage =
    syncState === 'syncing'
      ? '正在同步练习次数和汇总…'
      : syncState === 'synced'
        ? '练习次数和汇总已同步'
        : syncState === 'unavailable'
          ? `当前离线；${draft.pendingEvents.length} 条元数据会留在本机等待重试`
          : draft.serverSummary
            ? `服务端已记录 ${draft.serverSummary.practiceCount} 次练习`
            : null;

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          练习写自己的中文名字
        </Text>
        <HanziText accessibilityLabel={`练习名字：${chineseName}`} size="display">
          {chineseName}
        </HanziText>
        <Text style={styles.instructions}>
          先观察起笔位置和方向，再描写标准字形，最后过渡到自由书写。
        </Text>
      </View>
      {lesson.assets.length > 0 ? (
        <>
          <View style={styles.controls}>
            {lesson.assets.map((asset, index) => (
              <ControlButton
                disabled={lesson.activeCharacterIndex === index}
                key={`${asset.character}-${index}`}
                label={asset.character}
                onPress={() => setLesson((current) => selectWritingLessonCharacter(current, index))}
              />
            ))}
          </View>
          <View style={styles.controls}>
            {(['observe', 'trace', 'free'] as const).map((phase) => (
              <ControlButton
                disabled={lesson.phase === phase}
                key={phase}
                label={phase === 'observe' ? '观察笔顺' : phase === 'trace' ? '描写' : '自由书写'}
                onPress={() => setLesson((current) => selectWritingLessonPhase(current, phase))}
              />
            ))}
          </View>
        </>
      ) : null}
      {lesson.unsupportedCharacters.length > 0 ? (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {lesson.unsupportedCharacters.join('、')} 暂无离线笔顺教材，可继续自由书写。
        </Text>
      ) : null}
      {lesson.phase === 'observe' && activeAsset ? (
        <StrokeOrderGuide
          activeStrokeIndex={lesson.activeStrokeIndex}
          asset={activeAsset}
          onAdvance={() => setLesson(advanceWritingLessonStroke)}
          onRestart={() => setLesson(restartWritingLessonStroke)}
        />
      ) : null}
      <WritingCanvas
        disabled={isReplaying || lesson.phase === 'observe'}
        guidePaths={lesson.phase === 'trace' && activeAsset ? activeAsset.strokes : []}
        onChange={saveStrokes}
        replayProgress={replayProgress}
        strokes={strokes}
      />
      <Text accessibilityLiveRegion="polite" style={styles.status}>
        已完成 {strokes.length} 笔 · {saveMessage}
      </Text>
      <View style={styles.controls}>
        <ControlButton
          disabled={strokes.length === 0 || isReplaying}
          label="撤销一笔"
          onPress={() => saveStrokes(undoLastStroke(strokes))}
        />
        <ControlButton
          disabled={strokes.length === 0 || isReplaying}
          label="清空"
          onPress={() => saveStrokes([])}
        />
        <ControlButton
          disabled={strokes.length === 0 || isReplaying}
          label="重放"
          onPress={() => setReplayProgress(reduceMotion ? 1 : 0)}
        />
      </View>
      {replayProgress !== null ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setReplayProgress(null)}
          style={styles.finishReplay}
        >
          <Text style={styles.finishReplayLabel}>{isReplaying ? '停止重放' : '返回书写'}</Text>
        </Pressable>
      ) : null}
      {lesson.phase === 'free' && strokes.length > 0 ? (
        <>
          <SignatureStylePicker
            chineseName={chineseName}
            onSelect={selectStyle}
            selectedStyle={draft.selectedStyle}
            strokes={strokes}
          />
          <Pressable
            accessibilityHint="原始笔迹仍只保存在本机；同步内容只有练习次数和一致性汇总。"
            accessibilityRole="button"
            onPress={completePractice}
            style={({ pressed }) => [
              styles.completeButton,
              pressed && styles.completeButtonPressed,
            ]}
          >
            <Text style={styles.completeButtonLabel}>完成本次练习</Text>
          </Pressable>
        </>
      ) : null}
      {feedback ? (
        <View accessibilityLiveRegion="polite" style={styles.feedback}>
          <Text style={styles.feedbackTitle}>自己的练习对比</Text>
          <Text style={styles.feedbackText}>{feedback}</Text>
          {draft.latestFeedback ? (
            <View style={styles.metrics}>
              <Metric label="结构" value={draft.latestFeedback.structure} />
              <Metric label="比例" value={draft.latestFeedback.proportion} />
              <Metric label="方向" value={draft.latestFeedback.direction} />
              <Metric label="节奏" value={draft.latestFeedback.rhythm} />
            </View>
          ) : null}
        </View>
      ) : null}
      {syncMessage ? (
        <View style={styles.syncRow}>
          <Text accessibilityLiveRegion="polite" style={styles.status}>
            {syncMessage}
          </Text>
          {syncState === 'unavailable' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => persistDraft(draftRef.current ?? draft, true)}
              style={styles.retrySync}
            >
              <Text style={styles.retrySyncLabel}>重新同步</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.privacyNotice}>
        服务器只接收项目风格、练习次数和派生汇总，不接收笔迹点或图片。这些提示不用于身份认证或真伪判断。
      </Text>
    </View>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{Math.round(value * 100)}%</Text>
    </View>
  );
}

function ControlButton({
  disabled,
  label,
  onPress,
}: Readonly<{ disabled: boolean; label: string; onPress(): void }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        pressed && !disabled && styles.controlPressed,
        disabled && styles.controlDisabled,
      ]}
    >
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  completeButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
  },
  completeButtonLabel: {
    color: colors.textOnPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.body,
  },
  completeButtonPressed: { opacity: 0.82 },
  container: {
    flex: 1,
    gap: spacing.lg,
  },
  control: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: radii.md,
    borderWidth: borders.thin,
    flex: 1,
    justifyContent: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.sm,
  },
  controlDisabled: {
    opacity: 0.5,
  },
  controlLabel: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.body,
  },
  controlPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  feedback: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    gap: spacing.sm,
    padding: spacing.md,
  },
  feedbackText: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
  },
  feedbackTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.bodyLarge,
  },
  finishReplay: {
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    padding: spacing.sm,
  },
  finishReplayLabel: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.body,
  },
  heading: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  instructions: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    lineHeight: lineHeights.body,
    textAlign: 'center',
  },
  metric: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
  },
  metrics: { flexDirection: 'row', gap: spacing.xs },
  metricValue: {
    color: colors.textPrimary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.body,
  },
  privacyNotice: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
    textAlign: 'center',
  },
  retrySync: {
    alignItems: 'center',
    minHeight: touchTargets.minimum,
    paddingHorizontal: spacing.md,
  },
  retrySyncLabel: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.body,
  },
  status: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
    textAlign: 'center',
  },
  syncRow: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
    textAlign: 'center',
  },
});
