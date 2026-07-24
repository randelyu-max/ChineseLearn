import { z } from 'zod';

import { UuidSchema } from './ids.ts';

export const DIAGNOSTIC_CONTENT_VERSION = 'diagnostic-content-v1.0.0' as const;
export const DIAGNOSTIC_RUN_SCHEMA_VERSION = 'diagnostic-run-v1' as const;

export const DiagnosticAxisSchema = z.enum([
  'spoken_audio_comprehension',
  'pinyin_recognition',
  'tone_discrimination',
  'hanzi_recognition',
  'word_reading',
  'sentence_reading',
]);

export const DiagnosticAxisEstimateSchema = z
  .object({
    estimatedLevel: z.number().int().min(0).max(4),
    confidence: z.number().min(0).max(1),
    observedEvidenceCount: z.number().int().nonnegative().max(36),
  })
  .strict();

export const DiagnosticResultSummarySchema = z
  .object({
    algorithmVersion: z.literal('diagnostic-v1'),
    axes: z.record(DiagnosticAxisSchema, DiagnosticAxisEstimateSchema),
    durationMs: z
      .number()
      .int()
      .nonnegative()
      .max(7 * 60 * 1_000),
    observedEvidenceCount: z.number().int().nonnegative().max(36),
    recommendedPinyinSupportMode: z.enum(['always', 'adaptive', 'tap_to_reveal', 'hidden']),
    recommendedStartingPoint: z.enum([
      'spoken_audio_foundations',
      'pinyin_foundations',
      'hanzi_recognition_foundations',
      'word_reading',
      'sentence_reading',
      'short_sentence_reading',
    ]),
    seed: z.string().trim().min(1).max(128),
    stopReason: z.enum([
      'confidence_reached',
      'consecutive_errors',
      'time_limit',
      'item_limit',
      'content_exhausted',
    ]),
  })
  .strict();

export const DiagnosticRunSchema = z
  .object({
    schemaVersion: z.literal(DIAGNOSTIC_RUN_SCHEMA_VERSION),
    runId: UuidSchema,
    status: z.enum(['in_progress', 'completed', 'skipped']),
    algorithmVersion: z.literal('diagnostic-v1'),
    contentVersion: z.literal(DIAGNOSTIC_CONTENT_VERSION),
    startedAt: z.iso.datetime({ offset: true }),
    completedAt: z.iso.datetime({ offset: true }).nullable(),
    skippedAt: z.iso.datetime({ offset: true }).nullable(),
    result: DiagnosticResultSummarySchema.nullable(),
  })
  .strict();

export const DiagnosticMutationSchema = z.discriminatedUnion('action', [
  z
    .object({
      schemaVersion: z.literal(DIAGNOSTIC_RUN_SCHEMA_VERSION),
      action: z.literal('start'),
      runId: UuidSchema,
      idempotencyKey: z.string().trim().min(8).max(160),
      algorithmVersion: z.literal('diagnostic-v1'),
      contentVersion: z.literal(DIAGNOSTIC_CONTENT_VERSION),
      startedAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(DIAGNOSTIC_RUN_SCHEMA_VERSION),
      action: z.literal('complete'),
      runId: UuidSchema,
      idempotencyKey: z.string().trim().min(8).max(160),
      result: DiagnosticResultSummarySchema,
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal(DIAGNOSTIC_RUN_SCHEMA_VERSION),
      action: z.literal('skip'),
      runId: UuidSchema,
      idempotencyKey: z.string().trim().min(8).max(160),
      startedAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
]);

export type DiagnosticResultSummary = z.infer<typeof DiagnosticResultSummarySchema>;
export type DiagnosticRun = z.infer<typeof DiagnosticRunSchema>;
export type DiagnosticMutation = z.infer<typeof DiagnosticMutationSchema>;
