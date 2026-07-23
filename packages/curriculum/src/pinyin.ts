import {
  PinyinFinalSchema,
  PinyinInitialSchema,
  PinyinToneSchema,
  SemanticVersionSchema,
  UuidSchema,
} from '@hanziquest/contracts';
import { z } from 'zod';

import { ContentAssetSchema, ContentStatusSchema } from './schemas.ts';

export const PINYIN_CONTENT_SCHEMA_VERSION = 'pinyin-content-v1' as const;

const LearningHintSchema = z.string().trim().min(1).max(160);
const PinyinTextSchema = z.string().trim().min(1).max(12);

export const PinyinInitialContentSchema = z
  .object({
    id: UuidSchema,
    value: PinyinInitialSchema,
    labelZh: LearningHintSchema,
    articulationHintZh: LearningHintSchema,
    status: ContentStatusSchema,
  })
  .strict();

export const PinyinFinalContentSchema = z
  .object({
    id: UuidSchema,
    value: PinyinFinalSchema,
    labelZh: LearningHintSchema,
    articulationHintZh: LearningHintSchema,
    status: ContentStatusSchema,
  })
  .strict();

export const PinyinToneContentSchema = z
  .object({
    tone: PinyinToneSchema,
    labelZh: LearningHintSchema,
    contour: z.enum(['55', '35', '214', '51', 'neutral']),
    exampleSyllable: PinyinTextSchema,
    status: ContentStatusSchema,
  })
  .strict();

export const PinyinSyllableContentSchema = z
  .object({
    id: UuidSchema,
    numbered: PinyinTextSchema,
    display: z.string().trim().min(1).max(8),
    initialId: UuidSchema,
    finalId: UuidSchema,
    tone: PinyinToneSchema,
    audioAssetId: UuidSchema.optional(),
    mouthShapeHintZh: LearningHintSchema.optional(),
    status: ContentStatusSchema,
  })
  .strict();

export const PinyinContentPackageSchema = z
  .object({
    schemaVersion: z.literal(PINYIN_CONTENT_SCHEMA_VERSION),
    contentVersion: SemanticVersionSchema,
    minimumAppVersion: SemanticVersionSchema,
    initials: z.array(PinyinInitialContentSchema).min(1),
    finals: z.array(PinyinFinalContentSchema).min(1),
    tones: z.array(PinyinToneContentSchema).length(5),
    syllables: z.array(PinyinSyllableContentSchema).min(1),
    assets: z.array(ContentAssetSchema).default([]),
  })
  .strict();

export type PinyinInitialContent = z.infer<typeof PinyinInitialContentSchema>;
export type PinyinFinalContent = z.infer<typeof PinyinFinalContentSchema>;
export type PinyinToneContent = z.infer<typeof PinyinToneContentSchema>;
export type PinyinSyllableContent = z.infer<typeof PinyinSyllableContentSchema>;
export type PinyinContentPackage = z.infer<typeof PinyinContentPackageSchema>;
