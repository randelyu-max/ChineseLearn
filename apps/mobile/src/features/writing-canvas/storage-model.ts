import { z } from 'zod';

import {
  MAX_POINTS_PER_STROKE,
  MAX_STROKES_PER_DRAFT,
  WRITING_CANVAS_MODEL_VERSION,
  type Stroke,
} from './model';

export const WRITING_DRAFT_SCHEMA_VERSION = 'writing-draft-v1' as const;
export const WRITING_RAW_DATA_POLICY = Object.freeze({
  networkExport: false,
  persistence: 'local_only',
  purpose: 'own_chinese_name_practice',
} as const);

const StrokePointSchema = z
  .object({
    pressure: z.number().min(0).max(1).optional(),
    timestamp: z.number().finite().nonnegative(),
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
  })
  .strict();

const StrokeSchema = z
  .object({
    points: z.array(StrokePointSchema).min(1).max(MAX_POINTS_PER_STROKE),
  })
  .strict();

export const WritingDraftRecordSchema = z
  .object({
    schemaVersion: z.literal(WRITING_DRAFT_SCHEMA_VERSION),
    modelVersion: z.literal(WRITING_CANVAS_MODEL_VERSION),
    ownerUserId: z.string().trim().min(1).max(128),
    chineseName: z.string().trim().min(1).max(24),
    strokes: z.array(StrokeSchema).max(MAX_STROKES_PER_DRAFT),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type WritingDraftRecord = z.infer<typeof WritingDraftRecordSchema>;

export type WritingDraftStore = Readonly<{
  clear(ownerUserId: string): Promise<void>;
  load(ownerUserId: string): Promise<WritingDraftRecord | null>;
  save(record: WritingDraftRecord): Promise<void>;
}>;

export function createWritingDraftRecord(
  input: Readonly<{
    chineseName: string;
    ownerUserId: string;
    strokes: readonly Stroke[];
    updatedAt: string;
  }>,
): WritingDraftRecord {
  return WritingDraftRecordSchema.parse({
    ...input,
    modelVersion: WRITING_CANVAS_MODEL_VERSION,
    schemaVersion: WRITING_DRAFT_SCHEMA_VERSION,
  });
}
