import { resolveOwnNameWritingAssets, type WritingStrokeAsset } from '@hanziquest/curriculum';

export type WritingLessonPhase = 'observe' | 'trace' | 'free';

export type WritingLessonState = Readonly<{
  activeCharacterIndex: number;
  activeStrokeIndex: number;
  assets: readonly WritingStrokeAsset[];
  phase: WritingLessonPhase;
  unsupportedCharacters: readonly string[];
}>;

export function createWritingLessonState(chineseName: string): WritingLessonState {
  const resolved = resolveOwnNameWritingAssets(chineseName);
  return Object.freeze({
    activeCharacterIndex: 0,
    activeStrokeIndex: 0,
    assets: resolved.supported,
    phase: resolved.supported.length === 0 ? 'free' : 'observe',
    unsupportedCharacters: resolved.unsupported,
  });
}

export function selectWritingLessonCharacter(
  state: WritingLessonState,
  characterIndex: number,
): WritingLessonState {
  if (
    !Number.isInteger(characterIndex) ||
    characterIndex < 0 ||
    characterIndex >= state.assets.length
  ) {
    return state;
  }
  return Object.freeze({
    ...state,
    activeCharacterIndex: characterIndex,
    activeStrokeIndex: 0,
  });
}

export function selectWritingLessonPhase(
  state: WritingLessonState,
  phase: WritingLessonPhase,
): WritingLessonState {
  if (phase !== 'free' && state.assets.length === 0) return state;
  return Object.freeze({
    ...state,
    activeStrokeIndex: 0,
    phase,
  });
}

export function advanceWritingLessonStroke(state: WritingLessonState): WritingLessonState {
  const active = state.assets[state.activeCharacterIndex];
  if (!active || state.activeStrokeIndex >= active.strokes.length - 1) return state;
  return Object.freeze({ ...state, activeStrokeIndex: state.activeStrokeIndex + 1 });
}

export function restartWritingLessonStroke(state: WritingLessonState): WritingLessonState {
  if (state.activeStrokeIndex === 0) return state;
  return Object.freeze({ ...state, activeStrokeIndex: 0 });
}
