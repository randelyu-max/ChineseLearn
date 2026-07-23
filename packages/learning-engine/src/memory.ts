import { clampMastery } from './bkt.ts';

export const STABILITY_ALGORITHM_VERSION = 'stability-v1' as const;
export const initialStabilityDays = 0.7;
export const stabilityBounds = Object.freeze({ maximum: 120, minimum: 0.5 });
export const safeReviewIntervalsDays = Object.freeze([1, 3, 7, 14, 30, 60] as const);
const millisecondsPerDay = 86_400_000;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeStability(stabilityDays: number): number {
  return clamp(
    finiteOr(stabilityDays, initialStabilityDays),
    stabilityBounds.minimum,
    stabilityBounds.maximum,
  );
}

export function calculateRetention(
  lastSuccessAtMs: number,
  nowMs: number,
  stabilityDays: number,
): number {
  const elapsedDays =
    Math.max(0, finiteOr(nowMs, 0) - finiteOr(lastSuccessAtMs, nowMs)) / millisecondsPerDay;
  return Math.exp(-elapsedDays / normalizeStability(stabilityDays));
}

export function calculateEffectiveMastery(
  mastery: number,
  lastSuccessAtMs: number,
  nowMs: number,
  stabilityDays: number,
): number {
  return clampMastery(mastery) * calculateRetention(lastSuccessAtMs, nowMs, stabilityDays);
}

export function stabilityAfterRetrievalSuccess(
  stabilityDays: number,
  retrievalDifficulty: number,
  quality: number,
): number {
  const difficulty = clamp(finiteOr(retrievalDifficulty, 0), 0, 1);
  const normalizedQuality = clamp(finiteOr(quality, 0), 0, 1);
  return Math.min(
    stabilityBounds.maximum,
    normalizeStability(stabilityDays) * (1.35 + 0.45 * difficulty * normalizedQuality),
  );
}

export function stabilityAfterLapse(stabilityDays: number): number {
  return Math.max(stabilityBounds.minimum, normalizeStability(stabilityDays) * 0.35);
}

export type ReviewReason =
  'new_item' | 'retrieval_success' | 'lapse_or_full_hint' | 'low_effective_mastery';

export type ReviewSchedule = Readonly<{
  algorithmVersion: typeof STABILITY_ALGORITHM_VERSION;
  intervalDays: (typeof safeReviewIntervalsDays)[number];
  nextReviewAtMs: number;
  rawIntervalDays: number;
  reason: ReviewReason;
  targetRetention: number;
}>;

export function scheduleNextReview(input: {
  nowMs: number;
  reason: ReviewReason;
  stabilityDays: number;
  targetRetention?: number;
}): ReviewSchedule {
  const nowMs = finiteOr(input.nowMs, 0);
  const targetRetention = clamp(finiteOr(input.targetRetention ?? 0.85, 0.85), 0.5, 0.95);
  const rawIntervalDays = -normalizeStability(input.stabilityDays) * Math.log(targetRetention);
  const eligible = safeReviewIntervalsDays.filter((interval) => interval <= rawIntervalDays);
  const intervalDays = eligible.at(-1) ?? safeReviewIntervalsDays[0];

  return Object.freeze({
    algorithmVersion: STABILITY_ALGORITHM_VERSION,
    intervalDays,
    nextReviewAtMs: nowMs + intervalDays * millisecondsPerDay,
    rawIntervalDays,
    reason: input.reason,
    targetRetention,
  });
}
