export const LEARNING_ALGORITHM_VERSION = 'bkt-v1' as const;
export const masteryBounds = Object.freeze({ maximum: 0.98, minimum: 0.02 });

export type ExerciseBktParameters = Readonly<{
  guessProbability: number;
  learnProbability: number;
  slipProbability: number;
}>;

export const exerciseBktParameters = Object.freeze({
  audio_to_glyph_four_choice: Object.freeze({
    guessProbability: 0.25,
    learnProbability: 0.14,
    slipProbability: 0.1,
  }),
  audio_to_glyph_two_choice: Object.freeze({
    guessProbability: 0.5,
    learnProbability: 0.16,
    slipProbability: 0.08,
  }),
  glyph_to_image: Object.freeze({
    guessProbability: 0.25,
    learnProbability: 0.14,
    slipProbability: 0.12,
  }),
  sentence_comprehension_three_choice: Object.freeze({
    guessProbability: 0.33,
    learnProbability: 0.1,
    slipProbability: 0.15,
  }),
  speech_recognition: Object.freeze({
    guessProbability: 0.05,
    learnProbability: 0.09,
    slipProbability: 0.2,
  }),
  word_build: Object.freeze({
    guessProbability: 0.2,
    learnProbability: 0.13,
    slipProbability: 0.12,
  }),
} satisfies Record<string, ExerciseBktParameters>);

export type QualityInput = Readonly<{
  baselineResponseTimeMs: number;
  correctness: 'first_try_correct' | 'hinted_correct' | 'revealed' | 'incorrect';
  hint: 'none' | 'image' | 'pinyin' | 'full_answer';
  isTransfer: boolean;
  responseTimeMs: number;
  retryCount: number;
}>;

const correctnessFactors: Record<QualityInput['correctness'], number> = {
  first_try_correct: 1,
  hinted_correct: 0.65,
  incorrect: 0,
  revealed: 0.15,
};

const hintFactors: Record<QualityInput['hint'], number> = {
  full_answer: 0.35,
  image: 0.85,
  none: 1,
  pinyin: 0.7,
};

export type QualityBreakdown = Readonly<{
  correctnessFactor: number;
  hintFactor: number;
  latencyFactor: number;
  quality: number;
  retryFactor: number;
  transferFactor: number;
}>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export function calculateExerciseQuality(input: QualityInput): QualityBreakdown {
  const correctnessFactor = correctnessFactors[input.correctness];
  const hintFactor = hintFactors[input.hint];
  const retryCount = Math.max(0, Math.trunc(finiteOr(input.retryCount, 0)));
  const retryFactor = Math.max(0.6, 1 - retryCount * 0.2);
  const baseline = Math.max(1, finiteOr(input.baselineResponseTimeMs, 1));
  const responseTime = Math.max(0, finiteOr(input.responseTimeMs, baseline));
  const latencyPenalty = clamp((responseTime / baseline - 1) * 0.1, 0, 0.15);
  const latencyFactor = 1 - latencyPenalty;
  const transferFactor = input.isTransfer ? 1.1 : 1;
  const quality = clamp(
    correctnessFactor * hintFactor * retryFactor * latencyFactor * transferFactor,
    0,
    1,
  );

  return Object.freeze({
    correctnessFactor,
    hintFactor,
    latencyFactor,
    quality,
    retryFactor,
    transferFactor,
  });
}

function validateParameters(parameters: ExerciseBktParameters): void {
  const values = [
    parameters.guessProbability,
    parameters.slipProbability,
    parameters.learnProbability,
  ];
  if (
    values.some((value) => !Number.isFinite(value)) ||
    parameters.guessProbability < 0 ||
    parameters.guessProbability >= 1 ||
    parameters.slipProbability < 0 ||
    parameters.slipProbability >= 1 ||
    parameters.learnProbability < 0 ||
    parameters.learnProbability > 1
  ) {
    throw new Error('BKT probabilities are outside their supported bounds.');
  }
}

export function clampMastery(value: number): number {
  return clamp(
    finiteOr(value, masteryBounds.minimum),
    masteryBounds.minimum,
    masteryBounds.maximum,
  );
}

export function calculateBktPosterior(
  priorMastery: number,
  correct: boolean,
  parameters: ExerciseBktParameters,
): number {
  validateParameters(parameters);
  const prior = clampMastery(priorMastery);
  const masteredLikelihood = correct ? 1 - parameters.slipProbability : parameters.slipProbability;
  const unmasteredLikelihood = correct
    ? parameters.guessProbability
    : 1 - parameters.guessProbability;
  const numerator = prior * masteredLikelihood;
  const denominator = numerator + (1 - prior) * unmasteredLikelihood;
  return denominator === 0 ? prior : numerator / denominator;
}

export type MasteryUpdate = Readonly<{
  algorithmVersion: typeof LEARNING_ALGORITHM_VERSION;
  mastery: number;
  posterior: number;
  prior: number;
  quality: number;
}>;

export function updateMastery(
  priorMastery: number,
  correct: boolean,
  quality: number,
  parameters: ExerciseBktParameters,
): MasteryUpdate {
  const prior = clampMastery(priorMastery);
  const normalizedQuality = clamp(finiteOr(quality, 0), 0, 1);
  const posterior = calculateBktPosterior(prior, correct, parameters);
  const learned = posterior + (1 - posterior) * parameters.learnProbability * normalizedQuality;
  return Object.freeze({
    algorithmVersion: LEARNING_ALGORITHM_VERSION,
    mastery: clampMastery(learned),
    posterior,
    prior,
    quality: normalizedQuality,
  });
}
