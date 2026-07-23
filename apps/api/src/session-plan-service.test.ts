import type { SessionPlanRequest } from '@hanziquest/contracts';
import type { HanziPlanningCandidate } from '@hanziquest/learning-engine';
import { describe, expect, it } from 'vitest';

import {
  buildAuthoritativeSessionPlan,
  type AuthoritativePlanningState,
} from './session-plan-service.js';

const lessonId = '30000000-0000-4000-8000-000000000001';
const conceptId = '30000000-0000-4000-8000-000000000002';
const clientSessionId = '30000000-0000-4000-8000-000000000003';
const request = {
  schemaVersion: 'session-plan-request-v1',
  clientSessionId,
  idempotencyKey: `session-plan:${clientSessionId}`,
  targetMinutes: 10,
} satisfies SessionPlanRequest;
const closeCandidate = {
  category: 'quick_success',
  confusionPenalty: 0,
  curriculumNodeId: lessonId,
  difficulty: 0.05,
  estimatedSeconds: 60,
  id: 'hanzi:confidence-close',
  learningDomain: 'hanzi',
  pinyinSupportEligible: true,
  prerequisiteConceptIds: [],
  scores: {
    confusion: 0,
    curriculumNeed: 0,
    interest: 0.5,
    overdue: 0,
    recentError: 0,
    weakness: 0,
  },
  supportBoost: 0.35,
  targetConceptIds: [conceptId],
} satisfies HanziPlanningCandidate;
const state = {
  abilityEstimate: 0.7,
  curriculumVersionId: '30000000-0000-4000-8000-000000000004',
  eligibleCurriculumNodeIds: [lessonId, 'pinyin-content-v1'],
  hanziCandidates: [closeCandidate],
  lessonId,
  masteredConceptIds: [conceptId],
  pinyinSupportPreference: 'adaptive',
  pinyinSupportSignals: {
    consecutiveErrors: 0,
    consecutiveIndependentSuccesses: 2,
    fullAnswerRevealRate: 0,
    recentIndependentAccuracy: 0.8,
  },
  recentPerformance: {
    accuracy: 0.8,
    fullHintRate: 0,
    responseStable: true,
    transferSucceeded: false,
  },
} satisfies AuthoritativePlanningState;

describe('authoritative session-plan adapter', () => {
  it('calls the deterministic Pinyin/Hanzi planner and emits the versioned snapshot', () => {
    const plan = buildAuthoritativeSessionPlan(request, state);
    expect(plan.schemaVersion).toBe('session-plan-snapshot-v1');
    expect(plan.algorithmVersion).toBe('session-planner-v2');
    expect(plan.integrationAlgorithmVersion).toBe('pinyin-session-planner-v1');
    expect(plan.seed).toBe(clientSessionId);
    expect(plan.activities.at(-1)?.predictedSuccess).toBeGreaterThanOrEqual(0.9);
    expect(plan.newConceptIds.length).toBeLessThanOrEqual(4);
  });

  it('is reproducible for a fixed client session ID and server state', () => {
    expect(buildAuthoritativeSessionPlan(request, state)).toEqual(
      buildAuthoritativeSessionPlan(request, state),
    );
  });
});
