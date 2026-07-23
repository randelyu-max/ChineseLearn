import { describe, expect, it } from 'vitest';

import {
  buildPinyinIntegratedSessionPlan,
  planPinyinSupport,
  resolvePinyinTargetRatio,
  type HanziPlanningCandidate,
  type PinyinIntegratedPlannerInput,
  type PinyinPlanningCandidate,
  type PinyinSupportSignals,
} from './pinyin-session-planner.ts';

function hanziCandidate(
  id: string,
  category: HanziPlanningCandidate['category'],
  overrides: Partial<HanziPlanningCandidate> = {},
): HanziPlanningCandidate {
  return {
    category,
    confusionPenalty: 0,
    curriculumNodeId: 'current',
    difficulty: category === 'quick_success' ? 0.05 : 0.4,
    estimatedSeconds: 60,
    id,
    learningDomain: 'hanzi',
    pinyinSupportEligible: category === 'transfer_reading',
    prerequisiteConceptIds: [],
    scores: {
      confusion: category === 'confusion_review' ? 1 : 0,
      curriculumNeed: category === 'new_content' ? 1 : 0,
      interest: 0,
      overdue: category === 'overdue_review' ? 1 : 0,
      recentError: 0,
      weakness: category === 'weak_review' ? 1 : 0,
    },
    supportBoost: category === 'quick_success' ? 0.4 : 0.1,
    targetConceptIds: [`hanzi-${id}`],
    ...overrides,
  };
}

function pinyinCandidate(
  id: string,
  kind: PinyinPlanningCandidate['kind'],
  overrides: Partial<PinyinPlanningCandidate> = {},
): PinyinPlanningCandidate {
  return {
    confusion: 0,
    confusionPenalty: 0,
    curriculumNeed: kind === 'new' ? 1 : 0,
    curriculumNodeId: 'current',
    difficulty: 0.35,
    duePriority: kind === 'review' ? 0.8 : 0,
    estimatedSeconds: 60,
    id,
    interest: 0,
    kind,
    prerequisiteConceptIds: [],
    recentError: 0,
    skillType: kind === 'transfer' ? 'syllable' : 'tone',
    supportBoost: 0.1,
    targetConceptIds: [`pinyin-${id}`],
    weakness: kind === 'review' ? 0.5 : 0,
    ...overrides,
  };
}

const steadySignals: PinyinSupportSignals = {
  consecutiveErrors: 0,
  consecutiveIndependentSuccesses: 3,
  fullAnswerRevealRate: 0.1,
  recentIndependentAccuracy: 0.82,
};

function plannerInput(
  hanziCandidates: readonly HanziPlanningCandidate[],
  pinyinCandidates: readonly PinyinPlanningCandidate[],
): PinyinIntegratedPlannerInput {
  return {
    abilityEstimate: 0.82,
    eligibleCurriculumNodeIds: ['current'],
    hanziCandidates,
    masteredConceptIds: [],
    pinyinCandidates,
    pinyinSupportPreference: 'adaptive',
    pinyinSupportSignals: steadySignals,
    recentPerformance: {
      accuracy: 0.85,
      fullHintRate: 0.1,
      responseStable: true,
      transferSucceeded: true,
    },
    seed: 'integrated-session-001',
    targetMinutes: 8,
  };
}

describe('adaptive Pinyin support', () => {
  it('fades visible support to reveal-on-tap and then hidden after sustained success', () => {
    expect(
      planPinyinSupport('adaptive', {
        ...steadySignals,
        consecutiveIndependentSuccesses: 0,
        recentIndependentAccuracy: 0.7,
      }),
    ).toEqual(expect.objectContaining({ fadeStage: 0, presentation: 'visible' }));
    expect(planPinyinSupport('adaptive', steadySignals)).toEqual(
      expect.objectContaining({ fadeStage: 1, presentation: 'tap_to_reveal' }),
    );
    expect(
      planPinyinSupport('adaptive', {
        ...steadySignals,
        consecutiveIndependentSuccesses: 5,
        recentIndependentAccuracy: 0.92,
      }),
    ).toEqual(expect.objectContaining({ fadeStage: 2, presentation: 'hidden' }));
  });

  it('immediately restores visible support after repeated errors', () => {
    expect(
      planPinyinSupport('adaptive', {
        ...steadySignals,
        consecutiveErrors: 2,
        consecutiveIndependentSuccesses: 8,
        recentIndependentAccuracy: 0.95,
      }),
    ).toEqual(
      expect.objectContaining({
        initialEvidenceSupport: 'pinyin_visible',
        presentation: 'visible',
        reason: 'frustration_recovery',
      }),
    );
  });

  it('honors explicit preferences and clamps the soft domain ratio', () => {
    expect(planPinyinSupport('always', steadySignals).presentation).toBe('visible');
    expect(planPinyinSupport('tap_to_reveal', steadySignals).presentation).toBe('tap_to_reveal');
    expect(planPinyinSupport('hidden', steadySignals).presentation).toBe('hidden');
    expect(resolvePinyinTargetRatio(-1)).toBe(0.2);
    expect(resolvePinyinTargetRatio(undefined)).toBe(0.3);
    expect(resolvePinyinTargetRatio(Number.NaN)).toBe(0.3);
    expect(resolvePinyinTargetRatio(1)).toBe(0.4);
  });
});

describe('Pinyin-integrated session planning', () => {
  it('keeps a balanced Pinyin share while retaining all activity categories', () => {
    const plan = buildPinyinIntegratedSessionPlan(
      plannerInput(
        [
          hanziCandidate('due-1', 'overdue_review'),
          hanziCandidate('due-2', 'overdue_review'),
          hanziCandidate('focus', 'weak_review'),
          hanziCandidate('new', 'new_content'),
          hanziCandidate('transfer', 'transfer_reading'),
          hanziCandidate('close', 'quick_success'),
        ],
        [
          pinyinCandidate('p-due', 'review'),
          pinyinCandidate('p-new', 'new'),
          pinyinCandidate('p-transfer', 'transfer'),
        ],
      ),
    );

    expect(plan.status).toBe('planned');
    expect(plan.domainMix.pinyinActivities).toBe(2);
    expect(plan.domainMix.targetPinyinRatio).toBe(0.3);
    expect(plan.activities.at(-1)?.predictedSuccess).toBeGreaterThanOrEqual(0.9);
    expect(plan.activities.map((activity) => activity.category)).toEqual(
      expect.arrayContaining([
        'overdue_review',
        'weak_review',
        'new_content',
        'transfer_reading',
        'quick_success',
      ]),
    );
  });

  it('prioritizes due Pinyin review over new and transfer candidates', () => {
    const plan = buildPinyinIntegratedSessionPlan(
      plannerInput(
        [
          hanziCandidate('due', 'overdue_review', {
            scores: {
              confusion: 0,
              curriculumNeed: 0,
              interest: 0,
              overdue: 0.2,
              recentError: 0,
              weakness: 0,
            },
          }),
          hanziCandidate('close', 'quick_success'),
        ],
        [
          pinyinCandidate('p-due', 'review', { duePriority: 1 }),
          pinyinCandidate('p-new', 'new'),
          pinyinCandidate('p-transfer', 'transfer'),
        ],
      ),
    );
    const pinyinActivities = plan.activities.filter(
      (activity) => activity.learningDomain === 'pinyin',
    );

    expect(pinyinActivities[0]?.candidateId).toBe('p-due');
    expect(pinyinActivities[0]?.category).toBe('overdue_review');
  });

  it('suppresses new and transfer Pinyin during frustration recovery', () => {
    const input = plannerInput(
      [
        hanziCandidate('due', 'overdue_review'),
        hanziCandidate('transfer', 'transfer_reading'),
        hanziCandidate('close', 'quick_success'),
      ],
      [
        pinyinCandidate('p-review', 'review'),
        pinyinCandidate('p-new', 'new'),
        pinyinCandidate('p-transfer', 'transfer'),
      ],
    );
    const plan = buildPinyinIntegratedSessionPlan({
      ...input,
      pinyinSupportSignals: { ...steadySignals, consecutiveErrors: 3 },
    });
    const ids = plan.activities.map((activity) => activity.candidateId);

    expect(ids).toContain('p-review');
    expect(ids).not.toContain('p-new');
    expect(ids).not.toContain('p-transfer');
    expect(plan.supportDecision.reason).toBe('frustration_recovery');
  });

  it('attaches support only to eligible Hanzi activities, never to Pinyin targets', () => {
    const plan = buildPinyinIntegratedSessionPlan(
      plannerInput(
        [
          hanziCandidate('transfer-hanzi', 'transfer_reading'),
          hanziCandidate('close', 'quick_success'),
        ],
        [pinyinCandidate('review-pinyin', 'review')],
      ),
    );
    const supported = plan.activities.find((activity) => activity.candidateId === 'transfer-hanzi');
    const pinyin = plan.activities.find((activity) => activity.candidateId === 'review-pinyin');

    expect(supported?.pinyinSupport?.presentation).toBe('tap_to_reveal');
    expect(pinyin?.pinyinSupport).toBeNull();
    expect(pinyin?.pinyinSkillType).toBe('tone');
  });

  it('preserves prerequisites, new-concept, difficulty, safe-close, and fixed-seed invariants', () => {
    const hard = { difficulty: 1, supportBoost: 0 };
    const input = plannerInput(
      [
        hanziCandidate('hard-1', 'overdue_review', hard),
        hanziCandidate('hard-2', 'overdue_review', hard),
        hanziCandidate('hard-3', 'overdue_review', hard),
        hanziCandidate('reset', 'weak_review', { difficulty: 0.15, supportBoost: 0.3 }),
        hanziCandidate('locked', 'new_content', {
          prerequisiteConceptIds: ['missing'],
        }),
        hanziCandidate('close', 'quick_success'),
      ],
      [
        pinyinCandidate('new-a', 'new', { targetConceptIds: ['pinyin-a', 'pinyin-b'] }),
        pinyinCandidate('new-b', 'new', { targetConceptIds: ['pinyin-c', 'pinyin-d'] }),
      ],
    );
    const frozenInput = Object.freeze({ ...input, seed: 'fixed-integrated-seed' });
    const before = JSON.stringify(frozenInput);
    const first = buildPinyinIntegratedSessionPlan(frozenInput);
    const second = buildPinyinIntegratedSessionPlan(frozenInput);

    expect(first).toEqual(second);
    expect(JSON.stringify(frozenInput)).toBe(before);
    expect(first.algorithmVersion).toBe('session-planner-v2');
    expect(first.integrationAlgorithmVersion).toBe('pinyin-session-planner-v1');
    expect(first.newConceptIds.length).toBeLessThanOrEqual(4);
    expect(first.activities.map((activity) => activity.candidateId)).not.toContain('locked');
    expect(first.activities.at(-1)?.predictedSuccess).toBeGreaterThanOrEqual(0.9);
    for (let index = 0; index < first.activities.length - 2; index += 1) {
      expect(
        first.activities.slice(index, index + 3).every((activity) => activity.isHighDifficulty),
      ).toBe(false);
    }
  });
});
