import { z } from 'zod';

import { StableLearningContentIdSchema } from './exercise-v2.ts';
import { IdempotencyKeySchema, UuidSchema } from './ids.ts';
import { createApiSuccessResponseSchema } from './response.ts';
import { EvidenceTargetV1Schema } from './session-activity-v2.ts';
import { UtcDateTimeSchema } from './time.ts';

export const HintLevelSchema = z.enum(['none', 'audio_repeat', 'visual_hint', 'full_answer']);
export const AttemptPinyinSupportSchema = z.enum([
  'none',
  'pinyin_visible',
  'pinyin_revealed',
  'full_answer',
]);

export const OptionAnswerSchema = z
  .object({
    optionId: UuidSchema,
  })
  .strict();

export const TileOrderAnswerSchema = z
  .object({
    tileIds: z.array(UuidSchema).min(1).max(20),
  })
  .strict();

export const AttemptAnswerSchema = z.union([OptionAnswerSchema, TileOrderAnswerSchema]);

export const AttemptDraftSchema = z
  .object({
    attemptId: UuidSchema,
    activityId: UuidSchema,
    answer: AttemptAnswerSchema,
    isCorrectClient: z.boolean(),
    responseMs: z
      .number()
      .int()
      .nonnegative()
      .max(30 * 60 * 1000),
    hintLevel: HintLevelSchema,
    pinyinSupport: AttemptPinyinSupportSchema.optional(),
    replayCount: z.number().int().nonnegative().max(100),
    retryCount: z.number().int().nonnegative().max(100),
    occurredAt: UtcDateTimeSchema,
    offlineSequence: z.number().int().nonnegative(),
  })
  .strict();

export const ATTEMPTS_BATCH_REQUEST_SCHEMA_VERSION = 'attempts-batch-request-v1' as const;
export const ATTEMPTS_BATCH_RESPONSE_SCHEMA_VERSION = 'attempts-batch-response-v1' as const;

export const AttemptsBatchRequestSchema = z
  .object({
    schemaVersion: z.literal(ATTEMPTS_BATCH_REQUEST_SCHEMA_VERSION),
    sessionId: UuidSchema,
    idempotencyKey: IdempotencyKeySchema,
    attempts: z.array(AttemptDraftSchema).min(1).max(50),
  })
  .strict()
  .superRefine((batch, context) => {
    const ids = batch.attempts.map((attempt) => attempt.attemptId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        message: 'Attempt IDs must be unique within a batch.',
        path: ['attempts'],
      });
    }
  });

export const AttemptBatchResultSchema = z
  .object({
    attemptId: UuidSchema,
    status: z.enum(['accepted', 'duplicate', 'rejected']),
    isCorrect: z.boolean().optional(),
    evidenceWeight: z.number().min(0).max(1).optional(),
    rejectionCode: z
      .enum(['ACTIVITY_NOT_FOUND', 'ANSWER_INVALID', 'SESSION_NOT_ACTIVE'])
      .optional(),
  })
  .strict();

export const AttemptsBatchResponseDataSchema = z
  .object({
    schemaVersion: z.literal(ATTEMPTS_BATCH_RESPONSE_SCHEMA_VERSION),
    sessionId: UuidSchema,
    results: z.array(AttemptBatchResultSchema).min(1).max(50),
    syncCursor: z.string().trim().min(1).max(200),
  })
  .strict();

export const AttemptsBatchSuccessResponseSchema = createApiSuccessResponseSchema(
  AttemptsBatchResponseDataSchema,
);

export const ATTEMPTS_BATCH_REQUEST_V2_SCHEMA_VERSION = 'attempts-batch-request-v2' as const;
export const ATTEMPTS_BATCH_RESPONSE_V2_SCHEMA_VERSION = 'attempts-batch-response-v2' as const;
export const ATTEMPT_EVIDENCE_V1_ALGORITHM_VERSION =
  'exercise-quality-v1+pinyin-evidence-v1' as const;

export const OptionAnswerV2Schema = z
  .object({
    optionId: StableLearningContentIdSchema,
  })
  .strict();

export const TileOrderAnswerV2Schema = z
  .object({
    tileIds: z.array(StableLearningContentIdSchema).min(1).max(20),
  })
  .strict();

export const AttemptAnswerV2Schema = z.union([OptionAnswerV2Schema, TileOrderAnswerV2Schema]);

export const AttemptDraftV2Schema = z
  .object({
    attemptId: UuidSchema,
    sessionActivityId: UuidSchema,
    answer: AttemptAnswerV2Schema,
    isCorrectClient: z.boolean().optional(),
    responseMs: z
      .number()
      .int()
      .nonnegative()
      .max(30 * 60 * 1000),
    hintLevel: HintLevelSchema,
    pinyinSupport: AttemptPinyinSupportSchema,
    replayCount: z.number().int().nonnegative().max(100),
    retryCount: z.number().int().nonnegative().max(100),
    occurredAt: UtcDateTimeSchema,
    offlineSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export const AttemptsBatchRequestV2Schema = z
  .object({
    schemaVersion: z.literal(ATTEMPTS_BATCH_REQUEST_V2_SCHEMA_VERSION),
    sessionId: UuidSchema,
    idempotencyKey: IdempotencyKeySchema,
    attempts: z.array(AttemptDraftV2Schema).min(1).max(50),
  })
  .strict()
  .superRefine((batch, context) => {
    const ids = batch.attempts.map((attempt) => attempt.attemptId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        message: 'Attempt IDs must be unique within a batch.',
        path: ['attempts'],
      });
    }
  });

export const AttemptEvidenceResultV1Schema = EvidenceTargetV1Schema.omit({
  schemaVersion: true,
  role: true,
})
  .extend({
    correct: z.boolean(),
    baseQuality: z.number().min(0).max(1),
    supportMultiplier: z.number().min(0).max(1),
    effectiveQuality: z.number().min(0).max(1),
    algorithmVersion: z.string().trim().min(1).max(100),
  })
  .strict()
  .superRefine((evidence, context) => {
    if (
      Math.abs(evidence.baseQuality * evidence.supportMultiplier - evidence.effectiveQuality) >
      0.000_001
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Effective quality must equal base quality multiplied by support.',
        path: ['effectiveQuality'],
      });
    }
  });

const AcceptedAttemptBatchResultV2Shape = {
  attemptId: UuidSchema,
  isCorrect: z.boolean(),
  evidence: z.array(AttemptEvidenceResultV1Schema).min(1).max(20),
};

export const AttemptBatchResultV2Schema = z.discriminatedUnion('status', [
  z
    .object({
      ...AcceptedAttemptBatchResultV2Shape,
      status: z.literal('accepted'),
    })
    .strict(),
  z
    .object({
      ...AcceptedAttemptBatchResultV2Shape,
      status: z.literal('duplicate'),
    })
    .strict(),
  z
    .object({
      attemptId: UuidSchema,
      status: z.literal('rejected'),
      rejectionCode: z.enum([
        'ACTIVITY_NOT_FOUND',
        'ANSWER_INVALID',
        'ATTEMPT_ID_CONFLICT',
        'SESSION_NOT_ACTIVE',
        'SUPPORT_STATE_INVALID',
      ]),
    })
    .strict(),
]);

export const AttemptsBatchResponseDataV2Schema = z
  .object({
    schemaVersion: z.literal(ATTEMPTS_BATCH_RESPONSE_V2_SCHEMA_VERSION),
    sessionId: UuidSchema,
    results: z.array(AttemptBatchResultV2Schema).min(1).max(50),
    syncCursor: z.string().trim().min(1).max(200),
  })
  .strict();

export const AttemptsBatchV2SuccessResponseSchema = createApiSuccessResponseSchema(
  AttemptsBatchResponseDataV2Schema,
);

export type HintLevel = z.infer<typeof HintLevelSchema>;
export type AttemptPinyinSupport = z.infer<typeof AttemptPinyinSupportSchema>;
export type AttemptAnswer = z.infer<typeof AttemptAnswerSchema>;
export type AttemptDraft = z.infer<typeof AttemptDraftSchema>;
export type AttemptsBatchRequest = z.infer<typeof AttemptsBatchRequestSchema>;
export type AttemptBatchResult = z.infer<typeof AttemptBatchResultSchema>;
export type AttemptsBatchResponseData = z.infer<typeof AttemptsBatchResponseDataSchema>;
export type AttemptAnswerV2 = z.infer<typeof AttemptAnswerV2Schema>;
export type AttemptDraftV2 = z.infer<typeof AttemptDraftV2Schema>;
export type AttemptsBatchRequestV2 = z.infer<typeof AttemptsBatchRequestV2Schema>;
export type AttemptEvidenceResultV1 = z.infer<typeof AttemptEvidenceResultV1Schema>;
export type AttemptBatchResultV2 = z.infer<typeof AttemptBatchResultV2Schema>;
export type AttemptsBatchResponseDataV2 = z.infer<typeof AttemptsBatchResponseDataV2Schema>;
