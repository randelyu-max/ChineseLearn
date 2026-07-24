import { learningExerciseV2Fixtures } from '@hanziquest/contracts';
import type { HanziPlanningCandidate } from '@hanziquest/learning-engine';
import { describe, expect, it } from 'vitest';

import {
  buildMaterializedSessionPlanV2,
  confidenceClosingMaterial,
  contentSha256,
  SessionPlanV2ServiceError,
  type AuthoritativePlanningStateV2,
  type MaterializableCandidate,
} from './session-plan-v2-service.js';

const sessionId = '81000000-0000-4000-8000-000000000001';
const clientSessionId = '81000000-0000-4000-8000-000000000002';
const curriculumVersionId = '81000000-0000-4000-8000-000000000003';
const createdAt = new Date('2026-07-24T12:00:00.000Z');

function candidate(
  id: string,
  lessonId: string,
  conceptId: string,
  category: HanziPlanningCandidate['category'],
): HanziPlanningCandidate {
  return {
    category,
    confusionPenalty: 0,
    curriculumNodeId: lessonId,
    difficulty: category === 'quick_success' ? 0.05 : 0.25,
    estimatedSeconds: 60,
    id,
    learningDomain: 'hanzi',
    pinyinSupportEligible: true,
    prerequisiteConceptIds: [],
    scores: {
      confusion: 0,
      curriculumNeed: category === 'new_content' ? 1 : 0.2,
      interest: 0.5,
      overdue: category === 'overdue_review' ? 1 : 0,
      recentError: 0,
      weakness: category === 'quick_success' ? 0 : 0.5,
    },
    supportBoost: 0.25,
    targetConceptIds: [conceptId],
  };
}

function material(
  planned: HanziPlanningCandidate,
  exerciseIndex: 0 | 1 | 2 | 3,
  conceptType: 'character' | 'sentence' | 'word',
  abilityAxis:
    'hanzi_recognition' | 'sentence_reading' | 'spoken_audio_comprehension' | 'word_reading',
): MaterializableCandidate {
  const exercise = learningExerciseV2Fixtures[exerciseIndex];
  const skill = exercise.type;
  if (
    skill !== 'audio_to_glyph' &&
    skill !== 'glyph_to_image' &&
    skill !== 'word_build' &&
    skill !== 'sentence_order'
  ) {
    throw new Error('The fixture is outside the Hanzi capability gate.');
  }
  return {
    candidate: planned,
    dimensions: { abilityAxis, conceptType, skill },
    exercise,
    lessonId: planned.curriculumNodeId,
    targetConceptIds: planned.targetConceptIds,
  };
}

function state(): AuthoritativePlanningStateV2 {
  const lessonOne = '82000000-0000-4000-8000-000000000001';
  const lessonTwo = '82000000-0000-4000-8000-000000000002';
  const conceptOne = '82000000-0000-4000-8000-000000000011';
  const conceptTwo = '82000000-0000-4000-8000-000000000012';
  const newActivity = candidate('candidate.new', lessonOne, conceptOne, 'new_content');
  const dueActivity = candidate('candidate.due', lessonTwo, conceptTwo, 'overdue_review');
  const closeActivity = candidate('candidate.close', lessonTwo, conceptTwo, 'quick_success');
  return {
    abilityEstimate: 0.75,
    candidates: [newActivity, dueActivity, closeActivity],
    contentManifestSha256: 'a'.repeat(64),
    contentVersion: '2.0.0',
    curriculumVersionId,
    eligibleCurriculumNodeIds: [lessonOne, lessonTwo],
    humorPreference: 'light',
    masteredConceptIds: [conceptTwo],
    materialsByCandidateId: new Map([
      [newActivity.id, material(newActivity, 0, 'character', 'spoken_audio_comprehension')],
      [dueActivity.id, material(dueActivity, 2, 'word', 'word_reading')],
      [closeActivity.id, material(closeActivity, 1, 'character', 'hanzi_recognition')],
    ]),
    pinyinSupportPreference: 'adaptive',
    pinyinSupportSignals: {
      consecutiveErrors: 0,
      consecutiveIndependentSuccesses: 2,
      fullAnswerRevealRate: 0,
      recentIndependentAccuracy: 0.85,
    },
    recentPerformance: {
      accuracy: 0.85,
      fullHintRate: 0,
      responseStable: true,
      transferSucceeded: false,
    },
  };
}

function request(intent: 'learn' | 'review' = 'learn') {
  return {
    schemaVersion: 'session-plan-request-v2',
    clientSessionId,
    idempotencyKey: `session-plan-v2:${clientSessionId}`,
    intent,
    targetMinutes: 10,
  } as const;
}

function activityIds() {
  let index = 0;
  return () => `83000000-0000-4000-8000-${String(++index).padStart(12, '0')}`;
}

describe('Session Plan V2 materializer', () => {
  it('creates a deterministic multi-Lesson immutable snapshot with fixed hashes', () => {
    const first = buildMaterializedSessionPlanV2(
      request(),
      state(),
      sessionId,
      createdAt,
      activityIds(),
    );
    const second = buildMaterializedSessionPlanV2(
      request(),
      state(),
      sessionId,
      createdAt,
      activityIds(),
    );
    expect(first).toEqual(second);
    expect(first?.activities.length).toBeGreaterThan(1);
    expect(
      new Set(first?.activities.map((activity) => activity.contentRef.split('.exercise.')[0])).size,
    ).toBeGreaterThan(1);
    expect(first?.activities.every((activity) => activity.contentSha256.length === 64)).toBe(true);
    expect(first?.humorPreference).toBe('light');
  });

  it('emits only the four server-capable Hanzi exercise types', () => {
    const snapshot = buildMaterializedSessionPlanV2(
      request(),
      state(),
      sessionId,
      createdAt,
      activityIds(),
    );
    const enabled = new Set(['audio_to_glyph', 'glyph_to_image', 'word_build', 'sentence_order']);
    expect(snapshot?.activities.every((activity) => enabled.has(activity.exerciseType))).toBe(true);
    expect(snapshot?.activities.some((activity) => activity.exerciseType.includes('pinyin'))).toBe(
      false,
    );
  });

  it('keeps a review plan limited to the authoritative due candidate set', () => {
    const source = state();
    const reviewCandidates = source.candidates.filter(
      (item) => item.category === 'overdue_review' || item.category === 'quick_success',
    );
    const reviewState = {
      ...source,
      candidates: reviewCandidates,
      materialsByCandidateId: new Map(
        reviewCandidates.map((item) => [item.id, source.materialsByCandidateId.get(item.id)!]),
      ),
    };
    const snapshot = buildMaterializedSessionPlanV2(
      request('review'),
      reviewState,
      sessionId,
      createdAt,
      activityIds(),
    );
    expect(
      new Set(
        snapshot?.activities.flatMap((activity) =>
          activity.evidenceTargets.map((target) => target.conceptId),
        ),
      ),
    ).toEqual(new Set(['82000000-0000-4000-8000-000000000012']));
  });

  it('fails before persistence when a planned candidate has no materializable source', () => {
    const source = state();
    const invalid = {
      ...source,
      materialsByCandidateId: new Map(
        [...source.materialsByCandidateId].filter(([id]) => id !== 'candidate.due'),
      ),
    };
    expect(() =>
      buildMaterializedSessionPlanV2(request(), invalid, sessionId, createdAt, activityIds()),
    ).toThrow(SessionPlanV2ServiceError);
  });

  it('canonicalizes object keys before hashing content', () => {
    expect(contentSha256({ a: 1, b: [2, 3] })).toBe(contentSha256({ b: [2, 3], a: 1 }));
  });

  it('selects only a genuinely high-success closing Activity', () => {
    const unsafe = candidate(
      'candidate.a-unsafe',
      '82000000-0000-4000-8000-000000000001',
      '82000000-0000-4000-8000-000000000011',
      'overdue_review',
    );
    const safe = candidate(
      'candidate.z-safe',
      '82000000-0000-4000-8000-000000000002',
      '82000000-0000-4000-8000-000000000012',
      'overdue_review',
    );
    const unsafeMaterial = material(
      { ...unsafe, confusionPenalty: 0.9 },
      0,
      'character',
      'hanzi_recognition',
    );
    const safeMaterial = material(safe, 1, 'character', 'hanzi_recognition');
    expect(confidenceClosingMaterial([unsafeMaterial, safeMaterial], 0.5)?.candidate.id).toBe(
      'candidate.z-safe:confidence-close',
    );
    expect(confidenceClosingMaterial([unsafeMaterial], 0.15)).toBeNull();
  });
});
