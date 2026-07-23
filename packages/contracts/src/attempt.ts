import { z } from 'zod';

import { UuidSchema } from './ids.ts';
import { UtcDateTimeSchema } from './time.ts';

export const HintLevelSchema = z.enum(['none', 'audio_repeat', 'visual_hint', 'full_answer']);

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
    replayCount: z.number().int().nonnegative().max(100),
    retryCount: z.number().int().nonnegative().max(100),
    occurredAt: UtcDateTimeSchema,
    offlineSequence: z.number().int().nonnegative(),
  })
  .strict();

export type HintLevel = z.infer<typeof HintLevelSchema>;
export type AttemptAnswer = z.infer<typeof AttemptAnswerSchema>;
export type AttemptDraft = z.infer<typeof AttemptDraftSchema>;
