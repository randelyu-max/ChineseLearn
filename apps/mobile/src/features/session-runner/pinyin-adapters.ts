import {
  normalizePinyinSyllable,
  type LearningExerciseV2,
  type PinyinTone,
} from '@hanziquest/contracts';

import type { AudioToPinyinExerciseDefinition, AudioToPinyinState } from '../audio-to-pinyin';
import type { GlyphToPinyinExerciseDefinition, GlyphToPinyinState } from '../glyph-to-pinyin';
import type {
  PinyinSyllableBuildExerciseDefinition,
  PinyinSyllableBuildState,
} from '../pinyin-syllable-build';
import type { PinyinToAudioExerciseDefinition, PinyinToAudioState } from '../pinyin-to-audio';
import type { PinyinToGlyphExerciseDefinition, PinyinToGlyphState } from '../pinyin-to-glyph';
import type { ToneChoiceExerciseDefinition, ToneChoiceState } from '../tone-choice';
import type { FormalSessionRunnerState } from './model';

export type FormalPinyinExercise = Extract<
  LearningExerciseV2,
  {
    type:
      | 'audio_to_pinyin'
      | 'pinyin_to_audio'
      | 'pinyin_to_glyph'
      | 'glyph_to_pinyin'
      | 'tone_choice'
      | 'pinyin_syllable_build';
  }
>;

type OptionStatus = 'awaiting-answer' | 'correct-feedback' | 'incorrect-feedback';

export function isFormalPinyinExercise(
  exercise: LearningExerciseV2,
): exercise is FormalPinyinExercise {
  return [
    'audio_to_pinyin',
    'pinyin_to_audio',
    'pinyin_to_glyph',
    'glyph_to_pinyin',
    'tone_choice',
    'pinyin_syllable_build',
  ].includes(exercise.type);
}

function optionStatus(runner: FormalSessionRunnerState): OptionStatus {
  if (runner.phase !== 'feedback') return 'awaiting-answer';
  return runner.activityState.localCorrect ? 'correct-feedback' : 'incorrect-feedback';
}

function normalized(numbered: string) {
  const value = normalizePinyinSyllable(numbered);
  if (!value) throw new Error(`The immutable Session contains invalid Pinyin: ${numbered}`);
  return value;
}

export function adaptAudioToPinyin(
  exercise: Extract<FormalPinyinExercise, { type: 'audio_to_pinyin' }>,
  runner: FormalSessionRunnerState,
): { exercise: AudioToPinyinExerciseDefinition; state: AudioToPinyinState } {
  return {
    exercise: {
      activityId: exercise.activityId,
      audioAsset: { assetKey: exercise.promptAudioAssetKey, source: 'bundled' },
      correctOptionId: exercise.correctOptionId,
      options: exercise.options.map((option) => ({
        ...option,
        tone: normalized(option.numbered).tone,
      })),
      targetSyllableId: exercise.correctOptionId,
    },
    state: {
      playCount: runner.activityState.audioPlayCounts[exercise.promptAudioAssetKey] ?? 0,
      retryCount: runner.activityState.retryCount,
      selectedOptionId: runner.activityState.selectedOptionId,
      status: optionStatus(runner),
    },
  };
}

export function adaptPinyinToAudio(
  exercise: Extract<FormalPinyinExercise, { type: 'pinyin_to_audio' }>,
  runner: FormalSessionRunnerState,
): { exercise: PinyinToAudioExerciseDefinition; state: PinyinToAudioState } {
  return {
    exercise: {
      activityId: exercise.activityId,
      correctOptionId: exercise.correctOptionId,
      options: exercise.options.map((option) => ({
        assetKey: option.audioAssetKey,
        numbered: option.numbered,
        optionId: option.optionId,
        source: 'bundled',
      })),
      prompt: {
        ...exercise.prompt,
        tone: normalized(exercise.prompt.numbered).tone,
      },
    },
    state: {
      listenCounts: Object.fromEntries(
        exercise.options.map((option) => [
          option.optionId,
          runner.activityState.audioPlayCounts[option.audioAssetKey] ?? 0,
        ]),
      ),
      retryCount: runner.activityState.retryCount,
      selectedOptionId: runner.activityState.selectedOptionId,
      status: optionStatus(runner),
    },
  };
}

export function adaptPinyinToGlyph(
  exercise: Extract<FormalPinyinExercise, { type: 'pinyin_to_glyph' }>,
  runner: FormalSessionRunnerState,
): { exercise: PinyinToGlyphExerciseDefinition; state: PinyinToGlyphState } {
  return {
    exercise: {
      activityId: exercise.activityId,
      contextHintZh: exercise.contextHintZh,
      correctOptionId: exercise.correctOptionId,
      options: exercise.options.map((option) => ({
        ...option,
        tone: normalized(option.numbered).tone,
      })),
      prompt: {
        ...exercise.prompt,
        tone: normalized(exercise.prompt.numbered).tone,
      },
      targetOptionId: exercise.correctOptionId,
    },
    state: {
      retryCount: runner.activityState.retryCount,
      selectedOptionId: runner.activityState.selectedOptionId,
      status: optionStatus(runner),
    },
  };
}

export function adaptGlyphToPinyin(
  exercise: Extract<FormalPinyinExercise, { type: 'glyph_to_pinyin' }>,
  runner: FormalSessionRunnerState,
): { exercise: GlyphToPinyinExerciseDefinition; state: GlyphToPinyinState } {
  const readingByOption = new Map(
    exercise.options.map((option) => [option.optionId, option.numbered]),
  );
  return {
    exercise: {
      acceptedOptionIds: exercise.acceptedOptionIds,
      acceptedReadings: exercise.acceptedOptionIds.map(
        (optionId) => readingByOption.get(optionId) ?? '',
      ),
      activityId: exercise.activityId,
      contextZh: exercise.contextZh,
      hintZh: exercise.hintZh,
      knownGlyphReadings: exercise.knownReadings,
      options: exercise.options.map((option) => ({
        ...option,
        tone: normalized(option.numbered).tone,
      })),
      targetGlyph: exercise.targetGlyph,
    },
    state: {
      hintVisible:
        runner.activityState.hintLevel === 'visual_hint' ||
        (runner.phase === 'feedback' && runner.activityState.localCorrect === false),
      retryCount: runner.activityState.retryCount,
      selectedOptionId: runner.activityState.selectedOptionId,
      status: optionStatus(runner),
    },
  };
}

const TONE_LABELS: Readonly<Record<PinyinTone, string>> = {
  1: '第一声',
  2: '第二声',
  3: '第三声',
  4: '第四声',
  5: '轻声',
};

export function adaptToneChoice(
  exercise: Extract<FormalPinyinExercise, { type: 'tone_choice' }>,
  runner: FormalSessionRunnerState,
): { exercise: ToneChoiceExerciseDefinition; state: ToneChoiceState } {
  const target = normalized(exercise.targetSyllable);
  return {
    exercise: {
      activityId: exercise.activityId,
      contextZh: exercise.contextZh,
      correctOptionId: exercise.correctOptionId,
      options: exercise.options.map((option) => ({
        ...option,
        label: TONE_LABELS[option.tone],
        numbered: normalized(`${exercise.baseSyllable}${option.tone}`).numbered,
      })),
      prompt: {
        accessibilityLabel: `${target.display}，请选择它的声调`,
        display: target.display,
        numbered: target.numbered,
      },
      targetTone: target.tone,
    },
    state: {
      retryCount: runner.activityState.retryCount,
      selectedOptionId: runner.activityState.selectedOptionId,
      status: optionStatus(runner),
    },
  };
}

export function adaptPinyinSyllableBuild(
  exercise: Extract<FormalPinyinExercise, { type: 'pinyin_syllable_build' }>,
  runner: FormalSessionRunnerState,
): {
  exercise: PinyinSyllableBuildExerciseDefinition;
  state: PinyinSyllableBuildState;
} {
  const target = normalized(exercise.targetSyllable);
  const selected = runner.activityState.selectedTileIds;
  const initial = exercise.initialOptions.find((option) => option.optionId === selected[0]);
  const final = exercise.finalOptions.find((option) => option.optionId === selected[1]);
  const tone = exercise.toneOptions.find((option) => option.optionId === selected[2]);
  const feedbackStatus =
    runner.phase === 'feedback'
      ? runner.activityState.localCorrect
        ? 'correct-feedback'
        : 'incorrect-feedback'
      : selected.length === 3
        ? 'ready'
        : 'building';
  return {
    exercise: {
      activityId: exercise.activityId,
      finalOptions: exercise.finalOptions.map((option) => option.value),
      initialOptions: exercise.initialOptions.map((option) => option.value),
      target,
      toneOptions: exercise.toneOptions.map((option) => option.value),
    },
    state: {
      retryCount: runner.activityState.retryCount,
      selectedFinal: final?.value ?? null,
      selectedInitial: initial?.value ?? null,
      selectedTone: tone?.value ?? null,
      status: feedbackStatus,
    },
  };
}
