import { z } from 'zod';

import { IdempotencyKeySchema, UuidSchema } from './ids.ts';
import { createApiSuccessResponseSchema } from './response.ts';
import { UtcDateTimeSchema } from './time.ts';

export const SIGNATURE_PROJECT_REQUEST_SCHEMA_VERSION = 'signature-project-request-v1' as const;
export const SIGNATURE_PRACTICE_REQUEST_SCHEMA_VERSION = 'signature-practice-request-v1' as const;
export const SIGNATURE_PRACTICE_SUMMARY_SCHEMA_VERSION = 'signature-practice-summary-v1' as const;

export const SignatureStyleSchema = z.enum(['clear', 'compact', 'forward_leaning', 'flowing']);
export const SignatureMetricSchema = z.number().finite().min(0).max(1);

export const SignatureProjectInputSchema = z
  .object({
    schemaVersion: z.literal(SIGNATURE_PROJECT_REQUEST_SCHEMA_VERSION),
    projectId: UuidSchema,
    chineseName: z.string().trim().min(1).max(24),
    selectedStyle: SignatureStyleSchema,
  })
  .strict();

export const SignaturePracticeMetricEventSchema = z
  .object({
    schemaVersion: z.literal(SIGNATURE_PRACTICE_REQUEST_SCHEMA_VERSION),
    eventId: UuidSchema,
    projectId: UuidSchema,
    idempotencyKey: IdempotencyKeySchema,
    occurredAt: UtcDateTimeSchema,
    algorithmVersion: z.literal('signature-consistency-v1'),
    metrics: z
      .object({
        direction: SignatureMetricSchema,
        proportion: SignatureMetricSchema,
        rhythm: SignatureMetricSchema,
        structure: SignatureMetricSchema,
      })
      .strict()
      .nullable(),
  })
  .strict();

export const SignaturePracticeSummarySchema = z
  .object({
    schemaVersion: z.literal(SIGNATURE_PRACTICE_SUMMARY_SCHEMA_VERSION),
    projectId: UuidSchema,
    practiceCount: z.number().int().nonnegative(),
    selectedStyle: SignatureStyleSchema,
    scores: z
      .object({
        direction: SignatureMetricSchema.nullable(),
        proportion: SignatureMetricSchema.nullable(),
        rhythm: SignatureMetricSchema.nullable(),
        structure: SignatureMetricSchema.nullable(),
      })
      .strict(),
    calculatedAt: UtcDateTimeSchema.nullable(),
  })
  .strict();

export const SignaturePracticeSummarySuccessResponseSchema = createApiSuccessResponseSchema(
  SignaturePracticeSummarySchema,
);

export type SignatureStyle = z.infer<typeof SignatureStyleSchema>;
export type SignatureProjectInput = z.infer<typeof SignatureProjectInputSchema>;
export type SignaturePracticeMetricEvent = z.infer<typeof SignaturePracticeMetricEventSchema>;
export type SignaturePracticeSummary = z.infer<typeof SignaturePracticeSummarySchema>;
export type SignaturePracticeSummarySuccessResponse = z.infer<
  typeof SignaturePracticeSummarySuccessResponseSchema
>;
