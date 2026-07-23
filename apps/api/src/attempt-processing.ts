import {
  LearningExerciseSchema,
  type AttemptDraft,
  type AttemptPinyinSupport,
  type LearningExercise,
} from '@hanziquest/contracts';
import {
  calculateExerciseQuality,
  calculatePinyinEvidenceWeighting,
  exerciseBktParameters,
  initialStabilityDays,
  scheduleNextReview,
  stabilityAfterLapse,
  stabilityAfterRetrievalSuccess,
  updateMastery,
} from '@hanziquest/learning-engine';

export type EvaluatedAttempt = Readonly<{
  activityType: LearningExercise['type'];
  conceptType: 'character' | 'sentence' | 'word';
  correct: boolean;
  evidenceWeight: number;
  expectedValue: string;
  metadata: Readonly<Record<string, unknown>>;
  selectedValue: string;
  skill: 'audio_to_glyph' | 'glyph_to_image' | 'sentence_order' | 'word_build';
  targetConceptIds: readonly string[];
}>;

export type ReplayAttempt = Readonly<{
  correct: boolean;
  deviceEventAt: Date;
  evidenceWeight: number;
  hintLevel: number;
  id: string;
  offlineSequence: number;
  pinyinSupport: AttemptPinyinSupport;
}>;

function sameOrder(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function selectedIds(attempt: AttemptDraft): readonly string[] {
  return 'optionId' in attempt.answer ? [attempt.answer.optionId] : attempt.answer.tileIds;
}

function expectedIds(exercise: LearningExercise): readonly string[] {
  return 'correctOptionId' in exercise ? [exercise.correctOptionId] : exercise.correctTileOrder;
}

function dimensions(exercise: LearningExercise) {
  switch (exercise.type) {
    case 'audio_to_glyph':
      return {
        axis: 'hanzi_recognition' as const,
        conceptType: 'character' as const,
        parameters:
          exercise.options.length === 2
            ? exerciseBktParameters.audio_to_glyph_two_choice
            : exerciseBktParameters.audio_to_glyph_four_choice,
        skill: 'audio_to_glyph' as const,
      };
    case 'glyph_to_image':
      return {
        axis: 'hanzi_recognition' as const,
        conceptType: 'character' as const,
        parameters: exerciseBktParameters.glyph_to_image,
        skill: 'glyph_to_image' as const,
      };
    case 'word_build':
      return {
        axis: 'word_reading' as const,
        conceptType: 'word' as const,
        parameters: exerciseBktParameters.word_build,
        skill: 'word_build' as const,
      };
    case 'sentence_order':
      return {
        axis: 'sentence_reading' as const,
        conceptType: 'sentence' as const,
        parameters: exerciseBktParameters.word_build,
        skill: 'sentence_order' as const,
      };
  }
}

export function parseLessonExercises(contentSpec: unknown): readonly LearningExercise[] {
  if (typeof contentSpec !== 'object' || contentSpec === null) return [];
  const exercises = (contentSpec as Record<string, unknown>).exercises;
  if (!Array.isArray(exercises)) return [];
  return exercises.flatMap((candidate) => {
    const parsed = LearningExerciseSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
}

export function evaluateAttempt(
  attempt: AttemptDraft,
  exercise: LearningExercise,
): EvaluatedAttempt {
  const selected = selectedIds(attempt);
  const expected = expectedIds(exercise);
  const correct = sameOrder(selected, expected);
  const dimension = dimensions(exercise);
  const correctness =
    correct && attempt.hintLevel === 'full_answer'
      ? 'revealed'
      : correct && (attempt.hintLevel === 'visual_hint' || attempt.retryCount > 0)
        ? 'hinted_correct'
        : correct
          ? 'first_try_correct'
          : 'incorrect';
  const quality = calculateExerciseQuality({
    baselineResponseTimeMs: 4_000,
    correctness,
    hint:
      attempt.hintLevel === 'full_answer'
        ? 'full_answer'
        : attempt.hintLevel === 'visual_hint'
          ? 'image'
          : attempt.pinyinSupport && attempt.pinyinSupport !== 'none'
            ? 'pinyin'
            : 'none',
    isTransfer: false,
    responseTimeMs: attempt.responseMs,
    retryCount: attempt.retryCount,
  });
  const evidence = calculatePinyinEvidenceWeighting({
    axis: dimension.axis,
    baseQuality: quality.quality,
    isCorrect: correct,
    pinyinSupport:
      attempt.hintLevel === 'full_answer' ? 'full_answer' : (attempt.pinyinSupport ?? 'none'),
  });
  return Object.freeze({
    activityType: exercise.type,
    conceptType: dimension.conceptType,
    correct,
    evidenceWeight: evidence.independentEvidenceQuality,
    expectedValue: JSON.stringify(expected),
    metadata: Object.freeze({
      clientCorrectnessIgnored: attempt.isCorrectClient,
      evidenceAlgorithmVersion: evidence.algorithmVersion,
      offlineSequence: attempt.offlineSequence,
      pinyinSupport: attempt.pinyinSupport ?? 'none',
      replayCount: attempt.replayCount,
      retryCount: attempt.retryCount,
    }),
    selectedValue: JSON.stringify(selected),
    skill: dimension.skill,
    targetConceptIds: Object.freeze([...exercise.targetConceptIds]),
  });
}

export function answerMatchesExercise(attempt: AttemptDraft, exercise: LearningExercise): boolean {
  const optionExercise = exercise.type === 'audio_to_glyph' || exercise.type === 'glyph_to_image';
  return optionExercise ? 'optionId' in attempt.answer : 'tileIds' in attempt.answer;
}

export function replaySkillState(
  attempts: readonly ReplayAttempt[],
  activityType: EvaluatedAttempt['activityType'],
) {
  const ordered = [...attempts].sort(
    (left, right) =>
      left.deviceEventAt.getTime() - right.deviceEventAt.getTime() ||
      left.offlineSequence - right.offlineSequence ||
      left.id.localeCompare(right.id),
  );
  let mastery = 0.15;
  let stability = initialStabilityDays;
  let independentCorrectCount = 0;
  let hintedCorrectCount = 0;
  let incorrectCount = 0;
  const parameters =
    activityType === 'audio_to_glyph'
      ? exerciseBktParameters.audio_to_glyph_four_choice
      : activityType === 'glyph_to_image'
        ? exerciseBktParameters.glyph_to_image
        : exerciseBktParameters.word_build;
  for (const attempt of ordered) {
    mastery = updateMastery(mastery, attempt.correct, attempt.evidenceWeight, parameters).mastery;
    if (attempt.correct) {
      stability = stabilityAfterRetrievalSuccess(stability, 1 - mastery, attempt.evidenceWeight);
      if (attempt.hintLevel === 0 && attempt.pinyinSupport === 'none') {
        independentCorrectCount += 1;
      } else hintedCorrectCount += 1;
    } else {
      stability = stabilityAfterLapse(stability);
      incorrectCount += 1;
    }
  }
  const latest = ordered.at(-1);
  const reason =
    !latest || !latest.correct || latest.hintLevel >= 4
      ? 'lapse_or_full_hint'
      : 'retrieval_success';
  const nowMs = latest?.deviceEventAt.getTime() ?? 0;
  const review = scheduleNextReview({ nowMs, reason, stabilityDays: stability });
  return Object.freeze({
    exposureCount: ordered.length,
    hintedCorrectCount,
    incorrectCount,
    independentCorrectCount,
    lastAttemptAt: latest?.deviceEventAt ?? null,
    mastery,
    nextReviewAt: new Date(review.nextReviewAtMs),
    review,
    stability,
  });
}
