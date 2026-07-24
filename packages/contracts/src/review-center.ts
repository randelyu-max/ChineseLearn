import { z } from 'zod';

import { createApiSuccessResponseSchema } from './response.ts';
import { UtcDateTimeSchema } from './time.ts';

export const REVIEW_CENTER_REQUEST_SCHEMA_VERSION = 'review-center-request-v1' as const;
export const REVIEW_CENTER_SCHEMA_VERSION = 'review-center-v1' as const;
export const REVIEW_CENTER_CURSOR_SCHEMA_VERSION = 'review-center-cursor-v1' as const;
export const REVIEW_CENTER_MAX_PAGE_SIZE = 50;

export const reviewCenterKinds = Object.freeze([
  'hanzi',
  'pinyin',
  'tone',
  'word',
  'sentence',
  'confusion',
] as const);

export const reviewCenterReasonCodes = Object.freeze([
  'scheduled_review',
  'recent_error',
  'confusion_pair',
  'stability_check',
  'pinyin_dependency',
] as const);

export const ReviewCenterKindSchema = z.enum(reviewCenterKinds);
export const ReviewCenterReasonCodeSchema = z.enum(reviewCenterReasonCodes);

export const ReviewCenterQuerySchema = z
  .object({
    schemaVersion: z.literal(REVIEW_CENTER_REQUEST_SCHEMA_VERSION),
    cursor: z
      .string()
      .trim()
      .min(1)
      .max(2048)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(REVIEW_CENTER_MAX_PAGE_SIZE).default(20),
  })
  .strict();

export const ReviewCenterCursorPayloadSchema = z
  .object({
    schemaVersion: z.literal(REVIEW_CENTER_CURSOR_SCHEMA_VERSION),
    generatedAt: UtcDateTimeSchema,
    offset: z.number().int().nonnegative().max(100_000),
  })
  .strict();

export const ReviewCenterGroupSchema = z
  .object({
    kind: ReviewCenterKindSchema,
    count: z.number().int().nonnegative(),
    overdueCount: z.number().int().nonnegative(),
  })
  .strict()
  .refine((group) => group.overdueCount <= group.count, {
    message: 'A group overdue count cannot exceed its total count.',
  });

export const ReviewCenterItemSchema = z
  .object({
    reviewKey: z.string().trim().min(1).max(256),
    kind: ReviewCenterKindSchema,
    contentRef: z.string().trim().min(1).max(256),
    displayLabel: z.string().trim().min(1).max(160),
    secondaryLabel: z.string().trim().min(1).max(240).optional(),
    dueAt: UtcDateTimeSchema,
    isOverdue: z.boolean(),
    reasonCode: ReviewCenterReasonCodeSchema,
    estimatedSeconds: z.number().int().min(10).max(300),
    recommendedActivityType: z.string().trim().min(1).max(80).optional(),
    recommendedPinyinPolicy: z.enum(['always', 'adaptive', 'tap_to_reveal', 'hidden']).optional(),
  })
  .strict();

export const ReviewCenterResponseDataSchema = z
  .object({
    schemaVersion: z.literal(REVIEW_CENTER_SCHEMA_VERSION),
    generatedAt: UtcDateTimeSchema,
    summary: z
      .object({
        dueNowCount: z.number().int().nonnegative(),
        overdueCount: z.number().int().nonnegative(),
        estimatedMinutes: z.number().int().nonnegative(),
        nextDueAt: UtcDateTimeSchema.nullable(),
      })
      .strict(),
    groups: z.array(ReviewCenterGroupSchema).length(reviewCenterKinds.length),
    items: z.array(ReviewCenterItemSchema).max(REVIEW_CENTER_MAX_PAGE_SIZE),
    pageInfo: z
      .object({
        nextCursor: z.string().trim().min(1).max(2048).nullable(),
        hasMore: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((data, context) => {
    const kinds = new Set(data.groups.map((group) => group.kind));
    if (kinds.size !== reviewCenterKinds.length) {
      context.addIssue({
        code: 'custom',
        message: 'Review groups must contain every kind exactly once.',
        path: ['groups'],
      });
    }
    const groupedCount = data.groups.reduce((total, group) => total + group.count, 0);
    const groupedOverdue = data.groups.reduce((total, group) => total + group.overdueCount, 0);
    if (groupedCount !== data.summary.dueNowCount) {
      context.addIssue({
        code: 'custom',
        message: 'Group counts must equal the due-now summary count.',
        path: ['summary', 'dueNowCount'],
      });
    }
    if (
      groupedOverdue !== data.summary.overdueCount ||
      data.summary.overdueCount > data.summary.dueNowCount
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Group overdue counts must equal the summary overdue count.',
        path: ['summary', 'overdueCount'],
      });
    }
    if (data.pageInfo.hasMore !== (data.pageInfo.nextCursor !== null)) {
      context.addIssue({
        code: 'custom',
        message: 'hasMore and nextCursor must describe the same pagination state.',
        path: ['pageInfo'],
      });
    }
  });

export const ReviewCenterSuccessResponseSchema = createApiSuccessResponseSchema(
  ReviewCenterResponseDataSchema,
);

export type ReviewCenterKind = z.infer<typeof ReviewCenterKindSchema>;
export type ReviewCenterQuery = z.infer<typeof ReviewCenterQuerySchema>;
export type ReviewCenterCursorPayload = z.infer<typeof ReviewCenterCursorPayloadSchema>;
export type ReviewCenterReasonCode = z.infer<typeof ReviewCenterReasonCodeSchema>;
export type ReviewCenterItem = z.infer<typeof ReviewCenterItemSchema>;
export type ReviewCenterResponseData = z.infer<typeof ReviewCenterResponseDataSchema>;
export type ReviewCenterSuccessResponse = z.infer<typeof ReviewCenterSuccessResponseSchema>;
