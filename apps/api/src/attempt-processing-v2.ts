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
} from '@hanziquest/learning-engine';

export const SUPPORTED_HANZI_ATTEMPT_V2_TYPES = Object.freeze([
  'audio_to_glyph',
  'glyph_to_image',
  'word_build',
  'sentence_order',
] as const);

type SupportedHanziExerciseV2 = Extract<
  LearningExerciseV2,
  { type: (typeof SUPPORTED_HANZI_ATTEMPT_V2_TYPES)[number] }
>;

export type EvaluatedEvidenceV2 = AttemptEvidenceResultV1 &
  Readonly<{
    evidenceIndex: number;
    role: EvidenceTargetV1['role'];
  }>;

export type EvaluatedAttemptV2 = Readonly<{
  activityType: SupportedHanziExerciseV2['type'];
  correct: boolean;
  evidence: readonly EvaluatedEvidenceV2[];
  expectedValue: string;
  selectedValue: string;
}>;

function isSupportedHanziExerciseV2(
  exercise: LearningExerciseV2,
): exercise is SupportedHanziExerciseV2 {
  return (SUPPORTED_HANZI_ATTEMPT_V2_TYPES as readonly string[]).includes(exercise.type);
}

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function selectedIds(attempt: AttemptDraftV2): readonly string[] {
  return 'optionId' in attempt.answer ? [attempt.answer.optionId] : attempt.answer.tileIds;
}

function expectedIds(exercise: SupportedHanziExerciseV2): readonly string[] {
  return 'correctOptionId' in exercise ? [exercise.correctOptionId] : exercise.correctTileOrder;
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
  if (!isSupportedHanziExerciseV2(exercise)) return false;
  const optionExercise = exercise.type === 'audio_to_glyph' || exercise.type === 'glyph_to_image';
  return optionExercise ? 'optionId' in attempt.answer : 'tileIds' in attempt.answer;
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
  if (!isSupportedHanziExerciseV2(exercise)) {
    throw new Error(`Exercise type ${exercise.type} is not enabled for Attempts V2.`);
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
  const correct = sameOrder(selected, expected);
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
      pinyinSupport,
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
        algorithmVersion: ATTEMPT_EVIDENCE_V1_ALGORITHM_VERSION,
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
