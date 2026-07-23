import {
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  radii,
  spacing,
} from '@hanziquest/design-tokens';
import type { AttemptDraft } from '@hanziquest/contracts';
import * as Crypto from 'expo-crypto';
import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AudioButton, PrimaryButton, ProgressBar, Screen } from '@/components/ui';
import {
  AudioToGlyphExercise,
  createAudioToGlyphState,
  recordAudioReplay,
  requestVisualHint,
  retryAudioToGlyph,
  selectAudioToGlyphOption,
} from '@/features/audio-to-glyph';
import {
  answerStoryQuestion,
  completeExerciseStage,
  continueDemoCourse,
  createDemoCourseState,
  demoCourseProgress,
  homeAudioToGlyphExercise,
  homeDemoStory,
  homeDemoVisualByAssetId,
  homeGlyphToImageExercise,
  homeSentenceOrderExercise,
  homeWordBuildExercise,
  retryStoryQuestion,
} from '@/features/demo-course';
import {
  createGlyphToImageState,
  GlyphToImageExercise,
  recordGlyphAudioReplay,
  requestGlyphToImageHint,
  retryGlyphToImage,
  selectGlyphToImageOption,
} from '@/features/glyph-to-image';
import {
  cacheDemoCourseContent,
  loadRecoveredCourse,
  saveAttemptAndRecoveredCourse,
  saveRecoveredCourse,
} from '@/features/offline-course/recovery';
import {
  createSentenceOrderState,
  recordSentenceReplay,
  requestSentenceOrderHint,
  retrySentenceOrder,
  SentenceOrderExercise,
  submitSentenceOrder,
  toggleSentenceTile,
} from '@/features/sentence-order';
import {
  createWordBuildState,
  recordWordBuildReplay,
  requestWordBuildHint,
  retryWordBuild,
  submitWordBuild,
  toggleWordBuildTile,
  WordBuildExercise,
} from '@/features/word-build';

const speechOptions = { language: 'zh-CN', pitch: 1, rate: 0.8 } as const;

function speak(text: string): void {
  Speech.stop();
  Speech.speak(text, speechOptions);
}

function attemptContext(sequence: number) {
  return {
    attemptId: () => Crypto.randomUUID(),
    nowIso: () => new Date().toISOString(),
    nowMs: () => performance.now(),
    offlineSequence: sequence,
  };
}

export default function DemoCourseScreen() {
  const [course, setCourse] = useState(createDemoCourseState);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [offlineSaveStatus, setOfflineSaveStatus] = useState<
    'error' | 'ready' | 'saving' | 'saved'
  >('ready');
  const [audioState, setAudioState] = useState(() => createAudioToGlyphState(performance.now()));
  const [imageState, setImageState] = useState(() => createGlyphToImageState(performance.now()));
  const [wordState, setWordState] = useState(() => createWordBuildState(performance.now()));
  const [sentenceState, setSentenceState] = useState(() =>
    createSentenceOrderState(performance.now()),
  );

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadRecoveredCourse(),
      cacheDemoCourseContent({
        contentVersion: 'home-demo-1.0.0',
        courseTitle: '我的家',
        storyTitle: homeDemoStory.title,
      }),
    ])
      .then(([recovered]) => {
        if (!active) return;
        setCourse(recovered);
        setRecoveryReady(true);
      })
      .catch(() => {
        if (!active) return;
        setOfflineSaveStatus('error');
        setRecoveryReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (recoveryReady) {
      void saveRecoveredCourse(course).catch(() => setOfflineSaveStatus('error'));
    }
  }, [course, recoveryReady]);

  async function persistCompletedAttempt(attempt: AttemptDraft): Promise<void> {
    const nextCourse = completeExerciseStage(course);
    setOfflineSaveStatus('saving');
    try {
      await saveAttemptAndRecoveredCourse(attempt, nextCourse);
      setCourse(nextCourse);
      setOfflineSaveStatus('saved');
    } catch {
      setOfflineSaveStatus('error');
    }
  }

  const stageComplete = course.completedStageCount > course.currentStage;
  const continueButton = stageComplete ? (
    <PrimaryButton
      label={course.currentStage === 4 ? '完成演示课程' : '继续'}
      onPress={() => setCourse((current) => continueDemoCourse(current))}
    />
  ) : null;

  return (
    <Screen scrollable style={styles.screen} testID="my-home-demo-course">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.eyebrow}>
          8 分钟离线演示课
        </Text>
        <Text style={styles.title}>我的家</Text>
        <ProgressBar label="课程进度" value={demoCourseProgress(course)} />
      </View>

      {offlineSaveStatus === 'saving' ? (
        <Text accessibilityLiveRegion="polite" style={styles.offlineNotice}>
          正在安全保存本次作答…
        </Text>
      ) : null}
      {offlineSaveStatus === 'saved' ? (
        <Text accessibilityLiveRegion="polite" style={styles.offlineNotice}>
          本次作答已保存在设备上，离线也不会丢失。
        </Text>
      ) : null}
      {offlineSaveStatus === 'error' ? (
        <View accessibilityLiveRegion="assertive" style={styles.offlineError}>
          <Text style={styles.feedbackTitle}>暂时无法保存学习进度</Text>
          <Text style={styles.body}>请保留此页面并再试一次；尚未保存的关卡不会被标记为完成。</Text>
        </View>
      ) : null}

      {course.currentStage === 0 ? (
        <AudioToGlyphExercise
          exercise={homeAudioToGlyphExercise}
          onHint={() => setAudioState((current) => requestVisualHint(current))}
          onPlayAudio={() => {
            speak('家');
            setAudioState((current) => recordAudioReplay(current));
          }}
          onRetry={() => setAudioState((current) => retryAudioToGlyph(current, performance.now()))}
          onSelectOption={(optionId) => {
            const result = selectAudioToGlyphOption(
              homeAudioToGlyphExercise,
              audioState,
              optionId,
              attemptContext(0),
            );
            setAudioState(result.state);
            if (result.attempt) void persistCompletedAttempt(result.attempt);
          }}
          state={audioState}
        />
      ) : null}

      {course.currentStage === 1 ? (
        <GlyphToImageExercise
          exercise={homeGlyphToImageExercise}
          onHint={() => setImageState((current) => requestGlyphToImageHint(current))}
          onPlayAudio={() => {
            speak('家');
            setImageState((current) => recordGlyphAudioReplay(current));
          }}
          onRetry={() => setImageState((current) => retryGlyphToImage(current, performance.now()))}
          onSelectOption={(optionId) => {
            const result = selectGlyphToImageOption(
              homeGlyphToImageExercise,
              imageState,
              optionId,
              attemptContext(1),
            );
            setImageState(result.state);
            if (result.attempt) void persistCompletedAttempt(result.attempt);
          }}
          renderOptionVisual={(option) => (
            <Text style={styles.illustration}>{homeDemoVisualByAssetId[option.imageAssetId]}</Text>
          )}
          state={imageState}
        />
      ) : null}

      {course.currentStage === 2 ? (
        <WordBuildExercise
          exercise={homeWordBuildExercise}
          onHint={() => setWordState((current) => requestWordBuildHint(current))}
          onPlayAudio={() => {
            speak('我家');
            setWordState((current) => recordWordBuildReplay(current));
          }}
          onRetry={() => setWordState((current) => retryWordBuild(current, performance.now()))}
          onSubmit={() => {
            const result = submitWordBuild(homeWordBuildExercise, wordState, attemptContext(2));
            setWordState(result.state);
            if (result.attempt) void persistCompletedAttempt(result.attempt);
          }}
          onToggleTile={(tileId) =>
            setWordState((current) => toggleWordBuildTile(homeWordBuildExercise, current, tileId))
          }
          state={wordState}
        />
      ) : null}

      {course.currentStage === 3 ? (
        <SentenceOrderExercise
          exercise={homeSentenceOrderExercise}
          onHint={() => setSentenceState((current) => requestSentenceOrderHint(current))}
          onPlayAudio={() => {
            speak('我看家门。');
            setSentenceState((current) => recordSentenceReplay(current));
          }}
          onRetry={() =>
            setSentenceState((current) => retrySentenceOrder(current, performance.now()))
          }
          onSubmit={() => {
            const result = submitSentenceOrder(
              homeSentenceOrderExercise,
              sentenceState,
              attemptContext(3),
            );
            setSentenceState(result.state);
            if (result.attempt) void persistCompletedAttempt(result.attempt);
          }}
          onToggleTile={(tileId) =>
            setSentenceState((current) =>
              toggleSentenceTile(homeSentenceOrderExercise, current, tileId),
            )
          }
          state={sentenceState}
        />
      ) : null}

      {course.currentStage === 4 ? (
        <View style={styles.story}>
          <Text accessibilityRole="header" style={styles.storyTitle}>
            小故事：{homeDemoStory.title}
          </Text>
          <AudioButton label="听完整故事" onPress={() => speak(homeDemoStory.speechText)} />
          <View accessibilityLabel="故事正文" style={styles.storyCard}>
            {homeDemoStory.sentences.map((sentence) => (
              <Text key={sentence} style={styles.storySentence}>
                {sentence}
              </Text>
            ))}
          </View>
          <Text style={styles.question}>{homeDemoStory.question.prompt.simplified}</Text>
          <View accessibilityRole="radiogroup" style={styles.answerOptions}>
            {homeDemoStory.question.options.map((option, index) => (
              <Pressable
                accessibilityLabel={option.simplified}
                accessibilityRole="radio"
                accessibilityState={{
                  checked: course.storyAnswerIndex === index,
                  disabled: course.storyStatus !== 'reading',
                }}
                disabled={course.storyStatus !== 'reading'}
                key={option.simplified}
                onPress={() =>
                  setCourse((current) =>
                    answerStoryQuestion(current, index, homeDemoStory.question.correctOptionIndex),
                  )
                }
                style={({ pressed }) => [
                  styles.answerOption,
                  course.storyAnswerIndex === index && styles.answerOptionSelected,
                  pressed && styles.answerOptionPressed,
                ]}
              >
                <Text style={styles.answerText}>{option.simplified}</Text>
              </Pressable>
            ))}
          </View>
          {course.storyStatus === 'incorrect' ? (
            <View accessibilityLiveRegion="assertive" style={styles.feedback}>
              <Text style={styles.feedbackTitle}>再读读最后一句</Text>
              <Text style={styles.body}>故事会把答案告诉你。慢慢找，不着急。</Text>
              <PrimaryButton
                label="我再试试"
                onPress={() => setCourse((current) => retryStoryQuestion(current))}
              />
            </View>
          ) : null}
          {course.storyStatus === 'correct' ? (
            <View accessibilityLiveRegion="assertive" style={[styles.feedback, styles.success]}>
              <Text style={styles.feedbackTitle}>✓ 读懂故事了</Text>
              <Text style={styles.body}>{homeDemoStory.transferPrompt}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {course.currentStage === 5 ? (
        <View accessibilityLiveRegion="assertive" style={styles.completion}>
          <Text accessibilityRole="header" style={styles.completionTitle}>
            我的家，完成！
          </Text>
          <Text style={styles.body}>你完成了 4 种练习和 1 个小故事，课程进度已达到 100%。</Text>
          <PrimaryButton
            label="再学一次"
            onPress={() => {
              Speech.stop();
              setCourse(createDemoCourseState());
              setAudioState(createAudioToGlyphState(performance.now()));
              setImageState(createGlyphToImageState(performance.now()));
              setWordState(createWordBuildState(performance.now()));
              setSentenceState(createSentenceOrderState(performance.now()));
            }}
          />
        </View>
      ) : null}

      {continueButton}
    </Screen>
  );
}

const styles = StyleSheet.create({
  answerOption: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 2,
    flex: 1,
    minHeight: 56,
    padding: spacing.md,
  },
  answerOptionPressed: { backgroundColor: colors.surfaceMuted },
  answerOptionSelected: { borderColor: colors.primary },
  answerOptions: { flexDirection: 'row', gap: spacing.md },
  answerText: { color: colors.textPrimary, fontSize: fontSizes.bodyLarge },
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
    lineHeight: lineHeights.display,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  feedback: {
    backgroundColor: colors.warningSurface,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  feedbackTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    fontWeight: fontWeights.bold,
  },
  header: { gap: spacing.md },
  illustration: { fontSize: 58, lineHeight: 72 },
  offlineError: {
    backgroundColor: colors.warningSurface,
    borderRadius: radii.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  offlineNotice: {
    color: colors.textSecondary,
    fontSize: fontSizes.body,
    textAlign: 'center',
  },
  question: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
  },
  screen: { gap: spacing.xl, paddingBottom: spacing.xxl },
  story: { gap: spacing.lg },
  storyCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    gap: spacing.md,
    padding: spacing.xl,
  },
  storySentence: {
    color: colors.textPrimary,
    fontSize: fontSizes.bodyLarge,
    lineHeight: lineHeights.bodyLarge,
  },
  storyTitle: {
    color: colors.textPrimary,
    fontSize: fontSizes.heading,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.heading,
  },
  success: { backgroundColor: colors.successSurface },
  title: {
    color: colors.textPrimary,
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.display,
    textAlign: 'center',
  },
});
