import {
  buildSessionPlan,
  type PlannedSessionActivity,
  type SessionCandidate,
  type SessionPlan,
  type SessionPlannerInput,
} from './session-planner.ts';

export const PINYIN_SESSION_PLANNER_ALGORITHM_VERSION = 'pinyin-session-planner-v1' as const;
export const DEFAULT_PINYIN_TARGET_RATIO = 0.3;

export type PinyinSkillType = 'initial' | 'final' | 'syllable' | 'tone';
export type PinyinCandidateKind = 'review' | 'new' | 'transfer';
export type PinyinSupportPreference = 'always' | 'adaptive' | 'tap_to_reveal' | 'hidden';
export type PinyinPresentationSupport = 'visible' | 'tap_to_reveal' | 'hidden';
export type PinyinSupportReason =
  | 'preference_always'
  | 'preference_tap_to_reveal'
  | 'preference_hidden'
  | 'frustration_recovery'
  | 'support_not_yet_faded'
  | 'partial_fade'
  | 'sustained_independent_success';

export type PinyinSupportSignals = Readonly<{
  consecutiveErrors: number;
  consecutiveIndependentSuccesses: number;
  fullAnswerRevealRate: number;
  recentIndependentAccuracy: number;
}>;

export type PlannedPinyinSupport = Readonly<{
  allowReveal: boolean;
  fadeStage: 0 | 1 | 2;
  initialEvidenceSupport: 'none' | 'pinyin_visible';
  presentation: PinyinPresentationSupport;
  reason: PinyinSupportReason;
}>;

export type PinyinPlanningCandidate = Readonly<{
  confusion: number;
  confusionPenalty: number;
  curriculumNeed: number;
  curriculumNodeId: string;
  difficulty: number;
  duePriority: number;
  estimatedSeconds: number;
  id: string;
  interest: number;
  kind: PinyinCandidateKind;
  prerequisiteConceptIds: readonly string[];
  recentError: number;
  skillType: PinyinSkillType;
  supportBoost: number;
  targetConceptIds: readonly string[];
  weakness: number;
}>;

export type HanziPlanningCandidate = SessionCandidate &
  Readonly<{
    learningDomain: 'hanzi';
    pinyinSupportEligible?: boolean;
  }>;

export type PinyinIntegratedPlannerInput = Omit<
  SessionPlannerInput,
  'candidates' | 'pinyinTargetRatio'
> &
  Readonly<{
    hanziCandidates: readonly HanziPlanningCandidate[];
    pinyinCandidates: readonly PinyinPlanningCandidate[];
    pinyinSupportPreference: PinyinSupportPreference;
    pinyinSupportSignals: PinyinSupportSignals;
    pinyinTargetRatio?: number;
  }>;

export type PinyinIntegratedPlannedActivity = PlannedSessionActivity &
  Readonly<{
    pinyinSkillType: PinyinSkillType | null;
    pinyinSupport: PlannedPinyinSupport | null;
  }>;

export type PinyinIntegratedSessionPlan = Omit<SessionPlan, 'activities'> &
  Readonly<{
    activities: readonly PinyinIntegratedPlannedActivity[];
    domainMix: Readonly<{
      hanziActivities: number;
      pinyinActivities: number;
      targetPinyinRatio: number;
    }>;
    integrationAlgorithmVersion: typeof PINYIN_SESSION_PLANNER_ALGORITHM_VERSION;
    supportDecision: PlannedPinyinSupport;
  }>;

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, finiteOr(value, minimum)));
}

function normalizedUnit(value: number): number {
  return clamp(value, 0, 1);
}

function normalizedCount(value: number): number {
  return Math.max(0, Math.floor(finiteOr(value, 0)));
}

function isFrustrated(signals: PinyinSupportSignals): boolean {
  return (
    normalizedCount(signals.consecutiveErrors) >= 2 ||
    normalizedUnit(signals.recentIndependentAccuracy) < 0.55 ||
    normalizedUnit(signals.fullAnswerRevealRate) > 0.4
  );
}

export function planPinyinSupport(
  preference: PinyinSupportPreference,
  signals: PinyinSupportSignals,
): PlannedPinyinSupport {
  if (preference === 'always') {
    return Object.freeze({
      allowReveal: false,
      fadeStage: 0,
      initialEvidenceSupport: 'pinyin_visible',
      presentation: 'visible',
      reason: 'preference_always',
    });
  }
  if (preference === 'tap_to_reveal') {
    return Object.freeze({
      allowReveal: true,
      fadeStage: 1,
      initialEvidenceSupport: 'none',
      presentation: 'tap_to_reveal',
      reason: 'preference_tap_to_reveal',
    });
  }
  if (preference === 'hidden') {
    return Object.freeze({
      allowReveal: false,
      fadeStage: 2,
      initialEvidenceSupport: 'none',
      presentation: 'hidden',
      reason: 'preference_hidden',
    });
  }
  if (isFrustrated(signals)) {
    return Object.freeze({
      allowReveal: false,
      fadeStage: 0,
      initialEvidenceSupport: 'pinyin_visible',
      presentation: 'visible',
      reason: 'frustration_recovery',
    });
  }

  const accuracy = normalizedUnit(signals.recentIndependentAccuracy);
  const successes = normalizedCount(signals.consecutiveIndependentSuccesses);
  const revealRate = normalizedUnit(signals.fullAnswerRevealRate);
  if (accuracy >= 0.9 && successes >= 5 && revealRate <= 0.1) {
    return Object.freeze({
      allowReveal: false,
      fadeStage: 2,
      initialEvidenceSupport: 'none',
      presentation: 'hidden',
      reason: 'sustained_independent_success',
    });
  }
  if (accuracy >= 0.75 && successes >= 2) {
    return Object.freeze({
      allowReveal: true,
      fadeStage: 1,
      initialEvidenceSupport: 'none',
      presentation: 'tap_to_reveal',
      reason: 'partial_fade',
    });
  }
  return Object.freeze({
    allowReveal: false,
    fadeStage: 0,
    initialEvidenceSupport: 'pinyin_visible',
    presentation: 'visible',
    reason: 'support_not_yet_faded',
  });
}

export function resolvePinyinTargetRatio(value: number | undefined): number {
  const resolved =
    value === undefined || !Number.isFinite(value) ? DEFAULT_PINYIN_TARGET_RATIO : value;
  return clamp(resolved, 0.2, 0.4);
}

export function adaptPinyinCandidate(candidate: PinyinPlanningCandidate): SessionCandidate {
  const category =
    candidate.kind === 'new'
      ? 'new_content'
      : candidate.kind === 'transfer'
        ? 'transfer_reading'
        : candidate.duePriority > 0
          ? 'overdue_review'
          : 'weak_review';
  return Object.freeze({
    category,
    confusionPenalty: candidate.confusionPenalty,
    curriculumNodeId: candidate.curriculumNodeId,
    difficulty: candidate.difficulty,
    estimatedSeconds: candidate.estimatedSeconds,
    id: candidate.id,
    learningDomain: 'pinyin',
    prerequisiteConceptIds: Object.freeze([...candidate.prerequisiteConceptIds]),
    scores: Object.freeze({
      confusion: candidate.confusion,
      curriculumNeed: candidate.curriculumNeed,
      interest: candidate.interest,
      overdue: candidate.duePriority,
      recentError: candidate.recentError,
      weakness: candidate.weakness,
    }),
    supportBoost: candidate.supportBoost,
    targetConceptIds: Object.freeze([...candidate.targetConceptIds]),
  });
}

export function buildPinyinIntegratedSessionPlan(
  input: PinyinIntegratedPlannerInput,
): PinyinIntegratedSessionPlan {
  const supportDecision = planPinyinSupport(
    input.pinyinSupportPreference,
    input.pinyinSupportSignals,
  );
  const recoveryMode = isFrustrated(input.pinyinSupportSignals);
  const eligiblePinyinCandidates = recoveryMode
    ? input.pinyinCandidates.filter((candidate) => candidate.kind === 'review')
    : input.pinyinCandidates;
  const adaptedPinyinCandidates = eligiblePinyinCandidates.map(adaptPinyinCandidate);
  const pinyinSkillByCandidateId = new Map(
    eligiblePinyinCandidates.map((candidate) => [candidate.id, candidate.skillType]),
  );
  const supportEligibleCandidateIds = new Set(
    input.hanziCandidates
      .filter((candidate) => candidate.pinyinSupportEligible)
      .map((candidate) => candidate.id),
  );
  const targetPinyinRatio = resolvePinyinTargetRatio(input.pinyinTargetRatio);
  const corePlan = buildSessionPlan({
    abilityEstimate: input.abilityEstimate,
    candidates: [...input.hanziCandidates, ...adaptedPinyinCandidates],
    eligibleCurriculumNodeIds: input.eligibleCurriculumNodeIds,
    masteredConceptIds: input.masteredConceptIds,
    pinyinTargetRatio: targetPinyinRatio,
    recentPerformance: input.recentPerformance,
    seed: input.seed,
    targetMinutes: input.targetMinutes,
  });

  const activities = Object.freeze(
    corePlan.activities.map((activity) =>
      Object.freeze({
        ...activity,
        pinyinSkillType: pinyinSkillByCandidateId.get(activity.candidateId) ?? null,
        pinyinSupport: supportEligibleCandidateIds.has(activity.candidateId)
          ? supportDecision
          : null,
      }),
    ),
  );
  const pinyinActivities = activities.filter(
    (activity) => activity.learningDomain === 'pinyin',
  ).length;

  return Object.freeze({
    ...corePlan,
    activities,
    domainMix: Object.freeze({
      hanziActivities: activities.length - pinyinActivities,
      pinyinActivities,
      targetPinyinRatio,
    }),
    integrationAlgorithmVersion: PINYIN_SESSION_PLANNER_ALGORITHM_VERSION,
    supportDecision,
  });
}
