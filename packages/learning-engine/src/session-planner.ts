export const SESSION_PLANNER_ALGORITHM_VERSION = 'session-planner-v1' as const;

export const sessionCategoryTargets = Object.freeze({
  focusReview: 0.2,
  newContent: 0.25,
  overdueReview: 0.45,
  transferReading: 0.1,
});

export type SessionCandidateCategory =
  | 'overdue_review'
  | 'confusion_review'
  | 'weak_review'
  | 'new_content'
  | 'transfer_reading'
  | 'quick_success';

export type RecentPerformance = Readonly<{
  accuracy: number;
  fullHintRate: number;
  responseStable: boolean;
  transferSucceeded: boolean;
}>;

export type SessionCandidate = Readonly<{
  category: SessionCandidateCategory;
  confusionPenalty: number;
  curriculumNodeId: string;
  difficulty: number;
  estimatedSeconds: number;
  id: string;
  prerequisiteConceptIds: readonly string[];
  scores: Readonly<{
    confusion: number;
    curriculumNeed: number;
    interest: number;
    overdue: number;
    recentError: number;
    weakness: number;
  }>;
  supportBoost: number;
  targetConceptIds: readonly string[];
}>;

export type SessionPlannerInput = Readonly<{
  candidates: readonly SessionCandidate[];
  childAbility: number;
  eligibleCurriculumNodeIds: readonly string[];
  masteredConceptIds: readonly string[];
  recentPerformance: RecentPerformance;
  seed: string;
  targetMinutes: number;
}>;

export type PlannedSessionActivity = Readonly<{
  candidateId: string;
  category: SessionCandidateCategory;
  estimatedSeconds: number;
  isHighDifficulty: boolean;
  predictedSuccess: number;
  priority: number;
  targetConceptIds: readonly string[];
}>;

export type SessionPlan = Readonly<{
  activities: readonly PlannedSessionActivity[];
  algorithmVersion: typeof SESSION_PLANNER_ALGORITHM_VERSION;
  estimatedSeconds: number;
  newConceptIds: readonly string[];
  newConceptLimit: number;
  seed: string;
  status: 'planned' | 'insufficient_safe_content';
  targetSeconds: number;
}>;

type ScoredCandidate = Readonly<{
  candidate: SessionCandidate;
  isHighDifficulty: boolean;
  predictedSuccess: number;
  priority: number;
  tieBreak: number;
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

function normalizedSeconds(value: number): number {
  return Math.round(clamp(value, 10, 300));
}

export function calculateNewConceptLimit(performance: RecentPerformance): number {
  const accuracy = normalizedUnit(performance.accuracy);
  const fullHintRate = normalizedUnit(performance.fullHintRate);

  if (accuracy < 0.5 || fullHintRate > 0.5) {
    return 0;
  }
  if (accuracy < 0.65 || fullHintRate > 0.35) {
    return 1;
  }
  if (accuracy < 0.78) {
    return 2;
  }
  if (
    accuracy > 0.9 &&
    fullHintRate <= 0.15 &&
    performance.responseStable &&
    performance.transferSucceeded
  ) {
    return 4;
  }
  if (accuracy >= 0.78 && fullHintRate <= 0.25) {
    return 3;
  }
  return 2;
}

export function calculatePredictedSuccess(input: {
  childAbility: number;
  confusionPenalty: number;
  difficulty: number;
  supportBoost: number;
}): number {
  const logit =
    (normalizedUnit(input.childAbility) -
      normalizedUnit(input.difficulty) +
      normalizedUnit(input.supportBoost) -
      normalizedUnit(input.confusionPenalty)) *
    4;
  return 1 / (1 + Math.exp(-logit));
}

export function calculateCandidatePriority(scores: SessionCandidate['scores']): number {
  return (
    0.35 * normalizedUnit(scores.overdue) +
    0.25 * normalizedUnit(scores.weakness) +
    0.15 * normalizedUnit(scores.confusion) +
    0.1 * normalizedUnit(scores.recentError) +
    0.1 * normalizedUnit(scores.curriculumNeed) +
    0.05 * normalizedUnit(scores.interest)
  );
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function categoryRank(category: SessionCandidateCategory): number {
  switch (category) {
    case 'overdue_review':
      return 0;
    case 'confusion_review':
    case 'weak_review':
      return 1;
    case 'new_content':
      return 2;
    case 'transfer_reading':
      return 3;
    case 'quick_success':
      return 4;
  }
}

function compareScoredCandidates(left: ScoredCandidate, right: ScoredCandidate): number {
  return (
    categoryRank(left.candidate.category) - categoryRank(right.candidate.category) ||
    right.priority - left.priority ||
    left.tieBreak - right.tieBreak ||
    left.candidate.id.localeCompare(right.candidate.id)
  );
}

function scoreCandidates(
  input: SessionPlannerInput,
  eligibleCurriculumNodes: ReadonlySet<string>,
  masteredConcepts: ReadonlySet<string>,
): ScoredCandidate[] {
  const seenIds = new Set<string>();
  const eligible = input.candidates.filter((candidate) => {
    if (seenIds.has(candidate.id) || !eligibleCurriculumNodes.has(candidate.curriculumNodeId)) {
      return false;
    }
    seenIds.add(candidate.id);
    return candidate.prerequisiteConceptIds.every((conceptId) => masteredConcepts.has(conceptId));
  });

  return eligible
    .map((candidate) => {
      const predictedSuccess = calculatePredictedSuccess({
        childAbility: input.childAbility,
        confusionPenalty: candidate.confusionPenalty,
        difficulty: candidate.difficulty,
        supportBoost: candidate.supportBoost,
      });
      return Object.freeze({
        candidate,
        isHighDifficulty: predictedSuccess < 0.75,
        predictedSuccess,
        priority: calculateCandidatePriority(candidate.scores),
        tieBreak: stableHash(`${input.seed}:${candidate.id}`),
      });
    })
    .sort(compareScoredCandidates);
}

function calculateActivityBudget(
  targetSeconds: number,
  candidates: readonly ScoredCandidate[],
): number {
  if (candidates.length === 0) {
    return 0;
  }
  const averageSeconds =
    candidates.reduce(
      (total, item) => total + normalizedSeconds(item.candidate.estimatedSeconds),
      0,
    ) / candidates.length;
  return Math.max(1, Math.min(20, Math.floor(targetSeconds / averageSeconds)));
}

function poolForCategory(
  candidates: readonly ScoredCandidate[],
  category: 'overdue' | 'focus' | 'new' | 'transfer',
): ScoredCandidate[] {
  return candidates.filter((item) => {
    switch (category) {
      case 'overdue':
        return item.candidate.category === 'overdue_review';
      case 'focus':
        return (
          item.candidate.category === 'confusion_review' ||
          item.candidate.category === 'weak_review'
        );
      case 'new':
        return item.candidate.category === 'new_content';
      case 'transfer':
        return item.candidate.category === 'transfer_reading';
    }
  });
}

function plannedActivity(item: ScoredCandidate): PlannedSessionActivity {
  return Object.freeze({
    candidateId: item.candidate.id,
    category: item.candidate.category,
    estimatedSeconds: normalizedSeconds(item.candidate.estimatedSeconds),
    isHighDifficulty: item.isHighDifficulty,
    predictedSuccess: item.predictedSuccess,
    priority: item.priority,
    targetConceptIds: Object.freeze([...item.candidate.targetConceptIds]),
  });
}

export function buildSessionPlan(input: SessionPlannerInput): SessionPlan {
  const targetSeconds = Math.round(clamp(input.targetMinutes, 3, 20) * 60);
  const newConceptLimit = calculateNewConceptLimit(input.recentPerformance);
  const eligibleCurriculumNodes = new Set(input.eligibleCurriculumNodeIds);
  const masteredConcepts = new Set(input.masteredConceptIds);
  const scored = scoreCandidates(input, eligibleCurriculumNodes, masteredConcepts);
  const activityBudget = calculateActivityBudget(targetSeconds, scored);
  const maximumSeconds = targetSeconds * 1.1;
  const closingCandidate = [...scored]
    .filter(
      (item) =>
        item.candidate.category !== 'new_content' &&
        item.predictedSuccess >= 0.9 &&
        normalizedSeconds(item.candidate.estimatedSeconds) <= maximumSeconds,
    )
    .sort(
      (left, right) =>
        right.predictedSuccess - left.predictedSuccess ||
        right.priority - left.priority ||
        left.tieBreak - right.tieBreak ||
        left.candidate.id.localeCompare(right.candidate.id),
    )[0];

  if (!closingCandidate || activityBudget === 0) {
    return Object.freeze({
      activities: Object.freeze([]),
      algorithmVersion: SESSION_PLANNER_ALGORITHM_VERSION,
      estimatedSeconds: 0,
      newConceptIds: Object.freeze([]),
      newConceptLimit,
      seed: input.seed,
      status: 'insufficient_safe_content',
      targetSeconds,
    });
  }

  const remainingSlots = Math.max(0, activityBudget - 1);
  const desired = {
    focus: Math.round(remainingSlots * sessionCategoryTargets.focusReview),
    new: Math.min(newConceptLimit, Math.round(remainingSlots * sessionCategoryTargets.newContent)),
    overdue: Math.ceil(remainingSlots * sessionCategoryTargets.overdueReview),
    transfer: Math.round(remainingSlots * sessionCategoryTargets.transferReading),
  };
  const selected: ScoredCandidate[] = [];
  const selectedIds = new Set([closingCandidate.candidate.id]);
  const newConceptIds = new Set<string>();
  let selectedSeconds = normalizedSeconds(closingCandidate.candidate.estimatedSeconds);

  function canSelect(item: ScoredCandidate): boolean {
    if (selectedIds.has(item.candidate.id)) {
      return false;
    }
    const seconds = normalizedSeconds(item.candidate.estimatedSeconds);
    if (selectedSeconds + seconds > maximumSeconds) {
      return false;
    }
    if (item.candidate.category === 'new_content') {
      const additions = item.candidate.targetConceptIds.filter(
        (conceptId) => !masteredConcepts.has(conceptId) && !newConceptIds.has(conceptId),
      );
      if (newConceptIds.size + additions.length > newConceptLimit) {
        return false;
      }
    }
    return true;
  }

  function select(item: ScoredCandidate): void {
    selected.push(item);
    selectedIds.add(item.candidate.id);
    selectedSeconds += normalizedSeconds(item.candidate.estimatedSeconds);
    if (item.candidate.category === 'new_content') {
      for (const conceptId of item.candidate.targetConceptIds) {
        if (!masteredConcepts.has(conceptId)) {
          newConceptIds.add(conceptId);
        }
      }
    }
  }

  function take(pool: readonly ScoredCandidate[], count: number): void {
    for (const item of pool) {
      if (selected.length >= remainingSlots || count <= 0) {
        return;
      }
      if (canSelect(item)) {
        select(item);
        count -= 1;
      }
    }
  }

  take(poolForCategory(scored, 'overdue'), desired.overdue);
  take(poolForCategory(scored, 'focus'), desired.focus);
  take(poolForCategory(scored, 'new'), desired.new);
  take(poolForCategory(scored, 'transfer'), desired.transfer);
  take(scored, remainingSlots - selected.length);

  const ordered: ScoredCandidate[] = [];
  const remaining = [...selected].sort(compareScoredCandidates);
  let consecutiveHighDifficulty = 0;
  while (remaining.length > 0) {
    const nextIndex =
      consecutiveHighDifficulty >= 2 ? remaining.findIndex((item) => !item.isHighDifficulty) : 0;
    if (nextIndex < 0) {
      break;
    }
    const [next] = remaining.splice(nextIndex, 1);
    if (!next) {
      break;
    }
    ordered.push(next);
    consecutiveHighDifficulty = next.isHighDifficulty ? consecutiveHighDifficulty + 1 : 0;
  }
  ordered.push(closingCandidate);

  const activities = Object.freeze(ordered.map(plannedActivity));
  const plannedNewConceptIds = Object.freeze(
    activities
      .filter((activity) => activity.category === 'new_content')
      .flatMap((activity) => activity.targetConceptIds)
      .filter(
        (conceptId, index, all) =>
          !masteredConcepts.has(conceptId) && all.indexOf(conceptId) === index,
      ),
  );

  return Object.freeze({
    activities,
    algorithmVersion: SESSION_PLANNER_ALGORITHM_VERSION,
    estimatedSeconds: activities.reduce((total, activity) => total + activity.estimatedSeconds, 0),
    newConceptIds: plannedNewConceptIds,
    newConceptLimit,
    seed: input.seed,
    status: 'planned',
    targetSeconds,
  });
}
