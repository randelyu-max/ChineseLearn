import { describe, expect, it } from 'vitest';

import {
  buildSessionPlan,
  calculateNewConceptLimit,
  calculatePredictedSuccess,
  type SessionCandidate,
  type SessionPlannerInput,
} from './session-planner';

function candidate(
  id: string,
  category: SessionCandidate['category'],
  overrides: Partial<SessionCandidate> = {},
): SessionCandidate {
  return {
    category,
    confusionPenalty: 0,
    curriculumNodeId: 'current',
    difficulty: category === 'quick_success' ? 0.1 : 0.45,
    estimatedSeconds: 60,
    id,
    prerequisiteConceptIds: [],
    scores: {
      confusion: category === 'confusion_review' ? 1 : 0,
      curriculumNeed: category === 'new_content' ? 1 : 0,
      interest: 0,
      overdue: category === 'overdue_review' ? 1 : 0,
      recentError: 0,
      weakness: category === 'weak_review' ? 1 : 0,
    },
    supportBoost: category === 'quick_success' ? 0.3 : 0.1,
    targetConceptIds: [`concept-${id}`],
    ...overrides,
  };
}

function plannerInput(candidates: readonly SessionCandidate[]): SessionPlannerInput {
  return {
    candidates,
    childAbility: 0.8,
    eligibleCurriculumNodeIds: ['current'],
    masteredConceptIds: [],
    recentPerformance: {
      accuracy: 0.85,
      fullHintRate: 0.1,
      responseStable: true,
      transferSucceeded: true,
    },
    seed: 'child-session-001',
    targetMinutes: 8,
  };
}

describe('new concept pacing', () => {
  it.each([
    [{ accuracy: 0.4, fullHintRate: 0.1, responseStable: false, transferSucceeded: false }, 0],
    [{ accuracy: 0.6, fullHintRate: 0.2, responseStable: false, transferSucceeded: false }, 1],
    [{ accuracy: 0.7, fullHintRate: 0.2, responseStable: false, transferSucceeded: false }, 2],
    [{ accuracy: 0.85, fullHintRate: 0.1, responseStable: true, transferSucceeded: false }, 3],
    [{ accuracy: 0.95, fullHintRate: 0.1, responseStable: true, transferSucceeded: true }, 4],
  ])('maps rolling performance to the bounded new-concept limit', (performance, expected) => {
    expect(calculateNewConceptLimit(performance)).toBe(expected);
  });
});

describe('session planning', () => {
  it('prioritizes due review while retaining focus, new, transfer, and a safe close', () => {
    const candidates = [
      candidate('due-1', 'overdue_review'),
      candidate('due-2', 'overdue_review'),
      candidate('focus-1', 'confusion_review'),
      candidate('new-1', 'new_content'),
      candidate('transfer-1', 'transfer_reading'),
      candidate('close', 'quick_success'),
    ];
    const plan = buildSessionPlan(plannerInput(candidates));

    expect(plan.status).toBe('planned');
    expect(plan.activities[0]?.category).toBe('overdue_review');
    expect(plan.activities.map((activity) => activity.category)).toEqual(
      expect.arrayContaining([
        'overdue_review',
        'confusion_review',
        'new_content',
        'transfer_reading',
        'quick_success',
      ]),
    );
    expect(plan.activities.at(-1)?.predictedSuccess).toBeGreaterThanOrEqual(0.9);
  });

  it('never schedules a concept beyond curriculum position or before prerequisites', () => {
    const candidates = [
      candidate('eligible', 'overdue_review', {
        prerequisiteConceptIds: ['known'],
      }),
      candidate('locked-prerequisite', 'new_content', {
        prerequisiteConceptIds: ['unknown'],
      }),
      candidate('future-node', 'new_content', {
        curriculumNodeId: 'future',
      }),
      candidate('close', 'quick_success'),
    ];
    const input = { ...plannerInput(candidates), masteredConceptIds: ['known'] };
    const ids = buildSessionPlan(input).activities.map((activity) => activity.candidateId);

    expect(ids).toContain('eligible');
    expect(ids).not.toContain('locked-prerequisite');
    expect(ids).not.toContain('future-node');
  });

  it('respects the rolling new-concept limit across multi-target activities', () => {
    const candidates = [
      candidate('new-two', 'new_content', {
        targetConceptIds: ['new-a', 'new-b'],
      }),
      candidate('new-more', 'new_content', {
        targetConceptIds: ['new-c', 'new-d'],
      }),
      candidate('due', 'overdue_review'),
      candidate('close', 'quick_success'),
    ];
    const input = {
      ...plannerInput(candidates),
      recentPerformance: {
        accuracy: 0.7,
        fullHintRate: 0.2,
        responseStable: false,
        transferSucceeded: false,
      },
    };
    const plan = buildSessionPlan(input);

    expect(plan.newConceptLimit).toBe(2);
    expect(plan.newConceptIds).toHaveLength(2);
  });

  it('prevents three consecutive high-difficulty activities', () => {
    const hard = { difficulty: 1, supportBoost: 0 };
    const candidates = [
      candidate('hard-1', 'overdue_review', hard),
      candidate('hard-2', 'overdue_review', hard),
      candidate('hard-3', 'overdue_review', hard),
      candidate('reset', 'weak_review', { difficulty: 0.2, supportBoost: 0.2 }),
      candidate('close', 'quick_success'),
    ];
    const activities = buildSessionPlan(plannerInput(candidates)).activities;

    for (let index = 0; index < activities.length - 2; index += 1) {
      expect(
        activities.slice(index, index + 3).every((activity) => activity.isHighDifficulty),
      ).toBe(false);
    }
  });

  it('returns an empty safe result when no high-success closing activity exists', () => {
    const input = {
      ...plannerInput([candidate('hard', 'overdue_review', { difficulty: 1, supportBoost: 0 })]),
      childAbility: 0.2,
    };
    const plan = buildSessionPlan(input);

    expect(plan.status).toBe('insufficient_safe_content');
    expect(plan.activities).toEqual([]);
  });

  it('does not use new content as the safe closer or exceed the new-concept limit', () => {
    const input = {
      ...plannerInput([
        candidate('easy-new', 'new_content', { difficulty: 0, supportBoost: 1 }),
        candidate('hard-review', 'overdue_review', { difficulty: 1, supportBoost: 0 }),
      ]),
      childAbility: 0.2,
      recentPerformance: {
        accuracy: 0.4,
        fullHintRate: 0.6,
        responseStable: false,
        transferSucceeded: false,
      },
    };
    const plan = buildSessionPlan(input);

    expect(plan.newConceptLimit).toBe(0);
    expect(plan.status).toBe('insufficient_safe_content');
    expect(plan.newConceptIds).toEqual([]);
  });

  it('keeps estimated duration within the target tolerance', () => {
    const candidates = [
      candidate('long-due', 'overdue_review', { estimatedSeconds: 300 }),
      candidate('close', 'quick_success', { estimatedSeconds: 120 }),
    ];
    const plan = buildSessionPlan({ ...plannerInput(candidates), targetMinutes: 3 });

    expect(plan.estimatedSeconds).toBeLessThanOrEqual(plan.targetSeconds * 1.1);
    expect(plan.activities.map((activity) => activity.candidateId)).not.toContain('long-due');
  });

  it('is reproducible for a fixed seed and does not mutate input', () => {
    const candidates = [
      candidate('same-a', 'overdue_review'),
      candidate('same-b', 'overdue_review'),
      candidate('same-c', 'weak_review'),
      candidate('close', 'quick_success'),
    ];
    const input = Object.freeze({
      ...plannerInput(Object.freeze(candidates)),
      seed: 'fixed-seed',
    });
    const before = JSON.stringify(input);

    expect(buildSessionPlan(input)).toEqual(buildSessionPlan(input));
    expect(JSON.stringify(input)).toBe(before);
  });

  it('keeps predicted success finite and bounded for invalid numeric inputs', () => {
    const values = [-10, 0, 0.5, 1, 10, Number.NaN];
    for (const childAbility of values) {
      for (const difficulty of values) {
        const predicted = calculatePredictedSuccess({
          childAbility,
          confusionPenalty: Number.NaN,
          difficulty,
          supportBoost: Number.POSITIVE_INFINITY,
        });
        expect(Number.isFinite(predicted)).toBe(true);
        expect(predicted).toBeGreaterThanOrEqual(0);
        expect(predicted).toBeLessThanOrEqual(1);
      }
    }
  });
});
