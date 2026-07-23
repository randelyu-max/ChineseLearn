import { z } from 'zod';

import { IdempotencyKeySchema, UuidSchema } from './ids.ts';
import { createApiSuccessResponseSchema } from './response.ts';
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

export type HintLevel = z.infer<typeof HintLevelSchema>;
export type AttemptPinyinSupport = z.infer<typeof AttemptPinyinSupportSchema>;
export type AttemptAnswer = z.infer<typeof AttemptAnswerSchema>;
export type AttemptDraft = z.infer<typeof AttemptDraftSchema>;
export type AttemptsBatchRequest = z.infer<typeof AttemptsBatchRequestSchema>;
export type AttemptBatchResult = z.infer<typeof AttemptBatchResultSchema>;
export type AttemptsBatchResponseData = z.infer<typeof AttemptsBatchResponseDataSchema>;
