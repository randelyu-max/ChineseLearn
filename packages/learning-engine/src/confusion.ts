export const CONFUSION_ALGORITHM_VERSION = 'confusion-v1' as const;

export const confusionRecheckIntervalsDays = Object.freeze([1, 3, 7] as const);

export type ConfusionRiskParameters = Readonly<{
  activationThreshold: number;
  minimumConfusionCount: number;
  minimumOpportunityCount: number;
}>;

export const defaultConfusionRiskParameters = Object.freeze({
  activationThreshold: 0.35,
  minimumConfusionCount: 3,
  minimumOpportunityCount: 5,
} satisfies ConfusionRiskParameters);

export type ConfusionPair = Readonly<{
  leftConceptId: string;
  pairKey: string;
  rightConceptId: string;
}>;

export type ConfusionStats = Readonly<{
  leftAsRightCount: number;
  leftShownCount: number;
  pair: ConfusionPair;
  rightAsLeftCount: number;
  rightShownCount: number;
}>;

export type ConfusionDirection = 'left_as_right' | 'right_as_left';

export type DirectionalConfusionRisk = Readonly<{
  conditionalProbability: number;
  confusionCount: number;
  direction: ConfusionDirection;
  isActive: boolean;
  opportunityCount: number;
  selectedConceptId: string;
  shownConceptId: string;
}>;

export type ConfusionPracticeIntensity = 'none' | 'light' | 'standard' | 'intensive';

export type ConfusionRiskEvaluation = Readonly<{
  algorithmVersion: typeof CONFUSION_ALGORITHM_VERSION;
  directions: Readonly<{
    leftAsRight: DirectionalConfusionRisk;
    rightAsLeft: DirectionalConfusionRisk;
  }>;
  isActive: boolean;
  pair: ConfusionPair;
  practiceIntensity: ConfusionPracticeIntensity;
  recommendedPracticeActivities: 0 | 1 | 2 | 3;
  recheckIntervalsDays: readonly (typeof confusionRecheckIntervalsDays)[number][];
  riskScore: number;
}>;

function normalizedConceptId(conceptId: string): string {
  const normalized = conceptId.trim();
  if (normalized.length === 0) {
    throw new Error('Confusion-pair concept IDs must not be empty.');
  }
  return normalized;
}

function buildPairKey(leftConceptId: string, rightConceptId: string): string {
  return `${leftConceptId.length}:${leftConceptId}|${rightConceptId.length}:${rightConceptId}`;
}

export function createConfusionPair(
  firstConceptId: string,
  secondConceptId: string,
): ConfusionPair {
  const first = normalizedConceptId(firstConceptId);
  const second = normalizedConceptId(secondConceptId);
  if (first === second) {
    throw new Error('A confusion pair requires two different concepts.');
  }

  const [leftConceptId, rightConceptId] = first < second ? [first, second] : [second, first];
  return Object.freeze({
    leftConceptId,
    pairKey: buildPairKey(leftConceptId, rightConceptId),
    rightConceptId,
  });
}

export function createEmptyConfusionStats(pair: ConfusionPair): ConfusionStats {
  return Object.freeze({
    leftAsRightCount: 0,
    leftShownCount: 0,
    pair,
    rightAsLeftCount: 0,
    rightShownCount: 0,
  });
}

export function recordConfusionOpportunity(
  stats: ConfusionStats,
  input: Readonly<{
    selectedConceptId: string;
    shownConceptId: string;
  }>,
): ConfusionStats {
  const shownConceptId = normalizedConceptId(input.shownConceptId);
  const selectedConceptId = normalizedConceptId(input.selectedConceptId);
  const { leftConceptId, rightConceptId } = stats.pair;

  if (shownConceptId === leftConceptId) {
    return Object.freeze({
      ...stats,
      leftAsRightCount: stats.leftAsRightCount + (selectedConceptId === rightConceptId ? 1 : 0),
      leftShownCount: stats.leftShownCount + 1,
    });
  }

  if (shownConceptId === rightConceptId) {
    return Object.freeze({
      ...stats,
      rightAsLeftCount: stats.rightAsLeftCount + (selectedConceptId === leftConceptId ? 1 : 0),
      rightShownCount: stats.rightShownCount + 1,
    });
  }

  throw new Error('The shown concept does not belong to the confusion pair.');
}

function normalizedCount(value: number): number {
  return Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0));
}

function validateParameters(parameters: ConfusionRiskParameters): void {
  if (
    !Number.isFinite(parameters.activationThreshold) ||
    parameters.activationThreshold <= 0 ||
    parameters.activationThreshold > 1 ||
    !Number.isInteger(parameters.minimumConfusionCount) ||
    parameters.minimumConfusionCount < 1 ||
    !Number.isInteger(parameters.minimumOpportunityCount) ||
    parameters.minimumOpportunityCount < 1
  ) {
    throw new Error('Confusion-risk parameters are outside their supported bounds.');
  }
}

function evaluateDirection(input: {
  confusionCount: number;
  direction: ConfusionDirection;
  opportunityCount: number;
  parameters: ConfusionRiskParameters;
  selectedConceptId: string;
  shownConceptId: string;
}): DirectionalConfusionRisk {
  const opportunityCount = normalizedCount(input.opportunityCount);
  const confusionCount = Math.min(opportunityCount, normalizedCount(input.confusionCount));
  const conditionalProbability = opportunityCount === 0 ? 0 : confusionCount / opportunityCount;
  const isActive =
    opportunityCount >= input.parameters.minimumOpportunityCount &&
    confusionCount >= input.parameters.minimumConfusionCount &&
    conditionalProbability >= input.parameters.activationThreshold;

  return Object.freeze({
    conditionalProbability,
    confusionCount,
    direction: input.direction,
    isActive,
    opportunityCount,
    selectedConceptId: input.selectedConceptId,
    shownConceptId: input.shownConceptId,
  });
}

function practiceRecommendation(
  isActive: boolean,
  riskScore: number,
): Readonly<{
  practiceIntensity: ConfusionPracticeIntensity;
  recommendedPracticeActivities: 0 | 1 | 2 | 3;
}> {
  if (!isActive) {
    return Object.freeze({ practiceIntensity: 'none', recommendedPracticeActivities: 0 });
  }
  if (riskScore >= 0.75) {
    return Object.freeze({ practiceIntensity: 'intensive', recommendedPracticeActivities: 3 });
  }
  if (riskScore >= 0.5) {
    return Object.freeze({ practiceIntensity: 'standard', recommendedPracticeActivities: 2 });
  }
  return Object.freeze({ practiceIntensity: 'light', recommendedPracticeActivities: 1 });
}

export function evaluateConfusionRisk(
  stats: ConfusionStats,
  parameters: ConfusionRiskParameters = defaultConfusionRiskParameters,
): ConfusionRiskEvaluation {
  validateParameters(parameters);
  const leftAsRight = evaluateDirection({
    confusionCount: stats.leftAsRightCount,
    direction: 'left_as_right',
    opportunityCount: stats.leftShownCount,
    parameters,
    selectedConceptId: stats.pair.rightConceptId,
    shownConceptId: stats.pair.leftConceptId,
  });
  const rightAsLeft = evaluateDirection({
    confusionCount: stats.rightAsLeftCount,
    direction: 'right_as_left',
    opportunityCount: stats.rightShownCount,
    parameters,
    selectedConceptId: stats.pair.leftConceptId,
    shownConceptId: stats.pair.rightConceptId,
  });
  const isActive = leftAsRight.isActive || rightAsLeft.isActive;
  const riskScore = Math.max(
    leftAsRight.isActive ? leftAsRight.conditionalProbability : 0,
    rightAsLeft.isActive ? rightAsLeft.conditionalProbability : 0,
  );
  const recommendation = practiceRecommendation(isActive, riskScore);

  return Object.freeze({
    algorithmVersion: CONFUSION_ALGORITHM_VERSION,
    directions: Object.freeze({ leftAsRight, rightAsLeft }),
    isActive,
    pair: stats.pair,
    practiceIntensity: recommendation.practiceIntensity,
    recommendedPracticeActivities: recommendation.recommendedPracticeActivities,
    recheckIntervalsDays: isActive ? confusionRecheckIntervalsDays : Object.freeze([]),
    riskScore,
  });
}
