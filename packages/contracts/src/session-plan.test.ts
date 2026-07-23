import { describe, expect, it } from 'vitest';

import {
  SESSION_PLAN_REQUEST_SCHEMA_VERSION,
  SESSION_PLAN_SNAPSHOT_SCHEMA_VERSION,
  SessionPlanRequestSchema,
  SessionPlanSnapshotSchema,
} from './session-plan.ts';

const clientSessionId = '550e8400-e29b-41d4-a716-446655440000';

describe('session-plan contracts', () => {
  it('accepts the versioned ownership-free request', () => {
    expect(
      SessionPlanRequestSchema.parse({
        schemaVersion: SESSION_PLAN_REQUEST_SCHEMA_VERSION,
        clientSessionId,
        idempotencyKey: `session-plan:${clientSessionId}`,
        targetMinutes: 10,
      }),
    ).toMatchObject({ clientSessionId, targetMinutes: 10 });
  });

  it('rejects ownership fields, invalid durations, and unknown versions', () => {
    const base = {
      schemaVersion: SESSION_PLAN_REQUEST_SCHEMA_VERSION,
      clientSessionId,
      idempotencyKey: `session-plan:${clientSessionId}`,
      targetMinutes: 10,
    };
    expect(SessionPlanRequestSchema.safeParse({ ...base, userId: clientSessionId }).success).toBe(
      false,
    );
    expect(SessionPlanRequestSchema.safeParse({ ...base, targetMinutes: 21 }).success).toBe(false);
    expect(
      SessionPlanRequestSchema.safeParse({ ...base, schemaVersion: 'session-plan-v2' }).success,
    ).toBe(false);
  });

  it('validates plan invariants at the response boundary', () => {
    const supportDecision = {
      allowReveal: true,
      fadeStage: 1 as const,
      initialEvidenceSupport: 'none' as const,
      presentation: 'tap_to_reveal' as const,
      reason: 'partial_fade' as const,
    };
    const valid = {
      schemaVersion: SESSION_PLAN_SNAPSHOT_SCHEMA_VERSION,
      activities: [
        {
          candidateId: 'candidate-1',
          category: 'quick_success',
          estimatedSeconds: 60,
          isHighDifficulty: false,
          learningDomain: 'hanzi',
          pinyinSkillType: null,
          pinyinSupport: supportDecision,
          predictedSuccess: 0.95,
          priority: 0.5,
          targetConceptIds: [clientSessionId],
        },
      ],
      algorithmVersion: 'session-planner-v2',
      domainMix: {
        hanziActivities: 1,
        pinyinActivities: 0,
        targetPinyinRatio: 0.3,
      },
      estimatedSeconds: 60,
      integrationAlgorithmVersion: 'pinyin-session-planner-v1',
      newConceptIds: [],
      newConceptLimit: 2,
      seed: clientSessionId,
      status: 'planned',
      supportDecision,
      targetSeconds: 600,
    };
    expect(SessionPlanSnapshotSchema.parse(valid)).toEqual(valid);
    expect(
      SessionPlanSnapshotSchema.safeParse({
        ...valid,
        domainMix: { ...valid.domainMix, hanziActivities: 0 },
      }).success,
    ).toBe(false);
    expect(SessionPlanSnapshotSchema.safeParse({ ...valid, estimatedSeconds: 61 }).success).toBe(
      false,
    );
  });
});
