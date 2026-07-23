import { z } from 'zod';

import { IdempotencyKeySchema, UuidSchema } from './ids.ts';
import { createApiSuccessResponseSchema } from './response.ts';
import { UtcDateTimeSchema } from './time.ts';

export const SESSION_PLAN_REQUEST_SCHEMA_VERSION = 'session-plan-request-v1' as const;
export const SESSION_PLAN_SNAPSHOT_SCHEMA_VERSION = 'session-plan-snapshot-v1' as const;

export const SessionPlanRequestSchema = z
  .object({
    schemaVersion: z.literal(SESSION_PLAN_REQUEST_SCHEMA_VERSION),
    clientSessionId: UuidSchema,
    idempotencyKey: IdempotencyKeySchema,
    targetMinutes: z.number().int().min(3).max(20),
  })
  .strict();

export const SessionPlanActivitySchema = z
  .object({
    candidateId: z.string().trim().min(1).max(160),
    category: z.enum([
      'overdue_review',
      'confusion_review',
      'weak_review',
      'new_content',
      'transfer_reading',
      'quick_success',
    ]),
    estimatedSeconds: z.number().int().min(10).max(300),
    isHighDifficulty: z.boolean(),
    learningDomain: z.enum(['hanzi', 'pinyin']),
    pinyinSkillType: z.enum(['initial', 'final', 'syllable', 'tone']).nullable(),
    pinyinSupport: z
      .object({
        allowReveal: z.boolean(),
        fadeStage: z.union([z.literal(0), z.literal(1), z.literal(2)]),
        initialEvidenceSupport: z.enum(['none', 'pinyin_visible']),
        presentation: z.enum(['visible', 'tap_to_reveal', 'hidden']),
        reason: z.enum([
          'preference_always',
          'preference_tap_to_reveal',
          'preference_hidden',
          'frustration_recovery',
          'support_not_yet_faded',
          'partial_fade',
          'sustained_independent_success',
        ]),
      })
      .strict()
      .nullable(),
    predictedSuccess: z.number().min(0).max(1),
    priority: z.number().min(0).max(1),
    targetConceptIds: z.array(z.string().trim().min(1).max(160)).max(20),
  })
  .strict();

const PinyinSupportDecisionSchema = SessionPlanActivitySchema.shape.pinyinSupport.unwrap();

export const SessionPlanSnapshotSchema = z
  .object({
    schemaVersion: z.literal(SESSION_PLAN_SNAPSHOT_SCHEMA_VERSION),
    activities: z.array(SessionPlanActivitySchema).max(20),
    algorithmVersion: z.literal('session-planner-v2'),
    domainMix: z
      .object({
        hanziActivities: z.number().int().nonnegative(),
        pinyinActivities: z.number().int().nonnegative(),
        targetPinyinRatio: z.number().min(0.2).max(0.4),
      })
      .strict(),
    estimatedSeconds: z.number().int().nonnegative(),
    integrationAlgorithmVersion: z.literal('pinyin-session-planner-v1'),
    newConceptIds: z.array(z.string().trim().min(1).max(160)).max(4),
    newConceptLimit: z.number().int().min(0).max(4),
    seed: z.string().trim().min(1).max(200),
    status: z.enum(['planned', 'insufficient_safe_content']),
    supportDecision: PinyinSupportDecisionSchema,
    targetSeconds: z.number().int().min(180).max(1200),
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (
      snapshot.domainMix.hanziActivities + snapshot.domainMix.pinyinActivities !==
      snapshot.activities.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Domain activity counts must equal the activity count.',
        path: ['domainMix'],
      });
    }
    const calculatedSeconds = snapshot.activities.reduce(
      (total, activity) => total + activity.estimatedSeconds,
      0,
    );
    if (calculatedSeconds !== snapshot.estimatedSeconds) {
      context.addIssue({
        code: 'custom',
        message: 'Estimated seconds must equal the activity duration sum.',
        path: ['estimatedSeconds'],
      });
    }
  });

export const SessionPlanResponseDataSchema = z
  .object({
    schemaVersion: z.literal(SESSION_PLAN_SNAPSHOT_SCHEMA_VERSION),
    clientSessionId: UuidSchema,
    createdAt: UtcDateTimeSchema,
    sessionId: UuidSchema,
    snapshot: SessionPlanSnapshotSchema,
  })
  .strict();

export const SessionPlanSuccessResponseSchema = createApiSuccessResponseSchema(
  SessionPlanResponseDataSchema,
);

export type SessionPlanRequest = z.infer<typeof SessionPlanRequestSchema>;
export type SessionPlanSnapshot = z.infer<typeof SessionPlanSnapshotSchema>;
export type SessionPlanResponseData = z.infer<typeof SessionPlanResponseDataSchema>;
export type SessionPlanSuccessResponse = z.infer<typeof SessionPlanSuccessResponseSchema>;
