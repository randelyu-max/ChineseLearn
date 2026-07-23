import {
  canonicalPinyinBase,
  isLegalPinyinCombination,
  normalizePinyinSyllable,
  type PinyinFinal,
  type PinyinInitial,
  type PinyinTone,
} from '@hanziquest/contracts';

export type PinyinSyllableBuildExerciseDefinition = Readonly<{
  activityId: string;
  finalOptions: readonly PinyinFinal[];
  initialOptions: readonly PinyinInitial[];
  target: Readonly<{
    display: string;
    final: PinyinFinal;
    initial: PinyinInitial;
    numbered: string;
    tone: PinyinTone;
  }>;
  toneOptions: readonly PinyinTone[];
}>;

export type PinyinSyllableBuildState = Readonly<{
  retryCount: number;
  selectedFinal: PinyinFinal | null;
  selectedInitial: PinyinInitial | null;
  selectedTone: PinyinTone | null;
  status: 'building' | 'ready' | 'correct-feedback' | 'incorrect-feedback';
}>;

export function buildPinyinSyllableExercise(
  input: Readonly<{
    activityId: string;
    finalOptions: readonly PinyinFinal[];
    initialOptions: readonly PinyinInitial[];
    targetSyllable: string;
    toneOptions?: readonly PinyinTone[];
  }>,
): PinyinSyllableBuildExerciseDefinition {
  const target = normalizePinyinSyllable(input.targetSyllable);
  if (!target) throw new Error(`Invalid target Pinyin syllable: ${input.targetSyllable}`);
  const initialOptions = [...new Set(input.initialOptions)];
  const finalOptions = [...new Set(input.finalOptions)];
  const toneOptions = [...new Set(input.toneOptions ?? ([1, 2, 3, 4, 5] as const))];
  if (!initialOptions.includes(target.initial)) {
    throw new Error('Initial options must contain the target initial.');
  }
  if (!finalOptions.includes(target.final)) {
    throw new Error('Final options must contain the target final.');
  }
  if (!toneOptions.includes(target.tone)) {
    throw new Error('Tone options must contain the target tone.');
  }
  if (initialOptions.length < 2 || finalOptions.length < 2 || toneOptions.length < 2) {
    throw new Error('Each Pinyin assembly step requires at least two choices.');
  }
  return Object.freeze({
    activityId: input.activityId,
    finalOptions: Object.freeze(finalOptions),
    initialOptions: Object.freeze(initialOptions),
    target: Object.freeze({
      display: target.display,
      final: target.final,
      initial: target.initial,
      numbered: target.numbered,
      tone: target.tone,
    }),
    toneOptions: Object.freeze(toneOptions),
  });
}

export const pinyinSyllableBuildDemoExercise = buildPinyinSyllableExercise({
  activityId: '57000000-0000-4000-8000-000000000010',
  finalOptions: ['üe', 'ie', 'u'],
  initialOptions: ['x', 'q', 'sh'],
  targetSyllable: 'xue2',
});

export function createPinyinSyllableBuildState(): PinyinSyllableBuildState {
  return {
    retryCount: 0,
    selectedFinal: null,
    selectedInitial: null,
    selectedTone: null,
    status: 'building',
  };
}

export function selectPinyinInitial(
  exercise: PinyinSyllableBuildExerciseDefinition,
  state: PinyinSyllableBuildState,
  initial: PinyinInitial,
): PinyinSyllableBuildState {
  if (state.status !== 'building' || state.selectedInitial !== null) return state;
  if (!exercise.initialOptions.includes(initial)) {
    throw new Error('Selected initial does not belong to this exercise.');
  }
  return { ...state, selectedInitial: initial };
}

export function selectPinyinFinal(
  exercise: PinyinSyllableBuildExerciseDefinition,
  state: PinyinSyllableBuildState,
  final: PinyinFinal,
): PinyinSyllableBuildState {
  if (state.status !== 'building' || state.selectedFinal !== null) return state;
  if (state.selectedInitial === null) throw new Error('Select an initial before a final.');
  if (!exercise.finalOptions.includes(final)) {
    throw new Error('Selected final does not belong to this exercise.');
  }
  if (!isLegalPinyinCombination(state.selectedInitial, final)) {
    throw new Error('Selected initial and final are not a legal Pinyin combination.');
  }
  return { ...state, selectedFinal: final };
}

export function selectPinyinTone(
  exercise: PinyinSyllableBuildExerciseDefinition,
  state: PinyinSyllableBuildState,
  tone: PinyinTone,
): PinyinSyllableBuildState {
  if (state.status !== 'building' || state.selectedTone !== null) return state;
  if (state.selectedInitial === null || state.selectedFinal === null) {
    throw new Error('Select an initial and final before a tone.');
  }
  if (!exercise.toneOptions.includes(tone)) {
    throw new Error('Selected tone does not belong to this exercise.');
  }
  return { ...state, selectedTone: tone, status: 'ready' };
}

export function assembledPinyin(
  state: PinyinSyllableBuildState,
): ReturnType<typeof normalizePinyinSyllable> {
  if (
    state.selectedInitial === null ||
    state.selectedFinal === null ||
    state.selectedTone === null
  ) {
    return null;
  }
  const base = canonicalPinyinBase(state.selectedInitial, state.selectedFinal);
  return base ? normalizePinyinSyllable(`${base}${state.selectedTone}`) : null;
}

export function submitPinyinSyllable(
  exercise: PinyinSyllableBuildExerciseDefinition,
  state: PinyinSyllableBuildState,
): PinyinSyllableBuildState {
  if (state.status !== 'ready') return state;
  const assembled = assembledPinyin(state);
  if (!assembled) throw new Error('Completed Pinyin assembly must be legal.');
  return {
    ...state,
    status:
      assembled.numbered === exercise.target.numbered ? 'correct-feedback' : 'incorrect-feedback',
  };
}

export function resetPinyinSyllable(state: PinyinSyllableBuildState): PinyinSyllableBuildState {
  if (state.status === 'correct-feedback') return state;
  return {
    ...createPinyinSyllableBuildState(),
    retryCount: state.retryCount + (state.status === 'incorrect-feedback' ? 1 : 0),
  };
}

export function canSelectFinal(state: PinyinSyllableBuildState, final: PinyinFinal): boolean {
  return (
    state.status === 'building' &&
    state.selectedInitial !== null &&
    state.selectedFinal === null &&
    isLegalPinyinCombination(state.selectedInitial, final)
  );
}

export function pinyinSyllableBuildLayout(viewportWidth: number): {
  compact: boolean;
  minimumTargetHeight: 48;
} {
  return { compact: viewportWidth < 360, minimumTargetHeight: 48 };
}
