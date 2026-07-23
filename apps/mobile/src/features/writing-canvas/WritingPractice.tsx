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
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorState, HanziText, LoadingState, useReducedMotion } from '@/components/ui';

import {
  advanceWritingLessonStroke,
  createWritingLessonState,
  restartWritingLessonStroke,
  selectWritingLessonCharacter,
  selectWritingLessonPhase,
} from './lesson-model';
import { undoLastStroke, type Stroke } from './model';
import { getWritingDraftStore } from './store';
import { StrokeOrderGuide } from './StrokeOrderGuide';
import { createWritingDraftRecord } from './storage-model';
import { WritingCanvas } from './WritingCanvas';

type Props = Readonly<{
  chineseName: string;
  ownerUserId: string;
}>;

type LoadState = 'error' | 'loading' | 'ready';
type SaveState = 'idle' | 'saved' | 'saving' | 'error';

export function WritingPractice({ chineseName, ownerUserId }: Props) {
  const reduceMotion = useReducedMotion();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [strokes, setStrokes] = useState<readonly Stroke[]>([]);
  const [replayProgress, setReplayProgress] = useState<number | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [lesson, setLesson] = useState(() => createWritingLessonState(chineseName));
  const operationChain = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void getWritingDraftStore()
      .then((store) => store.load(ownerUserId))
      .then((draft) => {
        if (!active) return;
        setStrokes(draft?.chineseName === chineseName ? draft.strokes : []);
        setLoadState('ready');
      })
      .catch(() => {
        if (active) setLoadState('error');
      });
    return () => {
      active = false;
    };
  }, [chineseName, loadAttempt, ownerUserId]);

  useEffect(() => {
    if (replayProgress === null || replayProgress >= 1 || reduceMotion) return;
    const timer = setInterval(() => {
      setReplayProgress((current) =>
        current === null ? null : Math.min(1, Number((current + 0.05).toFixed(2))),
      );
    }, 40);
    return () => clearInterval(timer);
  }, [reduceMotion, replayProgress]);

  const queueOperation = useCallback((operation: () => Promise<void>) => {
    setSaveState('saving');
    operationChain.current = operationChain.current
      .catch(() => undefined)
      .then(operation)
      .then(() => setSaveState('saved'))
      .catch(() => setSaveState('error'));
  }, []);

  const saveStrokes = useCallback(
    (nextStrokes: readonly Stroke[]) => {
      setReplayProgress(null);
      setStrokes(nextStrokes);
      queueOperation(async () => {
        const store = await getWritingDraftStore();
        if (nextStrokes.length === 0) {
          await store.clear(ownerUserId);
          return;
        }
        await store.save(
          createWritingDraftRecord({
            chineseName,
            ownerUserId,
            strokes: nextStrokes,
            updatedAt: new Date().toISOString(),
          }),
        );
      });
    },
    [chineseName, ownerUserId, queueOperation],
  );

  if (loadState === 'loading') {
    return <LoadingState message="正在打开本机书写草稿…" />;
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

  const isReplaying = replayProgress !== null && replayProgress < 1;
  const activeAsset = lesson.assets[lesson.activeCharacterIndex] ?? null;
  const saveMessage =
    saveState === 'saving'
      ? '正在保存到本机…'
      : saveState === 'saved'
        ? '已保存在本机'
        : saveState === 'error'
          ? '暂时无法保存，请重试一次操作。'
          : '轨迹只保存在这台设备上，不会上传。';

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
  status: {
    color: colors.textSecondary,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
    textAlign: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
    textAlign: 'center',
  },
});
