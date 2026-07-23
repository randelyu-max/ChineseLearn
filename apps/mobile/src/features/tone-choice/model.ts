import { normalizePinyinSyllable, type PinyinTone } from '@hanziquest/contracts';

export type ToneChoiceOption = Readonly<{
  accessibilityLabel: string;
  display: string;
  label: string;
  numbered: string;
  optionId: string;
  tone: PinyinTone;
}>;

export type ToneChoiceExerciseDefinition = Readonly<{
  activityId: string;
  contextZh: string | null;
  correctOptionId: string;
  options: readonly ToneChoiceOption[];
  prompt: Readonly<{
    accessibilityLabel: string;
    display: string;
    numbered: string;
  }>;
  targetTone: PinyinTone;
}>;

export type ToneChoiceState = Readonly<{
  retryCount: number;
  selectedOptionId: string | null;
  status: 'awaiting-answer' | 'correct-feedback' | 'incorrect-feedback';
}>;

const TONE_LABELS: Readonly<Record<PinyinTone, string>> = {
  1: '第一声',
  2: '第二声',
  3: '第三声',
  4: '第四声',
  5: '轻声',
};

export function toneChoiceLabel(tone: PinyinTone): string {
  return TONE_LABELS[tone];
}

export function buildToneOptionTable(baseSyllable: string): readonly ToneChoiceOption[] {
  const normalizedBase = normalizePinyinSyllable(baseSyllable);
  if (!normalizedBase) throw new Error(`Invalid Pinyin syllable: ${baseSyllable}`);
  const tones: readonly PinyinTone[] = [1, 2, 3, 4, 5];
  return Object.freeze(
    tones.map((tone) => {
      const normalized = normalizePinyinSyllable(`${normalizedBase.base}${tone}`);
      if (!normalized) throw new Error(`Cannot apply tone ${tone} to ${normalizedBase.base}.`);
      return Object.freeze({
        accessibilityLabel: `${normalized.display}，${TONE_LABELS[tone]}`,
        display: normalized.display,
        label: TONE_LABELS[tone],
        numbered: normalized.numbered,
        optionId: `tone-${tone}`,
        tone,
      });
    }),
  );
}

export function buildToneChoiceExercise(
  input: Readonly<{
    activityId: string;
    contextZh?: string;
    targetSyllable: string;
  }>,
): ToneChoiceExerciseDefinition {
  const target = normalizePinyinSyllable(input.targetSyllable);
  if (!target) throw new Error(`Invalid target Pinyin syllable: ${input.targetSyllable}`);
  const options = buildToneOptionTable(target.base);
  const correctOption = options.find((option) => option.tone === target.tone)!;
  return Object.freeze({
    activityId: input.activityId,
    contextZh: input.contextZh?.trim() || null,
    correctOptionId: correctOption.optionId,
    options,
    prompt: Object.freeze({
      accessibilityLabel: `${target.display}，请选择它的声调`,
      display: target.display,
      numbered: target.numbered,
    }),
    targetTone: target.tone,
  });
}

export const toneChoiceDemoExercise = buildToneChoiceExercise({
  activityId: '56000000-0000-4000-8000-000000000010',
  contextZh: '你好吗？',
  targetSyllable: 'ma5',
});

export function createToneChoiceState(): ToneChoiceState {
  return {
    retryCount: 0,
    selectedOptionId: null,
    status: 'awaiting-answer',
  };
}

export function selectToneChoiceOption(
  exercise: ToneChoiceExerciseDefinition,
  state: ToneChoiceState,
  optionId: string,
): ToneChoiceState {
  if (state.status !== 'awaiting-answer') return state;
  if (!exercise.options.some((option) => option.optionId === optionId)) {
    throw new Error('Selected tone does not belong to this exercise.');
  }
  return {
    ...state,
    selectedOptionId: optionId,
    status: optionId === exercise.correctOptionId ? 'correct-feedback' : 'incorrect-feedback',
  };
}

export function retryToneChoice(state: ToneChoiceState): ToneChoiceState {
  return state.status !== 'incorrect-feedback'
    ? state
    : {
        ...state,
        retryCount: state.retryCount + 1,
        selectedOptionId: null,
        status: 'awaiting-answer',
      };
}

export function toneChoiceLayout(viewportWidth: number): {
  columns: 1 | 2;
  minimumOptionHeight: 88;
} {
  return { columns: viewportWidth < 360 ? 1 : 2, minimumOptionHeight: 88 };
}
