import {
  ATTEMPT_EVIDENCE_V1_ALGORITHM_VERSION,
  AttemptEvidenceResultV1Schema,
  LearningExerciseV2Schema,
  SessionActivitySnapshotV2Schema,
  type AttemptDraftV2,
  type AttemptEvidenceResultV1,
  type AttemptPinyinSupport,
  type EvidenceTargetV1,
  type LearningExerciseV2,
  type SessionActivitySnapshotV2,
} from '@hanziquest/contracts';
import {
  calculateExerciseQuality,
  calculatePinyinEvidenceWeighting,
  PINYIN_SCORING_ALGORITHM_VERSION,
} from '@hanziquest/learning-engine';

export const SUPPORTED_ATTEMPT_V2_TYPES = Object.freeze([
  'audio_to_glyph',
  'glyph_to_image',
  'word_build',
  'sentence_order',
  'audio_to_pinyin',
  'pinyin_to_audio',
  'pinyin_to_glyph',
  'glyph_to_pinyin',
  'tone_choice',
  'pinyin_syllable_build',
] as const);

type SupportedExerciseV2 = Extract<
  LearningExerciseV2,
  { type: (typeof SUPPORTED_ATTEMPT_V2_TYPES)[number] }
>;

export type EvaluatedEvidenceV2 = AttemptEvidenceResultV1 &
  Readonly<{
    evidenceIndex: number;
    role: EvidenceTargetV1['role'];
  }>;

export type EvaluatedAttemptV2 = Readonly<{
  activityType: SupportedExerciseV2['type'];
  correct: boolean;
  evidence: readonly EvaluatedEvidenceV2[];
  expectedValue: string;
  selectedValue: string;
}>;

function isSupportedExerciseV2(exercise: LearningExerciseV2): exercise is SupportedExerciseV2 {
  return (SUPPORTED_ATTEMPT_V2_TYPES as readonly string[]).includes(exercise.type);
}

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function selectedIds(attempt: AttemptDraftV2): readonly string[] {
  return 'optionId' in attempt.answer ? [attempt.answer.optionId] : attempt.answer.tileIds;
}

function expectedIds(exercise: SupportedExerciseV2): readonly string[] {
  switch (exercise.type) {
    case 'glyph_to_pinyin':
      return exercise.acceptedOptionIds;
    case 'pinyin_syllable_build':
      return [
        exercise.correctInitialOptionId,
        exercise.correctFinalOptionId,
        exercise.correctToneOptionId,
      ];
    case 'sentence_order':
    case 'word_build':
      return exercise.correctTileOrder;
    default:
      return [exercise.correctOptionId];
  }
}

function answerIsCorrect(
  exercise: SupportedExerciseV2,
  selected: readonly string[],
  expected: readonly string[],
): boolean {
  return exercise.type === 'glyph_to_pinyin'
    ? selected.length === 1 && expected.includes(selected[0]!)
    : sameOrder(selected, expected);
}

function pinyinSupportForEvidence(
  exercise: SupportedExerciseV2,
  axis: EvidenceTargetV1['abilityAxis'],
  submittedSupport: AttemptPinyinSupport,
): AttemptPinyinSupport {
  if (
    exercise.type === 'pinyin_to_glyph' &&
    axis === 'hanzi_recognition' &&
    submittedSupport === 'none'
  ) {
    return 'pinyin_visible';
  }
  return submittedSupport;
}

function actualPinyinSupport(
  attempt: AttemptDraftV2,
  activity: SessionActivitySnapshotV2,
): AttemptPinyinSupport | null {
  if (attempt.hintLevel === 'full_answer') {
    return attempt.pinyinSupport === 'full_answer' ? 'full_answer' : null;
  }
  if (attempt.pinyinSupport === 'full_answer') return null;

  const decision = activity.pinyinSupport;
  if (!decision) return attempt.pinyinSupport === 'none' ? 'none' : null;
  if (decision.initialEvidenceSupport === 'pinyin_visible') {
    return attempt.pinyinSupport === 'pinyin_visible' ? 'pinyin_visible' : null;
  }
  if (attempt.pinyinSupport === 'none') return 'none';
  if (attempt.pinyinSupport === 'pinyin_revealed' && decision.allowReveal) {
    return 'pinyin_revealed';
  }
  return null;
}

export function answerMatchesExerciseV2(
  attempt: AttemptDraftV2,
  exercise: LearningExerciseV2,
): boolean {
  if (!isSupportedExerciseV2(exercise)) return false;
  const tileExercise =
    exercise.type === 'word_build' ||
    exercise.type === 'sentence_order' ||
    exercise.type === 'pinyin_syllable_build';
  return tileExercise ? 'tileIds' in attempt.answer : 'optionId' in attempt.answer;
}

export function supportStateMatchesActivityV2(
  attempt: AttemptDraftV2,
  activity: SessionActivitySnapshotV2,
): boolean {
  return actualPinyinSupport(attempt, activity) !== null;
}

export function evaluateAttemptV2(
  draft: AttemptDraftV2,
  snapshot: SessionActivitySnapshotV2,
): EvaluatedAttemptV2 {
  const activity = SessionActivitySnapshotV2Schema.parse(snapshot);
  const exercise = LearningExerciseV2Schema.parse(activity.exercise);
  if (!isSupportedExerciseV2(exercise)) {
    throw new Error('The exercise type is not enabled for Attempts V2.');
  }
  if (!answerMatchesExerciseV2(draft, exercise)) {
    throw new Error('The submitted answer shape does not match the Session Activity.');
  }
  const pinyinSupport = actualPinyinSupport(draft, activity);
  if (pinyinSupport === null) {
    throw new Error('The submitted Pinyin support state is not possible for this Activity.');
  }

  const selected = selectedIds(draft);
  const expected = expectedIds(exercise);
  const correct = answerIsCorrect(exercise, selected, expected);
  const correctness =
    correct && draft.hintLevel === 'full_answer'
      ? 'revealed'
      : correct && (draft.hintLevel === 'visual_hint' || draft.retryCount > 0)
        ? 'hinted_correct'
        : correct
          ? 'first_try_correct'
          : 'incorrect';
  const baseQuality = calculateExerciseQuality({
    baselineResponseTimeMs: 4_000,
    correctness,
    hint:
      draft.hintLevel === 'full_answer'
        ? 'full_answer'
        : draft.hintLevel === 'visual_hint'
          ? 'image'
          : pinyinSupport !== 'none'
            ? 'pinyin'
            : 'none',
    isTransfer: false,
    responseTimeMs: draft.responseMs,
    retryCount: draft.retryCount,
  }).quality;
  const evidence = activity.evidenceTargets.map((target, evidenceIndex) => {
    const weighted = calculatePinyinEvidenceWeighting({
      axis:
        target.abilityAxis === 'confusion_discrimination'
          ? 'hanzi_recognition'
          : target.abilityAxis,
      baseQuality,
      isCorrect: correct,
      pinyinSupport: pinyinSupportForEvidence(exercise, target.abilityAxis, pinyinSupport),
    });
    return Object.freeze({
      ...AttemptEvidenceResultV1Schema.parse({
        conceptType: target.conceptType,
        conceptId: target.conceptId,
        skill: target.skill,
        abilityAxis: target.abilityAxis,
        correct,
        baseQuality: weighted.baseQuality,
        supportMultiplier: weighted.independentEvidenceWeight,
        effectiveQuality: weighted.independentEvidenceQuality,
        algorithmVersion:
          exercise.type.includes('pinyin') || exercise.type === 'tone_choice'
            ? `${ATTEMPT_EVIDENCE_V1_ALGORITHM_VERSION}+${PINYIN_SCORING_ALGORITHM_VERSION}`
            : ATTEMPT_EVIDENCE_V1_ALGORITHM_VERSION,
      }),
      evidenceIndex,
      role: target.role,
    });
  });
  return Object.freeze({
    activityType: exercise.type,
    correct,
    evidence: Object.freeze(evidence),
    expectedValue: JSON.stringify(expected),
    selectedValue: JSON.stringify(selected),
  });
}
