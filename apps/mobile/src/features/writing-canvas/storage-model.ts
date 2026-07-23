import {
  SignaturePracticeMetricEventSchema,
  SignaturePracticeSummarySchema,
  SignatureStyleSchema,
  type SignaturePracticeMetricEvent,
  type SignaturePracticeSummary,
  type SignatureStyle,
} from '@hanziquest/contracts';
import { z } from 'zod';

import {
  MAX_POINTS_PER_STROKE,
  MAX_STROKES_PER_DRAFT,
  WRITING_CANVAS_MODEL_VERSION,
  type Stroke,
} from './model';

export const WRITING_DRAFT_SCHEMA_VERSION = 'writing-draft-v2' as const;
export const MAX_PENDING_SIGNATURE_EVENTS = 100;
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

const SignatureConsistencyMetricsSchema = z
  .object({
    direction: z.number().finite().min(0).max(1),
    proportion: z.number().finite().min(0).max(1),
    rhythm: z.number().finite().min(0).max(1),
    structure: z.number().finite().min(0).max(1),
  })
  .strict();

const LegacyWritingDraftRecordSchema = z
  .object({
    schemaVersion: z.literal('writing-draft-v1'),
    modelVersion: z.literal(WRITING_CANVAS_MODEL_VERSION),
    ownerUserId: z.string().trim().min(1).max(128),
    chineseName: z.string().trim().min(1).max(24),
    strokes: z.array(StrokeSchema).max(MAX_STROKES_PER_DRAFT),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const WritingDraftRecordSchema = z
  .object({
    schemaVersion: z.literal(WRITING_DRAFT_SCHEMA_VERSION),
    modelVersion: z.literal(WRITING_CANVAS_MODEL_VERSION),
    ownerUserId: z.string().trim().min(1).max(128),
    chineseName: z.string().trim().min(1).max(24),
    projectId: z.uuid(),
    selectedStyle: SignatureStyleSchema,
    strokes: z.array(StrokeSchema).max(MAX_STROKES_PER_DRAFT),
    baselineStrokes: z.array(StrokeSchema).max(MAX_STROKES_PER_DRAFT).nullable(),
    latestFeedback: SignatureConsistencyMetricsSchema.nullable(),
    pendingEvents: z.array(SignaturePracticeMetricEventSchema).max(MAX_PENDING_SIGNATURE_EVENTS),
    practiceSequence: z.number().int().nonnegative(),
    serverSummary: SignaturePracticeSummarySchema.nullable(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type WritingDraftRecord = z.infer<typeof WritingDraftRecordSchema>;
type StoredSignatureConsistencyMetrics = z.infer<typeof SignatureConsistencyMetricsSchema>;

export type WritingDraftStore = Readonly<{
  clear(ownerUserId: string): Promise<void>;
  load(ownerUserId: string): Promise<WritingDraftRecord | null>;
  save(record: WritingDraftRecord): Promise<void>;
}>;

export function createWritingDraftRecord(
  input: Readonly<{
    baselineStrokes?: readonly Stroke[] | null;
    chineseName: string;
    latestFeedback?: StoredSignatureConsistencyMetrics | null;
    ownerUserId: string;
    pendingEvents?: readonly SignaturePracticeMetricEvent[];
    practiceSequence?: number;
    projectId?: string;
    selectedStyle?: SignatureStyle;
    serverSummary?: SignaturePracticeSummary | null;
    strokes: readonly Stroke[];
    updatedAt: string;
  }>,
): WritingDraftRecord {
  return WritingDraftRecordSchema.parse({
    ...input,
    baselineStrokes: input.baselineStrokes ?? null,
    latestFeedback: input.latestFeedback ?? null,
    modelVersion: WRITING_CANVAS_MODEL_VERSION,
    pendingEvents: input.pendingEvents ?? [],
    practiceSequence: input.practiceSequence ?? 0,
    projectId: input.projectId ?? createLocalSignatureProjectId(input.ownerUserId),
    schemaVersion: WRITING_DRAFT_SCHEMA_VERSION,
    selectedStyle: input.selectedStyle ?? 'clear',
    serverSummary: input.serverSummary ?? null,
  });
}

export function parseWritingDraftRecord(input: unknown): WritingDraftRecord {
  const current = WritingDraftRecordSchema.safeParse(input);
  if (current.success) return current.data;
  const legacy = LegacyWritingDraftRecordSchema.parse(input);
  return createWritingDraftRecord({
    chineseName: legacy.chineseName,
    ownerUserId: legacy.ownerUserId,
    strokes: legacy.strokes,
    updatedAt: legacy.updatedAt,
  });
}

function hashWord(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619) >>> 0;
  }
  return hash;
}

export function createLocalSignatureProjectId(ownerUserId: string): string {
  const input = `hanziquest-signature-project:${ownerUserId}`;
  const hex = [2_166_136_261, 2_166_136_261 ^ 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
    .map((seed) => hashWord(input, seed).toString(16).padStart(8, '0'))
    .join('')
    .split('');
  hex[12] = '4';
  hex[16] = '8';
  const value = hex.join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(
    16,
    20,
  )}-${value.slice(20, 32)}`;
}
